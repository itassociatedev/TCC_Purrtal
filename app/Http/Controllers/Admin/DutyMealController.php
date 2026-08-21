<?php
// Duty meal scheduling, participants and approval handling

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DutyMeal;
use App\Models\DutyMealParticipant;
use App\Models\Branch;
use App\Models\User;
use App\Models\Department;
use App\Models\Position;
use App\Models\SystemLog; // 🟢 INJECTED FOR LOGGING
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;
use Carbon\Carbon;
use App\Notifications\DutyMealRosterCreated;
use App\Exports\DutyMealExport;
use Maatwebsite\Excel\Facades\Excel;

class DutyMealController extends Controller
{
    // ... [index and create functions remain exactly the same, omitting them here for space, keep your original ones!] ...
    
    public function index()
    {
        $user = Auth::user();

        // 🔐 INTELLIGENT PERMISSION-BASED REDIRECT
        // If user has overview access, show overview
        // Otherwise redirect to the first section they have access to
        if (!$user->canViewModule('duty_meal')) {
            // User doesn't have overview access - redirect to first available section
            if ($user->canViewModule('duty_meal_setup_roster')) {
                return redirect()->route('admin.duty-meals.create');
            } elseif ($user->canViewModule('duty_meal_archive')) {
                return redirect()->route('admin.duty-meals.archive');
            } else {
                // No access to any duty meal section
                return redirect()->route('dashboard')
                    ->with('error', 'You do not have permission to access the Duty Meal module.');
            }
        }

        $today = now()->startOfDay();
        
        // 🟢 NEW LOGIC: Lock the whole group if the FIRST day is within 3 days
        $lockDateThreshold = now()->addDays(3)->startOfDay();

        $unlockedMeals = DutyMeal::where('is_locked', false)->orderBy('branch_id')->orderBy('duty_date')->get();
        $mealsToLock = [];

        // Group the meals by branch to find continuous "blocks" or "weeks"
        $groupedByBranch = $unlockedMeals->groupBy('branch_id');

        foreach ($groupedByBranch as $branchId => $meals) {
            // We assume a block is contiguous if the dates are within 7 days of each other.
            // If the FIRST meal of a block is <= the threshold, the whole block locks.
            
            $currentBlockStart = null;
            $currentBlockMeals = [];

            foreach ($meals as $meal) {
                $mealDate = Carbon::parse($meal->duty_date)->startOfDay();
                if ($currentBlockStart === null) $currentBlockStart = $mealDate;

                // If this meal is more than 7 days from the start of the block, it's a NEW block
                if ($mealDate->diffInDays($currentBlockStart) > 7) {
                    // Check if the previous block should be locked
                    if ($currentBlockStart <= $lockDateThreshold) {
                        $mealsToLock = array_merge($mealsToLock, $currentBlockMeals);
                    }
                    // Start new block
                    $currentBlockStart = $mealDate;
                    $currentBlockMeals = [];
                }

                $currentBlockMeals[] = $meal->id;
            }

            // Check the final block
            if ($currentBlockStart !== null && $currentBlockStart <= $lockDateThreshold) {
                $mealsToLock = array_merge($mealsToLock, $currentBlockMeals);
            }
        }

        // Apply the lock to the calculated group
        if (!empty($mealsToLock)) {
            DutyMeal::whereIn('id', $mealsToLock)->update(['is_locked' => true]);
        }

        $lockedMealIds = DutyMeal::where('is_locked', true)->whereDate('duty_date', '>=', $today)->pluck('id');
            
        if ($lockedMealIds->isNotEmpty()) {
            DutyMealParticipant::whereIn('duty_meal_id', $lockedMealIds)->where('choice', 'none')->update(['choice' => 'main']);
        }

        // 3. Catch-all for past meals
        $pastMealIds = DutyMeal::whereDate('duty_date', '<', $today)->pluck('id');
        if ($pastMealIds->isNotEmpty()) {
            DutyMealParticipant::whereIn('duty_meal_id', $pastMealIds)->where('choice', 'none')->update(['choice' => 'main']);
        }
        
        $allowedBranchIds = $user->branches->pluck('id')->push($user->branch_id)->filter()->unique();

        $dutymeals = DutyMeal::with(['branch', 'participants.user:id,name'])
        ->when($user->role_id !== 1, function ($query) use ($allowedBranchIds) {
            $query->whereIn('branch_id', $allowedBranchIds);
        })
        ->whereDate('duty_date', '>=', now()->startOfMonth())
        ->withCount('participants')->latest('duty_date')->get();

        $employees = User::with(['department:id,name', 'position:id,name'])
            ->select('id', 'name', 'department_id', 'position_id', 'branch_id')
            ->when($user->role_id !== 1, function ($query) use ($allowedBranchIds) {
                $query->where(function ($q) use ($allowedBranchIds) {
                    $q->whereIn('branch_id', $allowedBranchIds)
                      ->orWhereHas('branches', function ($pivotQuery) use ($allowedBranchIds) {
                          $pivotQuery->whereIn('branch_id', $allowedBranchIds);
                      });
                });
            })->orderBy('name')->get();

        $departments = Department::select('id', 'name')->orderBy('name')->get();
        $positions = Position::select('id', 'name', 'department_id')->orderBy('name')->get();

        $branches = Branch::select('id', 'name')
            ->when($user->role_id !== 1, function ($query) use ($allowedBranchIds) {
                $query->whereIn('id', $allowedBranchIds);
            })->orderBy('name')->get();

        return Inertia::render('DutyMeal/Index', [
            'dutymeals' => $dutymeals,
            'employees' => $employees,
            'departments' => $departments,
            'positions' => $positions,
            'branches' => $branches,
        ]);
    }

