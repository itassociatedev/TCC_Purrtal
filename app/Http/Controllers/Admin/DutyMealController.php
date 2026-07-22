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
use App\Models\SystemLog; // Added for tracking
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

        // 1. Get all unlocked meals
        $unlockedMeals = DutyMeal::where('is_locked', false)
            ->orderBy('branch_id')
            ->orderBy('duty_date')
            ->get();

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

                if ($currentBlockStart === null) {
                    $currentBlockStart = $mealDate;
                }

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

        // 2. For any meal that is now locked (or was already locked), 
        // force pending participants ('none') to the default 'main' meal.
        $lockedMealIds = DutyMeal::where('is_locked', true)
            ->whereDate('duty_date', '>=', $today) 
            ->pluck('id');
            
        if ($lockedMealIds->isNotEmpty()) {
            DutyMealParticipant::whereIn('duty_meal_id', $lockedMealIds)
                ->where('choice', 'none')
                ->update(['choice' => 'main']);
        }

        // 3. Catch-all for past meals
        $pastMealIds = DutyMeal::whereDate('duty_date', '<', $today)->pluck('id');
        if ($pastMealIds->isNotEmpty()) {
            DutyMealParticipant::whereIn('duty_meal_id', $pastMealIds)
                ->where('choice', 'none')
                ->update(['choice' => 'main']);
        }
        
        $allowedBranchIds = $user->branches->pluck('id')->push($user->branch_id)->filter()->unique();

        $dutymeals = DutyMeal::with([
            'branch', 
            'participants.user:id,name' 
        ])
        ->when($user->role_id !== 1, function ($query) use ($allowedBranchIds) {
            $query->whereIn('branch_id', $allowedBranchIds);
        })
        ->whereDate('duty_date', '>=', now()->startOfMonth())
        ->withCount('participants')
        ->latest('duty_date')
        ->get();

        $employees = User::with(['department:id,name', 'position:id,name'])
            ->select('id', 'name', 'department_id', 'position_id', 'branch_id')
            ->when($user->role_id !== 1, function ($query) use ($allowedBranchIds) {
                $query->where(function ($q) use ($allowedBranchIds) {
                    $q->whereIn('branch_id', $allowedBranchIds)
                      ->orWhereHas('branches', function ($pivotQuery) use ($allowedBranchIds) {
                          $pivotQuery->whereIn('branch_id', $allowedBranchIds);
                      });
                });
            })
            ->orderBy('name')
            ->get();

        $departments = Department::select('id', 'name')->orderBy('name')->get();
        $positions = Position::select('id', 'name', 'department_id')->orderBy('name')->get();

        $branches = Branch::select('id', 'name')
            ->when($user->role_id !== 1, function ($query) use ($allowedBranchIds) {
                $query->whereIn('id', $allowedBranchIds);
            })
            ->orderBy('name')
            ->get();

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
        

        // 🟢 HARD BLOCK FOR AUDITORS
        if (str_contains($userRole, 'audit')) {
            return redirect()->route('dashboard')
                ->with('error', 'Auditors are not permitted to set up duty meal rosters.');
        }

        $allowedBranchIds = $user->branches->pluck('id')->push($user->branch_id)->filter()->unique();
        
        $branches = Branch::select('id', 'name')
            ->when($user->role_id !== 1, function ($query) use ($allowedBranchIds) {
                $query->whereIn('id', $allowedBranchIds);
            })
            ->orderBy('name')
            ->get();

       
        $employees = User::with(['branches', 'department:id,name'])
            ->when($user->role_id !== 1, function ($query) use ($allowedBranchIds) {
                $query->where(function ($q) use ($allowedBranchIds) {
                    $q->whereIn('branch_id', $allowedBranchIds)
                      ->orWhereHas('branches', function ($pivotQuery) use ($allowedBranchIds) {
                          $pivotQuery->whereIn('branch_id', $allowedBranchIds);
                      });
                });
            })
            ->select('id', 'name', 'department_id', 'position_id','branch_id')
            ->orderBy('name')
            ->get()
            ->map(function ($emp) {
                $emp->assigned_branch_ids = $emp->branches->pluck('id')->toArray();
                unset($emp->branches); 
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
            return redirect()->route('dashboard')
                ->with('error', 'Auditors are not permitted to create duty meal rosters.');
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

            DB::transaction(function () use ($validated, &$createdDutyMeals, &$allParticipantData, &$userIdsToNotify) {
                foreach ($validated['schedule'] as $day) {
                    
                    if (empty($day['main_meal']) && empty($day['participants'])) {
                        continue; 
                    }

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
                        }
                    }
                }

                if (!empty($allParticipantData)) {
                    DutyMealParticipant::insert($allParticipantData);
                }
            });

            if (!empty($userIdsToNotify) && $createdDutyMeals->isNotEmpty()) {
                $uniqueUserIds = array_unique($userIdsToNotify);
                $employeesToNotify = User::whereIn('id', $uniqueUserIds)->get();
                
                $referenceMeal = $createdDutyMeals->first();

                if ($employeesToNotify->isNotEmpty()) {
                    Notification::send($employeesToNotify, new DutyMealRosterCreated($referenceMeal));
                }
            }

            return redirect()->route('admin.duty-meals.index')->with('success', '7-Day duty roster published successfully!');

        } catch (\Illuminate\Database\QueryException $e) {
            if ($e->errorInfo[1] == 1062) {
                return back()->with('error', 'A roster already exists for one of these dates! Please edit the existing roster instead.');
            }
            return back()->withErrors(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

   public function updateParticipantChoice(Request $request, $id)
    {
        $request->validate([
            'choice' => 'required|in:main,alt'
        ]);

        $participant = DutyMealParticipant::findOrFail($id);

        $participant->update(['choice' => $request->choice]);
        
        return back()->with('success', "Meal choice successfully set to {$request->choice}.");
    }

    public function removeParticipant($id)
    {
        $participant = DutyMealParticipant::findOrFail($id);

        // 🟢 REMOVED: The logic that blocked deletion if $meal->is_locked is true.
        // Admins/Custodians can now delete employees from a locked meal (e.g., if they are absent).
        
        $participant->delete();

        return back()->with('success', 'Staff member removed from roster.');
    }

    public function addParticipant(Request $request, $id)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $meal = DutyMeal::findOrFail($id);

        if ($meal->is_locked) {
            return back()->with('error', 'This roster is locked and can no longer be edited.');
        }

        if ($meal->participants()->where('user_id', $request->user_id)->exists()) {
            return back()->with('error', 'Staff member is already on this roster.');
        }

        $meal->participants()->create([
            'user_id' => $request->user_id,
            'choice' => 'none', 
            'shift_type' => 'day', 
            'custom_request' => null,
        ]);

        return back()->with('success', 'Staff member successfully added to the roster!');
    }

    public function updateParticipantShift(Request $request, $id)
    {
        $request->validate([
            'shift_type' => 'required|string|in:day,graveyard,straight'
        ]);

        $participant = DutyMealParticipant::findOrFail($id);
        
        $meal = DutyMeal::findOrFail($participant->duty_meal_id);
        if ($meal->is_locked) {
            return back()->with('error', 'This roster is locked and cannot be edited.');
        }

        $participant->update([
            'shift_type' => $request->shift_type
        ]);
        
        return back()->with('success', 'Shift successfully updated.');
    }

    public function updateMeals(Request $request, $id)
    {
        $request->validate([
            'main_meal' => 'required|string|max:255',
            'alt_meal' => 'nullable|string|max:255',
        ]);

        $meal = DutyMeal::findOrFail($id);

        if ($meal->is_locked) {
            return back()->with('error', 'This roster is locked and cannot be edited.');
        }

        $meal->update([
            'main_meal' => $request->main_meal,
            'alt_meal' => $request->alt_meal,
        ]);

        return back()->with('success', 'Meal options successfully updated.');
    }

    public function archive(Request $request)
    {
        $user = Auth::user();
        $allowedBranchIds = $user->branches->pluck('id')->push($user->branch_id)->filter()->unique();

        // 1. Get available archive months (Before current month)
        $availableDates = DutyMeal::whereDate('duty_date', '<', now()->startOfMonth())
            ->selectRaw('YEAR(duty_date) as year, MONTH(duty_date) as month')
            ->distinct()
            ->orderByDesc('year')
            ->orderByDesc('month')
            ->get();

        $defaultYear = $availableDates->first()->year ?? now()->subMonth()->year;
        $defaultMonth = $availableDates->first()->month ?? now()->subMonth()->month;

        $filterYear = $request->input('year', $defaultYear);
        $filterMonth = $request->input('month', $defaultMonth);

        // 2. Fetch the actual archived meals
        $archivedMeals = DutyMeal::with([
                'branch',
                'participants.user:id,name' // 🟢 ADDED: We need this data for the Modal
            ])
            ->when($user->role_id !== 1, function ($query) use ($allowedBranchIds) {
                $query->whereIn('branch_id', $allowedBranchIds);
            })
            // 🟢 ADDED: Strict enforcement that archives must be before the current month
            ->whereDate('duty_date', '<', now()->startOfMonth()) 
            ->whereYear('duty_date', $filterYear)
            ->whereMonth('duty_date', $filterMonth)
            ->withCount('participants')
            ->orderBy('duty_date', 'asc')
            ->get()
            ->groupBy(function ($meal) {
                return 'Week ' . Carbon::parse($meal->duty_date)->weekOfMonth;
            });

        // 3. We also need to send departments/positions for the Modal to render employee details correctly
        $employees = User::with(['department:id,name', 'position:id,name'])
            ->select('id', 'name', 'department_id', 'position_id', 'branch_id')
            ->get();
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

    public function destroy($id)
    {
        DutyMeal::findOrFail($id)->delete();
        return back()->with('success', 'Roster permanently deleted.');
    }

    public function bulkDelete(Request $request)
    {
        $request->validate(['ids' => 'required|array']);
        DutyMeal::whereIn('id', $request->ids)->delete();
        
        return back()->with('success', count($request->ids) . ' rosters permanently deleted.');
    }

    // 🟢 NEW GLOBAL EXPORT METHOD WITH SYSTEM LOGS
    public function export(Request $request)
    {
        // Get the list of IDs sent from the frontend
        $ids = explode(',', $request->query('ids', ''));
        $ids = array_filter($ids);
        
        if (empty($ids)) {
            return back()->with('error', 'No duty meals found to export.');
        }

        // Capture the date filter sent from the frontend
        $filterType = $request->query('filter', 'unknown');

        // Format the filter text nicely for the log entry
        $readableFilter = match ($filterType) {
            'today' => 'Today',
            'this_week' => 'This Week',
            'this_month' => 'This Month',
            'all' => 'All Active',
            default => ucfirst(str_replace('_', ' ', $filterType)), // Catches the Custom Range
        };

        // 🟢 RECORD ACTION TO SYSTEM LOGS
        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Export',
                'module' => 'Duty Meal Module',
                'description' => "Exported Duty Meal rosters using date filter: {$readableFilter}.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::info("Duty Meals exported by User " . Auth::id() . " with filter: {$readableFilter}");
        }
        
        $fileName = "Duty_Meals_Report_" . now()->format('Y-m-d') . ".xlsx";
        
        return Excel::download(new DutyMealExport($ids), $fileName);
    }
}