<?php
// Manpower request endpoints for HR workflows

namespace App\Http\Controllers\HR;

use App\Http\Controllers\Controller;
use App\Models\ManpowerRequest;
use App\Models\Branch;
use App\Models\Department;
use App\Models\Position;
use App\Models\User;
use App\Notifications\ManpowerRequestAlert;
use App\Notifications\ManpowerStatusAlert;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Inertia\Inertia;
use Exception;

class ManpowerRequestController extends Controller
{
    // ----------------------------------------------------------------------
    // 1. THE CREATION FORM
    // ----------------------------------------------------------------------
   public function create()
    {
        $user = User::with(['position', 'role'])->find(Auth::id());
        $roleName = $user->role->name ?? '';
        $userPositionId = $user->position_id;
        $userDepartmentId = $user->position->department_id ?? null;
        
        // --- GET ALL ALLOWED BRANCHES ---
        $primaryBranchId = $user->branch_id;

        $rotatingBranchIds = DB::table('branch_user')
            ->where('user_id', $user->id)
            ->pluck('branch_id')
            ->toArray();

        $allowedBranchIds = array_filter(array_unique(array_merge((array) $primaryBranchId, $rotatingBranchIds)));

        // 1. 🟢 BRANCH RESTRICTION
        $branchesQuery = Branch::select('id', 'name')->orderBy('name');
        if (strtolower($roleName) !== 'admin') {
            if (!empty($allowedBranchIds)) {
                $branchesQuery->whereIn('id', $allowedBranchIds);
            } else {
                $branchesQuery->where('id', 0); // Failsafe
            }
        }

        // 2. Base Query
        $positionsQuery = Position::with('department')->select('id', 'name', 'department_id');

        // 3. 🟢 GLOBAL RULE: Cannot request own position
        if ($userPositionId) {
            $positionsQuery->where('id', '!=', $userPositionId);
        }

        // 4. 🟢 EXACT ROLE-BASED FILTERING MATRIX
        if (strtolower(trim($roleName)) !== 'admin') {
            
            $positionsQuery->where(function ($query) use ($roleName, $userDepartmentId) {
            
                // 🟢 Create a safe, lowercase, trimmed version of the role to prevent matching errors
                $safeRole = strtolower(trim($roleName));

                if ($safeRole === 'director of corporate services and operations') {
                    // DCSO: Accounting/Operations Depts OR exact specific roles
                    $query->whereHas('department', function ($q) {
                        $q->whereIn('name', ['Accounting', 'Operations']); 
                    })
                    ->orWhereIn('name', ['Chief Veterinarian', 'Human Resources Business Partner', 'Marketing Manager']) 
                    ->orWhere(function ($subQuery) {
                        $subQuery->where(function ($q) {
                            $q->where('name', 'LIKE', '%TL%')
                              ->orWhere('name', 'LIKE', '%Team Leader%');
                        })->whereNotIn('name', [
                            'Veterinary Technician Team Leader',
                            'Clinic Assistant TL'
                        ]);
                    });

                } elseif ($safeRole === 'operations manager') {
                    // 🟢 OM: Access limited to specific departments only
                    $query->whereHas('department', function ($q) {
                        $q->whereIn('name', [
                            'Veterinarians', 
                            'Inventory', 
                            'Clinic Assistants', 
                            'Housekeeping'
                        ]); 
                    });

                } elseif ($safeRole === 'chief vet' || $safeRole === 'chief veterinarian') {
                    // Chief Vet: Veterinarians Dept OR specific TLs
                    $query->whereHas('department', function ($q) {
                        $q->where('name', 'Veterinarians');
                    })
                    ->orWhereIn('name', [
                        'Veterinary Technician Team Leader', 
                        'Clinic Assistant TL'
                    ]);

                } elseif ($safeRole === 'marketing manager') {
                    // Marketing Manager: Marketing Dept only
                    $query->whereHas('department', function ($q) {
                        $q->where('name', 'Marketing'); 
                    });

                } elseif ($safeRole === 'hrbp' || $safeRole === 'human resources business partner') {
                    // HRBP: Human Resources Dept only
                    $query->whereHas('department', function ($q) {
                        $q->where('name', 'Human Resources');
                    });

                } elseif (str_contains(strtoupper($safeRole), 'TL') || str_contains(strtoupper($safeRole), 'TEAM LEADER')) {
                    // All TLs: Only positions strictly under their own Department
                    if ($userDepartmentId) {
                        $query->where('department_id', $userDepartmentId);
                    } else {
                        $query->where('id', 0);
                    }

                } else {
                    // Failsafe: if role doesn't match anything above, return nothing.
                    $query->where('id', 0);
                }
            });
        }

        // 5. 🟢 DYNAMIC DEPARTMENT FILTERING 🟢
        // Automatically fetch only the departments that contain the user's allowed positions
        if (strtolower($roleName) === 'admin') {
            $departmentsQuery = Department::select('id', 'name')->orderBy('name');
        } else {
            // Clone the positions query so we don't consume it, then extract the unique department IDs
            $allowedDepartmentIds = (clone $positionsQuery)
                ->pluck('department_id')
                ->unique()
                ->filter() // Removes any nulls safely
                ->toArray();
                
            $departmentsQuery = Department::select('id', 'name')
                ->whereIn('id', $allowedDepartmentIds)
                ->orderBy('name');
        }

        return Inertia::render('HR/ManpowerRequest', [
            'branches' => $branchesQuery->get(),
            'departments' => $departmentsQuery->get(), 
            'positions' => $positionsQuery->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        Log::info('--- NEW MRF SUBMISSION STARTED ---', ['user' => Auth::user()->name, 'role' => Auth::user()->role->name]);

        try {
            // 1. 🟢 MODIFIED VALIDATION: Handle 'all' explicitly so it doesn't fail the 'exists' rule
            $branchValidation = $request->branch_id === 'all' ? 'required|string' : 'required|exists:branches,id';

            $validated = $request->validate([
                'branch_id' => $branchValidation,
                'department_id' => 'required|exists:departments,id',
                'position_id' => 'required|exists:positions,id',
                'is_budgeted' => 'required|boolean',
                'unbudgeted_purpose' => 'nullable|string',
                'headcount' => 'required|integer|min:1',
                'date_needed' => 'required|date',
                'educational_background' => 'required|string',
                'years_experience' => 'required|string',
                'skills_required' => 'required|string',
                'employment_status' => 'required|string',
                'reliever_info' => 'nullable|string',
                'purpose' => 'required|string',
                'is_new_position' => 'required|boolean',
                'job_description' => 'nullable|string',
                'is_replacement' => 'required|boolean',
                'replaced_employee_name' => 'nullable|string',
                'poc_name' => 'required|string',
            ]);

            Log::info('MARKER 2: Form validation passed successfully!');

            // 🟢 INTERCEPT "ALL BRANCH" AND SET TO NULL FOR THE DATABASE
            if ($validated['branch_id'] === 'all') {
                $validated['branch_id'] = null; 
            }

            $user = Auth::user();

            if (!$user->canCreateModule('manpower_requests_form')) {
                abort(403, 'Unauthorized to create manpower requests.');
            }

            // --- GET ALL ALLOWED BRANCHES FOR VALIDATION ---
            $primaryBranchId = $user->branch_id;
            $rotatingBranchIds = DB::table('branch_user')
                ->where('user_id', $user->id)
                ->pluck('branch_id')
                ->toArray();

            $allowedBranchIds = array_filter(array_unique(array_merge((array) $primaryBranchId, $rotatingBranchIds)));

            // 🟢 MODIFIED AUTH CHECK: Allow "All Branches" (null) to pass, otherwise verify branch access
            if (strtolower($user->role->name) !== 'admin') {
                if ($validated['branch_id'] !== null && !in_array($validated['branch_id'], $allowedBranchIds)) {
                    return back()->withErrors(['branch_id' => 'Unauthorized: You can only request manpower for your officially assigned branches.']);
                }
            }

            // 2. 🟢 THE NEW DYNAMIC WORKFLOW ROUTING 🟢
            $userRole = Auth::user()->role->name;

            $workflowPath = match($userRole) {
                'Clinic Assistant TL', 'Vet Tech TL' 
                    => ['Chief Vet', 'Operations Manager', 'Director of Corporate Services and Operations', 'HR'],
                'Chief Veterinarian', 'Cashier TL', 'Housekeeping TL', 'Inventory TL' 
                    => ['Operations Manager', 'Director of Corporate Services and Operations', 'HR'],
                'IT TL', 'HRBP', 'Marketing Manager', 'Operations Manager', 'Procurement TL', 'Auditor TL' 
                    => ['Director of Corporate Services and Operations', 'HR'],
                'Director of Corporate Services and Operations' 
                    => ['HR'],
                default => ['Director of Corporate Services and Operations', 'HR'],
            };

            Log::info('MARKER 3: Calculated Workflow Path', ['path' => $workflowPath]);

            // 3. Finalize data
            $validated['user_id'] = Auth::id();
            $validated['workflow_path'] = $workflowPath;
            $validated['current_step'] = 0; 
            $validated['requesting_manager_id'] = Auth::id();

            // 🟢 AUTO-APPROVE DCSO REQUESTS 🟢
            if (isset($workflowPath[0]) && $workflowPath[0] === 'HR') {
                $validated['status'] = 'Approved'; 
                $successMessage = "Request auto-approved and forwarded to HR for reference.";
            } else {
                $validated['status'] = 'Pending';
                $firstApprover = $workflowPath[0] ?? 'Unknown';
                $successMessage = "Manpower Request submitted and routed to the {$firstApprover} for approval.";
            }

            Log::info('MARKER 4: Attempting to save to database...');

            // 4. Save to database
            $newRequest = ManpowerRequest::create($validated);

            Log::info('MARKER 5: Successfully saved to database! Routing Notification...');

            // 5. 🟢 SEND THE NOTIFICATION TO THE FIRST APPROVER
            if ($validated['status'] === 'Pending') {
                $firstApproverRole = $workflowPath[0] ?? null;

                if ($firstApproverRole) {
                    $approversQuery = User::whereHas('role', function ($q) use ($firstApproverRole) {
                        $q->where('name', $firstApproverRole);
                    });

                    $globalRoles = ['Director of Corporate Services and Operations', 'HR', 'HRBP', 'Operations Manager'];
                    
                    // 🟢 MODIFIED: Only apply branch filtering if the request is NOT for "All Branches" (null)
                    if (!in_array($firstApproverRole, $globalRoles) && $validated['branch_id'] !== null) {
                        $approversQuery->where(function ($query) use ($validated) {
                            $query->where('branch_id', $validated['branch_id'])
                                  ->orWhereExists(function ($subquery) use ($validated) {
                                      $subquery->select(DB::raw(1))
                                               ->from('branch_user')
                                               ->whereColumn('branch_user.user_id', 'users.id')
                                               ->where('branch_user.branch_id', $validated['branch_id']);
                                  });
                        });
                    }

                    $approvers = $approversQuery->get();

                    if ($approvers->isNotEmpty()) {
                        Notification::send($approvers, new ManpowerRequestAlert($newRequest, $user->name));
                        $branchLog = $validated['branch_id'] ?? 'ALL BRANCHES';
                        Log::info("Notification sent to {$approvers->count()} users with role: {$firstApproverRole} for Branch ID: {$branchLog}");
                    } else {
                        Log::warning("No users found with role {$firstApproverRole} at Branch ID {$validated['branch_id']}.");
                    }
                }
            } elseif ($validated['status'] === 'Approved') {
                // If it was auto-approved (like a DCSO request), notify HR directly
                $hrUsers = User::whereHas('role', function ($q) {
                    $q->whereIn('name', ['HR', 'Human Resources', 'HRBP', 'Human Resources Business Partner']);
                })->get();

                if ($hrUsers->isNotEmpty()) {
                    Notification::send($hrUsers, new ManpowerRequestAlert($newRequest, $user->name));
                }
            }

            return redirect()->route('hr.manpower-requests.index')
                ->with('success', $successMessage);

        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::warning('MRF VALIDATION FAILED: User missed a required field.', $e->errors());
            throw $e; 
        } catch (\Throwable $e) { 
            Log::error('MRF SUBMISSION CRASH: ' . $e->getMessage());
            Log::error('FILE: ' . $e->getFile() . ' on line ' . $e->getLine());
            
            dd([
                'CRASH REASON' => $e->getMessage(),
                'FILE' => $e->getFile(),
                'LINE' => $e->getLine()
            ]);
        }
    }

    // ----------------------------------------------------------------------
    // 2. THE DASHBOARDS (Approval Board & Staff Overview)
    // ----------------------------------------------------------------------
    public function index()
    {
        $user = Auth::user();
        $userRole = $user->role->name ?? '';

        $query = ManpowerRequest::with([
            'requester:id,name', 
            'branch:id,name', 
            'department:id,name', 
            'position:id,name',
        ]);

        if (in_array($userRole, ['TL', 'Marketing Manager'])) {
            $query->where('user_id', $user->id);
            
        } elseif (in_array($userRole, ['admin', 'HR','HRBP' ,'Director of Corporate Services and Operations'])) {
            // High-level roles pull everything.
        } else {
            $primaryBranchId = $user->branch_id;
            $rotatingBranchIds = DB::table('branch_user')->where('user_id', $user->id)->pluck('branch_id')->toArray();
            $allowedBranchIds = array_filter(array_unique(array_merge((array) $primaryBranchId, $rotatingBranchIds)));

            $query->where(function ($q) use ($user, $userRole, $allowedBranchIds) {
                $q->where('user_id', $user->id)
                  ->orWhere(function ($subQ) use ($userRole, $allowedBranchIds) {
                      $subQ->whereJsonContains('workflow_path', $userRole);
                      if ($userRole !== 'Operations Manager') {
                          $subQ->where(function($branchQuery) use ($allowedBranchIds) {
                              $branchQuery->whereIn('branch_id', $allowedBranchIds)
                                          ->orWhereNull('branch_id');
                          });
                      }
                  });
            });
        }

        // 🟢 FETCH ALL BRANCHES TO SEND TO REACT
        $allBranches = Branch::select('id', 'name')->orderBy('name')->get();

        return Inertia::render('HR/Admin/ApprovalRequest', [
            'requests' => $query->latest()->get(),
            'userRole' => $userRole, 
            'branches' => $allBranches, // 🟢 PASS THEM HERE
        ]);
    }

    // ----------------------------------------------------------------------
    // 3. THE 3-STAGE APPROVAL WORKFLOW
    // ----------------------------------------------------------------------
    public function updateStatus(Request $request, ManpowerRequest $manpowerRequest)
    {
        // 🟢 1. Update Validation to require a reason if Rejected
        $request->validate([
            'status' => 'required|in:Approved,Rejected',
            'rejection_reason' => 'required_if:status,Rejected|nullable|string' 
        ]);

        $requesterName = $manpowerRequest->requester->name ?? 'An Employee';
        $originalRequester = $manpowerRequest->requester;
        
        $currentUserRole = Auth::user()->role->name ?? '';
        $currentApproverRole = $currentUserRole ?: 'Management';
        
        // 🟢 CHECK FOR EXECUTIVE OVERRIDE
        $isExecutiveOverride = strtolower(trim($currentUserRole)) === 'director of corporate services and operations' 
                            || strtolower(trim($currentUserRole)) === 'admin';

        // ==========================================
        // HANDLE REJECTIONS
        // ==========================================
        if ($request->status === 'Rejected') {
            $manpowerRequest->update([
                'status' => 'Rejected',
                'rejection_reason' => $request->rejection_reason
            ]);
            
            if ($originalRequester) {
                $overrideText = $isExecutiveOverride ? "(Executive Override)" : "";
                $originalRequester->notify(new ManpowerStatusAlert($manpowerRequest, "Rejected by {$currentApproverRole} {$overrideText}. Reason: " . $request->rejection_reason));
            }

            return back()->with('success', "Request has been officially rejected.");
        } 
        
        // ==========================================
        // HANDLE APPROVALS
        // ==========================================
        if ($request->status === 'Approved') {
            $workflowPath = $manpowerRequest->workflow_path;
            
            // 🟢 IF EXECUTIVE OVERRIDE: Jump straight to HR
            if ($isExecutiveOverride) {
                // Find the index of HR in the path, or default to the end
                $hrIndex = array_search('HR', $workflowPath);
                $finalStep = $hrIndex !== false ? $hrIndex : count($workflowPath) - 1;

                $manpowerRequest->update([
                    'current_step' => $finalStep,
                    'status' => 'Approved' 
                ]);

                // Alert HR immediately
                $hrUsers = User::whereHas('role', function ($q) {
                    $q->whereIn('name', ['HR', 'Human Resources', 'HRBP', 'Human Resources Business Partner']);
                })->get();

                if ($hrUsers->isNotEmpty()) {
                    Notification::send($hrUsers, new ManpowerRequestAlert($manpowerRequest, $requesterName));
                }

                // Tell the user it reached the finish line
                if ($originalRequester) {
                    $originalRequester->notify(new ManpowerStatusAlert($manpowerRequest, "Fully Approved by Executive Override ({$currentApproverRole})! Forwarded to HR."));
                }

                return back()->with('success', "Executive Override Applied. Request fully approved and forwarded to HR.");
            }

            // 🟢 STANDARD WORKFLOW PROGRESSION
            $nextStep = $manpowerRequest->current_step + 1;
            $totalSteps = count($workflowPath);
            $humanReadableStep = $nextStep + 1; 

            if (isset($workflowPath[$nextStep]) && $workflowPath[$nextStep] === 'HR') {
                $manpowerRequest->update([
                    'current_step' => $nextStep,
                    'status' => 'Approved' 
                ]);

                // 1. Alert HR
                $hrUsers = User::whereHas('role', function ($q) {
                    $q->whereIn('name', ['HR', 'Human Resources', 'HRBP', 'Human Resources Business Partner']);
                })->get();

                if ($hrUsers->isNotEmpty()) {
                    Notification::send($hrUsers, new ManpowerRequestAlert($manpowerRequest, $requesterName));
                }

                // 2. Tell the user it reached the absolute finish line
                if ($originalRequester) {
                    $originalRequester->notify(new ManpowerStatusAlert($manpowerRequest, "Fully Approved by {$currentApproverRole}! Forwarded to HR."));
                }

                return back()->with('success', "Final approval granted. Forwarded to HR for reference.");
            
            } else {
                $manpowerRequest->update(['current_step' => $nextStep]);
                $nextRole = $workflowPath[$nextStep];

                $nextApproversQuery = User::whereHas('role', function ($q) use ($nextRole) {
                    $q->where('name', $nextRole);
                });

                $globalRoles = ['Director of Corporate Services and Operations', 'HR', 'HRBP', 'Operations Manager'];
                
                // Skip branch check if it's an "All Branches" (null) request
                if (!in_array($nextRole, $globalRoles) && $manpowerRequest->branch_id !== null) {
                    $nextApproversQuery->where(function ($query) use ($manpowerRequest) {
                        $query->where('branch_id', $manpowerRequest->branch_id)
                              ->orWhereExists(function ($subquery) use ($manpowerRequest) {
                                  $subquery->select(DB::raw(1))
                                           ->from('branch_user')
                                           ->whereColumn('branch_user.user_id', 'users.id')
                                           ->where('branch_user.branch_id', $manpowerRequest->branch_id);
                              });
                    });
                }

                $nextApprovers = $nextApproversQuery->get();

                if ($nextApprovers->isNotEmpty()) {
                    Notification::send($nextApprovers, new ManpowerRequestAlert($manpowerRequest, $requesterName));
                }

                // 3. Give the user the exact progress breakdown!
                if ($originalRequester) {
                    $detailedMessage = "Approved by {$currentApproverRole}. Forwarded to {$nextRole} (Step {$humanReadableStep} of {$totalSteps}).";
                    $originalRequester->notify(new ManpowerStatusAlert($manpowerRequest, $detailedMessage));
                }

                return back()->with('success', "Endorsed and forwarded to the {$nextRole}.");
            }
        }
    }
}