    public function create()
    {
        $user = Auth::user();
        $userRole = strtolower(trim($user->role->name ?? ''));

        if (str_contains($userRole, 'audit')) {
            return redirect()->route('dashboard')->with('error', 'Auditors are not permitted to set up duty meal rosters.');
        }

        $allowedBranchIds = $user->branches->pluck('id')->push($user->branch_id)->filter()->unique();
        
        $branches = Branch::select('id', 'name')
            ->when($user->role_id !== 1, function ($query) use ($allowedBranchIds) {
                $query->whereIn('id', $allowedBranchIds);
            })->orderBy('name')->get();

        // 🟢 NEW: Added 'schedules' and 'scheduleOverrides' to the relationships!
        $employees = User::with(['branches', 'department:id,name', 'schedules', 'scheduleOverrides'])
            ->when($user->role_id !== 1, function ($query) use ($allowedBranchIds) {
                $query->where(function ($q) use ($allowedBranchIds) {
                    $q->whereIn('branch_id', $allowedBranchIds)
                      ->orWhereHas('branches', function ($pivotQuery) use ($allowedBranchIds) {
                          $pivotQuery->whereIn('branch_id', $allowedBranchIds);
                      });
                });
            })
            ->select('id', 'name', 'department_id', 'position_id','branch_id')->orderBy('name')->get()
            ->map(function ($emp) {
                $emp->assigned_branch_ids = $emp->branches->pluck('id')->toArray();
                unset($emp->branches); 
                
                // 🟢 NEW: Map out the schedules strictly for the React frontend
                $emp->mapped_schedules = $emp->schedules->map(function ($sch) {
                    return [
                        'start_date' => $sch->start_date,
                        'end_date' => $sch->end_date,
                        'shift_type' => $sch->shift_type,
                        'off_days' => $sch->off_days ?? [],
                    ];
                })->toArray();
                
                $emp->mapped_overrides = $emp->scheduleOverrides->keyBy(function($item) {
                    return \Carbon\Carbon::parse($item->date)->format('Y-m-d');
                })->map(function ($override) {
                    return [
                        'is_off_day' => (bool) $override->is_off_day,
                        'shift_type' => $override->shift_type,
                    ];
                })->toArray();

                return $emp;
            });

        $departments = Department::select('id', 'name')->orderBy('name')->get();

        $positions = Position::select('id', 'name', 'department_id')->orderBy('name')->get();

        return Inertia::render('DutyMeal/Create', [
            'employees' => $employees,
            'branches' => $branches,
            'departments' => $departments,
            'positions' => $positions,
        ]);
    }

