<?php
// Purchase request controller: manage PR lifecycle

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Supplier;
use App\Models\PurchaseRequest;
use App\Models\Branch;
use App\Models\Department;
use App\Models\User;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;
use App\Notifications\PendingApprovalNotification;
use App\Notifications\PRPOCcStatusUpdate;

class PurchaseRequestController extends Controller
{
    // =====================================================================
    // CREATE REQUEST (Frontend Form)
    // =====================================================================
    public function create()
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        $userBranches = $user->branches()->pluck('name')->toArray();

        $suppliers = Supplier::select('id', 'name')->get();
        $products = Product::select('id', 'name', 'supplier_id', 'details', 'unit', 'price')->get();
        $branches = Branch::select('id', 'name')->get();
        $departments = Department::select('id', 'name')->get();
        $employees = User::with('branches:id,name')
                        ->where('id', '!=', Auth::id())
                        ->select('id', 'name')
                        ->orderBy('name')
                        ->get();

        return Inertia::render('PRPO/CreatePR', [
            'suppliers' => $suppliers,
            'products' => $products,
            'branches' => $branches,
            'departments' => $departments,
            'userBranches' => $userBranches,
            'employees' => $employees,
        ]);
    }

    // =====================================================================
    // STORE REQUEST (Save to Database)
    // =====================================================================
   public function store(Request $request)
    {
        // 🔐 ACL CHECK: Verify user can CREATE purchase_requests
        // Permission Hierarchy: Full = Create/Edit/Delete, Edit = Create/Approve/Reject
        $user = Auth::user();
        if (!$user->canCreateModule('purchase_requests')) {
            abort(403, 'You do not have permission to create purchase requests.');
        }

        $validated = $request->validate([
            'branch' => 'required|string|max:255',
            'department' => 'required|string|max:255',
            'date_prepared' => 'required|date',
            'request_type' => 'nullable|string|max:255',
            'priority' => 'nullable|string|max:255',
            'date_needed' => 'nullable|date|after_or_equal:today', 
            'budget_status' => 'nullable|string|max:255',
            'budget_ref' => 'nullable|string|max:255',
            'purpose_of_request' => 'nullable|string',
            'impact_if_not_procured' => 'nullable|string',
            'cc_user_id' => 'nullable|exists:users,id',

            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.supplier_id' => 'nullable|exists:suppliers,id',
            'items.*.specifications' => 'nullable|string|max:255',
            'items.*.unit' => 'nullable|string|max:50',
            'items.*.qty_requested' => 'required|numeric|min:0',
            'items.*.qty_on_hand' => 'nullable|numeric|min:0',
            'items.*.reorder_level' => 'nullable|numeric|min:0',
            'items.*.est_unit_cost' => 'nullable|numeric|min:0',
            'items.*.total_cost' => 'nullable|numeric|min:0',
        ], [
            'date_needed.after_or_equal' => 'The date needed cannot be a past date.',
        ]);

        $userRoleId = $user->role_id;

        $initialStatus = 'pending_inv_tl';

        $isGreenhillsAssistant =
            $userRoleId === 19 &&
            $validated['branch'] === 'Greenhills';

        $isInventoryTL = $userRoleId === 15;

        if ($isGreenhillsAssistant || $isInventoryTL) {
            $initialStatus = 'pending_ops_manager';
        }
        
        DB::transaction(function () use ($validated, $initialStatus) {
            
            $pr = PurchaseRequest::create([
                'user_id' => Auth::id(), 
                'branch' => $validated['branch'],
                'department' => $validated['department'],
                'date_prepared' => $validated['date_prepared'],
                'request_type' => $validated['request_type'],
                'priority' => $validated['priority'],
                'date_needed' => $validated['date_needed'],
                'budget_status' => $validated['budget_status'],
                'budget_ref' => $validated['budget_ref'],
                'purpose_of_request' => $validated['purpose_of_request'],
                'impact_if_not_procured' => $validated['impact_if_not_procured'],
                'status' => $initialStatus,
                'cc_user_id' => $validated['cc_user_id'] ?? null,
            ]);

            foreach ($validated['items'] as $item) {
                $pr->items()->create($item);
            }

            $this->notifyNextApprovers($pr);

           // 🟢 1. Initialize a collection for all CC recipients
            $ccRecipients = collect();

            // Add the manual CC user if one was selected
            if ($pr->cc_user_id) {
                $manualCc = User::find($pr->cc_user_id);
                if ($manualCc) {
                    $ccRecipients->push($manualCc);
                }
            }

            // 🟢 2. Automatically fetch all Auditors
            $auditors = User::whereHas('role', function ($query) {
                $query->whereIn('name', ['Auditor TL', 'Audit Assistant']);
            })->get();

            // 🟢 3. Merge them together and remove duplicates 
            $allCcUsers = $ccRecipients->merge($auditors)->unique('id');

            // 🟢 4. Send the notification to everyone in the list
            foreach ($allCcUsers as $recipient) {
                $reason = $recipient->id == $pr->cc_user_id 
                    ? "You were CC'd on a new Purchase Request by " . Auth::user()->name
                    : "A new Purchase Request was submitted for Audit review by " . Auth::user()->name;

                $recipient->notify(new PRPOCcStatusUpdate($pr, 'PR', $reason));
            }
            
        });

        return redirect()->route('prpo.approval-board', ['view' => 'my_requests'])
                        ->with('success', 'Purchase Request submitted successfully!');
    }

    // =====================================================================
    // APPROVAL BOARD (View Requests based on Role)
    // =====================================================================
  public function approvalBoard(Request $request)
    {
        $user = Auth::user();
        $userRole = strtolower(trim($user->role->name ?? ''));
        $userBranches = $user->branches()->pluck('name')->toArray(); 
        
        $isAssistant = str_contains($userRole, 'assist');
        $isAdmin = str_contains($userRole, 'admin');
        $isEVP = str_contains($userRole, 'evp') || str_contains($userRole, 'president') || $user->role_id === 9;

        $defaultView = $isAssistant ? 'my_requests' : 'for_approval';
        $view = $request->query('view', $defaultView);

        $query = PurchaseRequest::with(['user', 'cc_user', 'items.product', 'items.supplier', 'purchaseOrders'])->latest();

        // =========================================================
        // 1. MY REQUESTS (Creator-based, NO exclusions)
        // =========================================================
        if ($view === 'my_requests') {
            $query->where('user_id', $user->id);
        } 
        // =========================================================
        // 2. FOR APPROVAL (Strictly role-based)
        // =========================================================
        elseif ($view === 'for_approval') {
            $query->where(function ($q) use ($userRole, $isEVP, $isAdmin) {
                if ($isAdmin) {
                    $q->whereIn('status', ['pending_inv_tl', 'pending_ops_manager', 'pending_procurement_tl']);
                } else {
                    if (str_contains($userRole, 'inventory tl')) {
                        $q->orWhere('status', 'pending_inv_tl');
                    }
                    if (str_contains($userRole, 'operations') || str_contains($userRole, 'ops manager') || $isEVP) {
                        $q->orWhere('status', 'pending_ops_manager');
                    }
                    if (str_contains($userRole, 'procurement tl') || str_contains($userRole, 'procurement team leader')) {
                        $q->orWhere('status', 'pending_procurement_tl');
                    }
                }
            });

            // Branch restriction
            if (!$isAdmin && !$isEVP && !empty($userBranches)) {
                $query->whereIn('branch', $userBranches);
            }
        } 
        // =========================================================
        // 3. PO GENERATION (Waiting for PO drafting)
        // =========================================================
        elseif ($view === 'for_generation') {
            if ($isAdmin || str_contains($userRole, 'procurement') || $isEVP) {
                $query->where('status', 'pending_procurement');
            } else {
                $query->whereRaw('1 = 0');
            }
        } 
        // =========================================================
        // 4. PO GENERATED (POs successfully drafted)
        // =========================================================
        elseif ($view === 'po_generated') {
            if ($isAdmin || str_contains($userRole, 'procurement') || $isEVP) {
                $query->where('status', 'po_generated');
            } else {
                $query->whereRaw('1 = 0');
            }
        } 
        // =========================================================
        // 5. HISTORY (Global Archive)
        // =========================================================
        elseif ($view === 'history') {
            $query->whereIn('status', ['po_generated', 'rejected', 'cancelled', 'approved']);
            
            if (!$isAdmin && !$isEVP && !empty($userBranches)) {
                $query->whereIn('branch', $userBranches);
            }
        } 
        else {
            $query->whereRaw('1 = 0');
        }

        $requests = $query->paginate(15)->withQueryString();

        // Fetch lookup data for modals
        $suppliers = Supplier::select('id', 'name')->get();
        $products = Product::select('id', 'name', 'supplier_id', 'details', 'unit', 'price')->get();
        $branches = Branch::select('id', 'name')->get();
        $departments = Department::select('id', 'name')->get();
        $employees = User::with('branches:id,name')->where('id', '!=', Auth::id())->select('id', 'name')->orderBy('name')->get();

        return Inertia::render('PRPO/ApprovalBoard', [
            'requests' => $requests,
            'currentView' => $view,
            'userBranches' => $userBranches, 
            'isAssistant' => $isAssistant, 
            'canSeeAll' => $isAdmin || str_contains($userRole, 'director'),
            'suppliers' => $suppliers,
            'products' => $products,
            'branches' => $branches,
            'departments' => $departments,
            'employees' => $employees,
        ]);
    }

    // =====================================================================
    // UPDATE STATUS (Approve / Reject Logic)
    // =====================================================================
    public function updateStatus(Request $request, PurchaseRequest $purchaseRequest)
{
    // =====================================================================
    // 1. AUTHENTICATED USER + ACTION
    // =====================================================================
    $user = Auth::user();
    $action = $request->input('action');

    // =====================================================================
    // 2. VALIDATE REQUEST
    // =====================================================================
    $validated = $request->validate([
        'action' => 'required|in:approve,reject,cancel,return_to_inv_tl,return_to_creator,approve_as_om_fallback',

        'rejection_reason' =>
            'required_if:action,reject' .
            '|required_if:action,return_to_inv_tl' .
            '|required_if:action,return_to_creator' .
            '|nullable|string',
    ]);

    // =====================================================================
    // 3. PERMISSION CHECK
    // =====================================================================

    if (in_array($action, ['approve', 'approve_as_om_fallback'], true)) {

        if (!$user->canApproveModule('purchase_requests')) {
            abort(
                403,
                'You do not have permission to approve purchase requests.'
            );
        }

    } elseif (in_array(
        $action,
        ['reject', 'return_to_inv_tl', 'return_to_creator'],
        true
    )) {

        if (!$user->canRejectModule('purchase_requests')) {
            abort(
                403,
                'You do not have permission to reject purchase requests.'
            );
        }

    } elseif ($action === 'cancel') {

        if (!$user->canDeleteModule('purchase_requests')) {
            abort(
                403,
                'You do not have permission to cancel purchase requests.'
            );
        }
    }

    // =====================================================================
    // 4. EVP APPROVAL ON BEHALF OF UNAVAILABLE OM
    // =====================================================================
    if ($action === 'approve_as_om_fallback') {
        
        $userRole = strtolower(trim($user->role->name ?? ''));
        $isExecutive = str_contains($userRole, 'evp') || str_contains($userRole, 'president') || $user->role_id === 9 || $userRole === 'admin';

        if (!$isExecutive) {
            abort(403, 'Only the Executive Vice President can approve on behalf of the Operations Manager.');
        }

        // This action is only valid when the PR is waiting for OM approval.
        if ($purchaseRequest->status !== 'pending_ops_manager') {
            abort(403, 'This Purchase Request is not awaiting Operations Manager approval.');
        }

        // EVP approves on behalf of unavailable OM. Proceeds to Procurement TL.
        $purchaseRequest->status = 'pending_procurement_tl';
        $purchaseRequest->is_evp_override = true;
        $purchaseRequest->rejection_reason = null;
        $purchaseRequest->save();

        // Notify Procurement TL + requester.
        $this->notifyNextApprovers($purchaseRequest);

        return back()->with('success', 'Purchase request approved on behalf of the unavailable Operations Manager. Forwarded to Procurement Team Leader.');
    }

    // ... [Keep Return/Reject logic intact] ...

    // =====================================================================
    // 7. STANDARD APPROVE
    // =====================================================================
    if ($action === 'approve') {
        
    // 1. Authenticate user and explicitly define $role
        $user = Auth::user();
        $role = strtolower(trim($user->role->name ?? ''));
        $isExecutive = $role === 'admin' || str_contains($role, 'evp') || str_contains($role, 'president');

        // 2. Verify the user has jurisdiction at the CURRENT stage
        $canApprove = match($purchaseRequest->status) {
            'pending_inv_tl' => str_contains($role, 'inventory tl') || $isExecutive,
            'pending_ops_manager' => str_contains($role, 'operations') || str_contains($role, 'ops manager') || $isExecutive,
            
            // 🟢 STRICT ACL: Only Proc TL or Executive can Endorse
            'pending_procurement_tl' => str_contains($role, 'procurement tl') || $isExecutive,
            default => false,
        };

        if (!$canApprove) {
            abort(403, 'You do not have permission to approve the request at its current stage.');
        }
        // 1. Verify the user has jurisdiction at the CURRENT stage
        $canApprove = match($purchaseRequest->status) {
            'pending_inv_tl' => str_contains($role, 'inventory tl') || $isExecutive,
            'pending_ops_manager' => str_contains($role, 'operations') || str_contains($role, 'ops manager') || $isExecutive,
            
            // 🟢 STRICT ACL: Only Proc TL or Executive can Endorse
            'pending_procurement_tl' => str_contains($role, 'procurement tl') || $isExecutive,
            default => false,
        };

        if (!$canApprove) {
            abort(403, 'You do not have permission to approve the request at its current stage.');
        }

        // 2. Progress the status logically based on where it is NOW
        if ($purchaseRequest->status === 'pending_inv_tl') {
            $purchaseRequest->status = 'pending_ops_manager';
            $message = 'Purchase request forwarded to the Operations Manager.';
            
        } elseif ($purchaseRequest->status === 'pending_ops_manager') {
            
            if (str_contains($role, 'evp') || str_contains($role, 'president')) {
                $purchaseRequest->is_evp_override = true;
                
                // Optional: Capture the user's name for the UI override marker
                $purchaseRequest->approved_by_name = $user->name; 
            }
            
            // 🟢 FORWARDS TO PROCUREMENT TL
            $purchaseRequest->status = 'pending_procurement_tl';
            $message = 'Purchase request approved. Forwarded to Procurement Team Leader for Endorsement.';
            
        } elseif ($purchaseRequest->status === 'pending_procurement_tl') {
            
            // 🟢 TL ENDORSES -> PUSHES TO PO GENERATION QUEUE
            $purchaseRequest->status = 'pending_procurement';
            $message = 'Purchase request endorsed by Procurement TL. It is now ready for PO Generation.';
        }

        $purchaseRequest->save();
        $this->notifyNextApprovers($purchaseRequest);
        
        return back()->with('success', $message);
    }

    // =====================================================================
    // 5. RETURN TO INVENTORY TL
    // =====================================================================

    if ($action === 'return_to_inv_tl') {

        $purchaseRequest->status = 'pending_inv_tl';
        $purchaseRequest->rejection_reason = $validated['rejection_reason'];

        $message = 'Purchase request returned to Inventory TL for corrections.';

        $purchaseRequest->save();

        // Find Inventory TLs for this branch.
        $invTeam = User::whereHas('role', function ($q) {
            $q->where('name', 'Inventory TL');
        })
        ->whereHas('branches', function ($q) use ($purchaseRequest) {
            $q->where('name', $purchaseRequest->branch);
        })
        ->get();

        if ($invTeam->isNotEmpty()) {

            $alertMessage =
                "PR from {$purchaseRequest->department} ({$purchaseRequest->branch}) "
                . "was returned to Inventory TL for corrections.";

            Notification::send(
                $invTeam->unique('id'),
                new PendingApprovalNotification(
                    $purchaseRequest,
                    $alertMessage
                )
            );
        }

        return back()->with('success', $message);
    }

    // =====================================================================
    // 6. RETURN TO GREENHILLS INVENTORY ASSISTANT
    // =====================================================================

    if ($action === 'return_to_creator') {

        $purchaseRequest->status =
        strtolower($purchaseRequest->branch) === 'greenhills'
            ? 'pending_ops_manager'
            : 'pending_inv_tl';

        $purchaseRequest->rejection_reason =
        $validated['rejection_reason'];

        $message =
            'Purchase request returned to the Greenhills Inventory Assistant for corrections.';

        $purchaseRequest->save();

        // Find Inventory Assistants for this branch.
        $assistants = User::whereHas('role', function ($q) {
            $q->where('name', 'like', '%Inventory Assist%');
        })
        ->whereHas('branches', function ($q) use ($purchaseRequest) {
            $q->where('name', $purchaseRequest->branch);
        })
        ->get();

        if ($assistants->isNotEmpty()) {

            $alertMessage =
                "Your PR from {$purchaseRequest->department} ({$purchaseRequest->branch}) "
                . "was returned by the Operations Manager for corrections.";

            Notification::send(
                $assistants->unique('id'),
                new PendingApprovalNotification(
                    $purchaseRequest,
                    $alertMessage
                )
            );
        }

        return back()->with('success', $message);
    }

    // =====================================================================
    // 7. STANDARD APPROVE
    // =====================================================================

    if ($action === 'approve') {

    switch ($purchaseRequest->status) {

        // -------------------------------------------------------------
        // Inventory TL
        // -------------------------------------------------------------
        case 'pending_inv_tl':

            $userRole = strtolower(
                $user->role->role_name ?? ''
            );

            $isInventoryTL = str_contains(
                $userRole,
                'inventory tl'
            );

            $isEVP = $user->role_id === 9;

            $isGreenhills = strtolower(
                trim($purchaseRequest->branch ?? '')
            ) === 'greenhills';

            // Inventory TL can approve normally
            // EVP can act as fallback ONLY for Greenhills
            if (
                !$isInventoryTL &&
                !($isEVP && $isGreenhills) &&
                $user->role_id !== 1
            ) {
                abort(
                    403,
                    'Only the Inventory Team Leader can approve this request. EVP fallback is only allowed for Greenhills.'
                );
            }

            $purchaseRequest->status = 'pending_ops_manager';
            $purchaseRequest->rejection_reason = null;

            if ($isEVP && $isGreenhills) {
                $message = 'Purchase request approved by the Executive Vice President as Inventory Team Leader fallback for Greenhills and forwarded to the Operations Manager.';
            } else {
                $message = 'Purchase request approved by Inventory Team Lead and forwarded to the Operations Manager.';
            }

            break;

        // -------------------------------------------------------------
        // Operations Manager OR EVP Fallback (FINAL PR APPROVAL)
        // -------------------------------------------------------------
        case 'pending_ops_manager':

            $userRole = strtolower(
                $user->role->role_name ?? ''
            );

            $isOperationsManager =
                str_contains($userRole, 'operations') ||
                str_contains($userRole, 'ops manager');

            $isExecutive = $user->role_id === 9;

            if (!$isOperationsManager && !$isExecutive) {
                abort(
                    403,
                    'Only the Operations Manager or Executive Vice President (fallback) can approve at this stage.'
                );
            }

            // 🟢 UPDATED: Skip Procurement Approval and finalize the PR
            $purchaseRequest->status = 'approved';
            $purchaseRequest->rejection_reason = null;

            if ($isEVP) {
                $message = 'Purchase request approved by the Executive Vice President as Operations Manager fallback. It is now ready for PO Generation.';
            } else {
                $message = 'Purchase request approved by Operations Manager. It is now ready for PO Generation.';
            }

            break;

        default:

            return back()->with(
                'error',
                'Purchase request cannot be approved from its current status.'
            );
    }

    $purchaseRequest->save();

    $this->notifyNextApprovers($purchaseRequest);

    return back()->with('success', $message);
}

    // =====================================================================
    // 8. CANCEL
    // =====================================================================

    if ($action === 'cancel') {

        $purchaseRequest->status = 'cancelled';

        $purchaseRequest->save();

        $this->notifyNextApprovers($purchaseRequest);

        return back()->with(
            'success',
            'Purchase request has been cancelled.'
        );
    }

    // =====================================================================
    // 9. STANDARD REJECTION
    // =====================================================================

    if ($action === 'reject') {

        $purchaseRequest->status = 'rejected';
        $purchaseRequest->rejection_reason = $validated['rejection_reason'];

        $message = 'Purchase request has been rejected.';

        $purchaseRequest->save();

        $this->notifyNextApprovers($purchaseRequest);

        return back()->with('success', $message);
    }

    // =====================================================================
    // 10. CC USER STATUS NOTIFICATION
    // =====================================================================

    $ccUser = $purchaseRequest->cc_user;

    if ($ccUser) {

        $ccUser->notify(
            new PRPOCcStatusUpdate(
                $purchaseRequest,
                'PR',
                "A Purchase Request you are copied on was {$action}."
            )
        );
    }

    return back()->with(
        'success',
        'Purchase Request status updated successfully.'
    );
}

    public function index(Request $request)
{
    $user = Auth::user();
    $userRole = strtolower(trim($user->role->name ?? ''));
    $view = $request->query('view', 'active_prs'); // Set default tab

    $query = PurchaseRequest::with(['user', 'items.product', 'purchaseOrders']);

    if ($view === 'active_prs') {
        // Show PRs created by the user for them to monitor
        $query->where('user_id', $user->id)
            ->whereNotIn('status', ['po_generated', 'cancelled', 'rejected']);
    } elseif ($view === 'for_approval') {
        // Show PRs awaiting the user's specific role approval
        if (str_contains($userRole, 'inventory tl')) {
            $query->where('status', 'pending_inv_tl');
        } elseif (str_contains($userRole, 'operations') || str_contains($userRole, 'evp')) {
            $query->where('status', 'pending_ops_manager');
        }
    } elseif ($view === 'for_generation') {
        // Show approved PRs waiting for Procurement to draft POs
        $query->where('status', 'pending_procurement');
    } elseif ($view === 'approved_prs') {
        // Show historical completed PRs
        $query->whereIn('status', ['po_generated']);
    }

    $requests = $query->latest()->paginate(15)->withQueryString();

    return Inertia::render('PRPO/ApprovalBoard', [
        'requests' => $requests,
        'currentView' => $view,
    ]);
}

    public function print(PurchaseRequest $purchaseRequest)
    {
        $purchaseRequest->load(['user','cc_user', 'items.product', 'items.supplier']);

        return Inertia::render('PRPO/PrintablePR', [
            'pr' => $purchaseRequest
        ]);
    }

    private function notifyNextApprovers(PurchaseRequest $pr)
    {
    // Always notify the original requester
    $usersToNotify = collect([$pr->user]);
    $message = '';

    if ($pr->status === 'pending_inv_tl') {

        // Standard branches:
        // Inventory Assistant → Inventory TL
        $approvers = User::whereHas('role', function ($q) {
            $q->where('name', 'Inventory TL');
        })
        ->whereHas('branches', function ($q) use ($pr) {
            $q->where('name', $pr->branch);
        })
        ->get();

        $usersToNotify = $usersToNotify->merge($approvers);

        $message = "PR from {$pr->department} ({$pr->branch}) is now pending Inventory Team Lead approval.";

    } elseif ($pr->status === 'pending_ops_manager') {

        // Greenhills skips Inventory TL and goes directly here.
        // Standard branches arrive here after Inventory TL approval.

        $approvers = User::whereHas('role', function ($q) {
            $q->where('name', 'Operations Manager');
        })
        ->whereHas('branches', function ($q) use ($pr) {
            $q->where('name', $pr->branch);
        })
        ->get();

        $usersToNotify = $usersToNotify->merge($approvers);

        $message = "PR from {$pr->department} ({$pr->branch}) is now pending Operations Manager approval.";

    } elseif ($pr->status === 'approved') {

        // 🟢 UPDATED: PR is now fully approved! Notify Procurement to draft the PO.
        $procurementTeam = User::whereHas('role', function($q) {
            $q->where('name', 'like', '%procurement%');
        })->get();

        $usersToNotify = $usersToNotify->merge($procurementTeam);

        $message = "PR from {$pr->department} ({$pr->branch}) has received final approval and is ready for Purchase Order generation.";

    } elseif ($pr->status === 'rejected') {

        $message = "PR from {$pr->department} ({$pr->branch}) was rejected.";

    } elseif ($pr->status === 'cancelled') {

        $message = "PR from {$pr->department} ({$pr->branch}) was cancelled.";
    }

    // Keep CC notifications
    if (!empty($pr->cc_users)) {
        $ccUsers = User::whereIn('id', $pr->cc_users)->get();
        $usersToNotify = $usersToNotify->merge($ccUsers);
    }

    // Remove duplicate users
    $usersToNotify = $usersToNotify->unique('id');

    // Send notifications
    if ($usersToNotify->isNotEmpty()) {
        Notification::send(
            $usersToNotify,
            new PendingApprovalNotification($pr, $message)
        );
        }
    }
}