    public function store(Request $request)
    {
        $user = Auth::user();
        $userRole = strtolower(trim($user->role->name ?? ''));

        // 🟢 HARD BLOCK FOR AUDITORS
        if (str_contains($userRole, 'audit')) {
            return redirect()->route('dashboard')->with('error', 'Auditors are not permitted to create duty meal rosters.');
        }

        $validated = $request->validate([
            'branch_id' => 'required|exists:branches,id',
            'week_start' => 'required|date',
            'schedule' => 'required|array|min:1|max:7',
            'schedule.*.date' => 'required|date',
            'schedule.*.main_meal' => 'nullable|string|max:255',
            'schedule.*.alt_meal' => 'nullable|string|max:255',
            'schedule.*.participants' => 'nullable|array',
            'schedule.*.participants.*.id' => 'required_with:schedule.*.participants|exists:users,id',
            'schedule.*.participants.*.shift_type'=> 'required_with:schedule.*.participants|string|in:day,graveyard,straight',
        ]);

        try {
            $createdDutyMeals = collect();
            $allParticipantData = [];
            $userIdsToNotify = [];
            $totalShifts = 0;

            DB::transaction(function () use ($validated, &$createdDutyMeals, &$allParticipantData, &$userIdsToNotify, &$totalShifts) {
                foreach ($validated['schedule'] as $day) {
                    if (empty($day['main_meal']) && empty($day['participants'])) continue; 

                    $dutyMeal = DutyMeal::create([
                        'branch_id' => $validated['branch_id'],
                        'duty_date' => $day['date'],
                        'main_meal' => $day['main_meal'] ?? 'TBD', 
                        'alt_meal' => $day['alt_meal'] ?? null,
                        'is_locked' => false,
                    ]);

                    $createdDutyMeals->push($dutyMeal);

                    if (!empty($day['participants'])) {
                        foreach ($day['participants'] as $staff) {
                            $allParticipantData[] = [
                                'duty_meal_id' => $dutyMeal->id,
                                'user_id' => $staff['id'],
                                'choice' => 'none',
                                'shift_type' => $staff['shift_type'],
                                'created_at' => now(),
                                'updated_at' => now(),
                            ];
                            
                            $userIdsToNotify[] = $staff['id'];
                            $totalShifts++;
                        }
                    }
                }

                if (!empty($allParticipantData)) DutyMealParticipant::insert($allParticipantData);
            });

            if (!empty($userIdsToNotify) && $createdDutyMeals->isNotEmpty()) {
                $uniqueUserIds = array_unique($userIdsToNotify);
                $employeesToNotify = User::whereIn('id', $uniqueUserIds)->get();
                
                $referenceMeal = $createdDutyMeals->first();

                if ($employeesToNotify->isNotEmpty()) {
                    Notification::send($employeesToNotify, new DutyMealRosterCreated($referenceMeal));
                }
            }

            // 🟢 SYSTEM LOGGING
            try {
                SystemLog::create([
                    'user_id' => Auth::id(),
                    'action' => 'Create',
                    'module' => 'Duty Meal Setup',
                    'description' => "Published a 7-Day Duty Meal Roster for Branch ID: {$validated['branch_id']} starting on {$validated['week_start']} ({$totalShifts} shifts).",
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent()
                ]);
            } catch (\Exception $e) {}

            return redirect()->route('admin.duty-meals.index')->with('success', '7-Day duty roster published successfully!');

        } catch (\Illuminate\Database\QueryException $e) {
            if ($e->errorInfo[1] == 1062) return back()->with('error', 'A roster already exists for one of these dates! Please edit the existing roster instead.');
            return back()->withErrors(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

   public function updateParticipantChoice(Request $request, $id)
    {
        $request->validate(['choice' => 'required|in:main,alt']);
        $participant = DutyMealParticipant::with('user')->findOrFail($id);
        $participant->update(['choice' => $request->choice]);
        
        // 🟢 SYSTEM LOGGING
        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Update',
                'module' => 'Duty Meal Overview',
                'description' => "Forced meal choice to '{$request->choice}' for employee '{$participant->user->name}'.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {}

        return back()->with('success', "Meal choice successfully set to {$request->choice}.");
    }

    public function removeParticipant(Request $request, $id)
    {
        $participant = DutyMealParticipant::with('user')->findOrFail($id);
        $name = $participant->user->name ?? 'Unknown';
        $participant->delete();

        // 🟢 SYSTEM LOGGING
        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Delete',
                'module' => 'Duty Meal Overview',
                'description' => "Removed employee '{$name}' from a duty meal roster.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {}

        return back()->with('success', 'Staff member removed from roster.');
    }

    public function addParticipant(Request $request, $id)
    {
        $request->validate(['user_id' => 'required|exists:users,id']);
        $meal = DutyMeal::findOrFail($id);

        if ($meal->is_locked) return back()->with('error', 'This roster is locked and can no longer be edited.');
        if ($meal->participants()->where('user_id', $request->user_id)->exists()) return back()->with('error', 'Staff member is already on this roster.');

        $meal->participants()->create([
            'user_id' => $request->user_id,
            'choice' => 'none', 
            'shift_type' => 'day', 
            'custom_request' => null,
        ]);

        // 🟢 SYSTEM LOGGING
        try {
            $emp = User::find($request->user_id);
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Create',
                'module' => 'Duty Meal Overview',
                'description' => "Added employee '{$emp->name}' to roster for {$meal->duty_date}.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {}

        return back()->with('success', 'Staff member successfully added to the roster!');
    }

    public function updateParticipantShift(Request $request, $id)
    {
        $request->validate(['shift_type' => 'required|string|in:day,graveyard,straight']);
        $participant = DutyMealParticipant::with('user')->findOrFail($id);
        
        $meal = DutyMeal::findOrFail($participant->duty_meal_id);
        if ($meal->is_locked) return back()->with('error', 'This roster is locked and cannot be edited.');

        $participant->update(['shift_type' => $request->shift_type]);
        
        // 🟢 SYSTEM LOGGING
        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Update',
                'module' => 'Duty Meal Overview',
                'description' => "Updated shift type to '{$request->shift_type}' for employee '{$participant->user->name}'.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {}

        return back()->with('success', 'Shift successfully updated.');
    }

    public function updateMeals(Request $request, $id)
    {
        $request->validate([
            'main_meal' => 'required|string|max:255',
            'alt_meal' => 'nullable|string|max:255',
        ]);

        $meal = DutyMeal::findOrFail($id);
        if ($meal->is_locked) return back()->with('error', 'This roster is locked and cannot be edited.');

        $meal->update([
            'main_meal' => $request->main_meal,
            'alt_meal' => $request->alt_meal,
        ]);

        // 🟢 SYSTEM LOGGING
        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Update',
                'module' => 'Duty Meal Overview',
                'description' => "Updated meal offerings for roster date {$meal->duty_date}.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {}

        return back()->with('success', 'Meal options successfully updated.');
    }

    public function archive(Request $request)
    {
        // ... [archive function remains the same as before] ...
        $user = Auth::user();
        $allowedBranchIds = $user->branches->pluck('id')->push($user->branch_id)->filter()->unique();

        // 1. Get available archive months (Before current month)
        $availableDates = DutyMeal::whereDate('duty_date', '<', now()->startOfMonth())
            ->selectRaw('YEAR(duty_date) as year, MONTH(duty_date) as month')
            ->distinct()->orderByDesc('year')->orderByDesc('month')->get();

        $defaultYear = $availableDates->first()->year ?? now()->subMonth()->year;
        $defaultMonth = $availableDates->first()->month ?? now()->subMonth()->month;

        $filterYear = $request->input('year', $defaultYear);
        $filterMonth = $request->input('month', $defaultMonth);

        $archivedMeals = DutyMeal::with(['branch', 'participants.user:id,name'])
            ->when($user->role_id !== 1, function ($query) use ($allowedBranchIds) {
                $query->whereIn('branch_id', $allowedBranchIds);
            })
            // 🟢 ADDED: Strict enforcement that archives must be before the current month
            ->whereDate('duty_date', '<', now()->startOfMonth()) 
            ->whereYear('duty_date', $filterYear)
            ->whereMonth('duty_date', $filterMonth)
            ->withCount('participants')->orderBy('duty_date', 'asc')->get()
            ->groupBy(function ($meal) {
                return 'Week ' . Carbon::parse($meal->duty_date)->weekOfMonth;
            });

        $employees = User::with(['department:id,name', 'position:id,name'])->select('id', 'name', 'department_id', 'position_id', 'branch_id')->get();
        $departments = Department::select('id', 'name')->orderBy('name')->get();
        $positions = Position::select('id', 'name', 'department_id')->orderBy('name')->get();

        return Inertia::render('DutyMeal/Archive', [
            'archivedMealsByWeek' => $archivedMeals,
            'availableDates' => $availableDates,
            'currentFilter' => ['year' => $filterYear, 'month' => $filterMonth],
            // 🟢 ADDED: Data needed for the viewing Modal
            'employees' => $employees,
            'departments' => $departments,
            'positions' => $positions,
        ]);
    }

    // 🟢 UPDATED: Injected Request for Logs
    public function destroy(Request $request, $id)
    {
        $meal = DutyMeal::findOrFail($id);
        $date = $meal->duty_date;
        $meal->delete();

        // 🟢 SYSTEM LOGGING
        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Delete',
                'module' => 'Duty Meal Archive',
                'description' => "Permanently deleted duty meal roster for date {$date}.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {}

        return back()->with('success', 'Roster permanently deleted.');
    }

    public function bulkDelete(Request $request)
    {
        $request->validate(['ids' => 'required|array']);
        $count = count($request->ids);
        DutyMeal::whereIn('id', $request->ids)->delete();
        
        // 🟢 SYSTEM LOGGING
        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Delete',
                'module' => 'Duty Meal Archive',
                'description' => "Bulk permanently deleted {$count} duty meal rosters.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {}

        return back()->with('success', $count . ' rosters permanently deleted.');
    }

    // 🟢 NEW GLOBAL EXPORT METHOD WITH SYSTEM LOGS
    public function export(Request $request)
    {
        // Get the list of IDs sent from the frontend
        $ids = explode(',', $request->query('ids', ''));
        $ids = array_filter($ids);
        
        if (empty($ids)) return back()->with('error', 'No duty meals found to export.');

        // Capture the date filter sent from the frontend
        $filterType = $request->query('filter', 'unknown');

        // Format the filter text nicely for the log entry
        $readableFilter = match ($filterType) {
            'today' => 'Today',
            'this_week' => 'This Week',
            'this_month' => 'This Month',
            'all' => 'All Active',
            default => ucfirst(str_replace('_', ' ', $filterType)), 
        };

        // 🟢 RECORD ACTION TO SYSTEM LOGS
        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Export',
                'module' => 'Duty Meal Module',
                'description' => "Exported Duty Meal format matrix using date filter: {$readableFilter}.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {}
        
        $fileName = "Duty_Meals_Report_" . now()->format('Y-m-d') . ".xlsx";
        
        return Excel::download(new DutyMealExport($ids), $fileName);
    }

    // 🟢 View the Branch Request Approval Board
    public function branchRequests(Request $request)
    {
        // Require ACL View Access
        if (!\Illuminate\Support\Facades\Auth::user()->canViewModule('duty_meal_branch_requests')) {
            abort(403, 'Unauthorized access to Branch Requests.');
        }

        $requests = \App\Models\DutyMealBranchRequest::with(['user', 'originalBranch', 'requestedBranch', 'handler'])
            ->orderByRaw("FIELD(status, 'pending', 'approved', 'rejected')")
            ->orderBy('duty_date', 'asc')
            ->get()->map(function($req) {
                return [
                    'id' => $req->id,
                    'duty_date' => $req->duty_date->format('Y-m-d'),
                    'user_name' => $req->user->name,
                    'original_branch' => $req->originalBranch->name ?? 'Unknown',
                    'requested_branch' => $req->requestedBranch->name ?? 'Unknown',
                    'reason' => $req->reason,
                    'status' => $req->status,
                    'handled_by' => $req->handler->name ?? null,
                ];
            });

        return \Inertia\Inertia::render('DutyMeal/BranchRequests', [
            'requests' => $requests
        ]);
    }

    // 🟢 Handle Approve / Reject
    public function handleBranchRequest(Request $request, $id)
    {
        // Require ACL Edit Access
        if (!\Illuminate\Support\Facades\Auth::user()->canEditModule('duty_meal_branch_requests')) {
            abort(403, 'Unauthorized action.');
        }

        $request->validate([
            'status' => 'required|in:approved,rejected'
        ]);

        $branchRequest = \App\Models\DutyMealBranchRequest::findOrFail($id);
        
        if ($branchRequest->status !== 'pending') {
            return back()->with('error', 'This request has already been processed.');
        }

        \Illuminate\Support\Facades\DB::transaction(function() use ($request, $branchRequest) {
            // 1. Update the request status
            $branchRequest->update([
                'status' => $request->status,
                'handled_by' => \Illuminate\Support\Facades\Auth::id(),
                'handled_at' => now()
            ]);

            // 2. If approved, migrate the user to the new branch's duty meal
            if ($request->status === 'approved') {
                
                // Find or create the target Duty Meal for the new branch on that exact date
                $targetDutyMeal = \App\Models\DutyMeal::firstOrCreate(
                    [
                        'duty_date' => $branchRequest->duty_date->format('Y-m-d'), 
                        'branch_id' => $branchRequest->requested_branch_id
                    ],
                    [
                        'main_meal' => 'TBD', 
                        'alt_meal' => '', 
                        'is_locked' => false
                    ]
                );
                
                // 🟢 FIXED: Bulletproof Database Query
                // The previous whereHas() closure failed silently because of a strict datetime object 
                // comparison against MySQL. We now pull the exact IDs first, then force the update.
                $originalDutyMealIds = \App\Models\DutyMeal::where('branch_id', $branchRequest->original_branch_id)
                    ->whereDate('duty_date', $branchRequest->duty_date->format('Y-m-d'))
                    ->pluck('id');

                \App\Models\DutyMealParticipant::where('user_id', $branchRequest->user_id)
                    ->whereIn('duty_meal_id', $originalDutyMealIds)
                    ->update([
                        'duty_meal_id' => $targetDutyMeal->id,
                        'choice' => 'none',
                        'site' => null,
                        'custom_request' => null
                    ]);
            }
        });

        // 🟢 Notify User
        try {
            $userToNotify = \App\Models\User::find($branchRequest->user_id);
            if ($userToNotify) {
                $action = $request->status === 'approved' ? 'approved ✅' : 'rejected ❌';
                $message = "Your branch change request for {$branchRequest->duty_date->format('M d, Y')} was {$action}.";
                
                $userToNotify->notify(new \App\Notifications\ScheduleAssigned($message));
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Failed to send branch request notification: ' . $e->getMessage());
        }

        // 🟢 System Log
        try {
            \App\Models\SystemLog::create([
                'user_id' => \Illuminate\Support\Facades\Auth::id(),
                'action' => 'Update',
                'module' => 'Duty Meal Branch Requests',
                'description' => ucfirst($request->status) . " branch change request for user ID {$branchRequest->user_id}.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {}

        return back()->with('success', 'Request ' . $request->status . ' successfully.');
    }
}