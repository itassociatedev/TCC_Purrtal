<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\User;
use App\Models\Schedule;
use App\Models\Branch;
use App\Models\Shift;
use App\Models\AttendanceSetting;
use Illuminate\Support\Facades\Auth;

class AttendanceController extends Controller
{
    /**
     * 🟢 DYNAMIC ROW-LEVEL ISOLATION: 
     * Reads the ACL Matrix and strictly restricts the employee data returned to the frontend.
     */
    private function getIsolatedQuery($moduleKey)
    {
        $user = Auth::user();
        $aclLevel = strtolower($user->aclPermissionForModule($moduleKey));
        $isAdmin = $user->role_id === 1 || strtolower(trim($user->role->name ?? '')) === 'admin';

        // 🟢 FIXED: Treat FULL access identically to an Admin for global data visibility!
        $hasGlobalVisibility = $isAdmin || $aclLevel === 'full';

        $allowedBranchIds = $user->branches->pluck('id')->push($user->branch_id)->filter()->unique();

        // Base Branches Query
        $branchesQuery = Branch::select('id', 'name')->orderBy('name');
        if (!$hasGlobalVisibility) {
            $branchesQuery->whereIn('id', $allowedBranchIds);
        }
        $branches = $branchesQuery->get();

        // Base Employee Query
        $query = User::with(['department', 'schedules', 'scheduleOverrides', 'branches'])
            ->whereIn('status', ['Active', 'Password reset']);

        // 🟢 GLOBAL BYPASS: Admin or FULL Access sees everyone across all branches
        if ($hasGlobalVisibility) {
            return [$query->orderBy('name', 'asc'), $branches];
        }

        // MATRIX 1: Calendar View = Strictly Own Schedule Only
        if ($moduleKey === 'attendance_calendar' && $aclLevel === 'view') {
            $query->where('id', $user->id);
            return [$query->orderBy('name', 'asc'), $branches];
        }

        // MATRIX 2: VIEW & EDIT = Strictly Own Branch AND Own Department
        $query->where('department_id', $user->department_id)
              ->where(function ($q) use ($allowedBranchIds) {
                  $q->whereIn('branch_id', $allowedBranchIds)
                    ->orWhereHas('branches', function ($pivotQuery) use ($allowedBranchIds) {
                        $pivotQuery->whereIn('branch_id', $allowedBranchIds);
                    });
              });

        return [$query->orderBy('name', 'asc'), $branches];
    }

    private function getSharedProps()
    {
        $shifts = Shift::where('is_active', true)->orderBy('start_time')->get();
        $cutoffSettings = AttendanceSetting::whereIn('setting_key', [
            'cutoff_1_start', 'cutoff_1_end', 'cutoff_2_start', 'cutoff_2_end'
        ])->pluck('setting_value', 'setting_key')->toArray();

        return [
            'shifts' => $shifts,
            'cutoffSettings' => $cutoffSettings
        ];
    }

    public function overview()
    {
        $user = Auth::user();

        if (!$user->canViewModule('attendance_overview')) {
            if ($user->canViewModule('attendance_calendar')) return redirect()->route('attendance.calendar');
            if ($user->canViewModule('attendance_schedule_view')) return redirect()->route('attendance.schedule-view');
            if ($user->canEditModule('attendance_setup')) return redirect()->route('attendance.setup-schedule');
            return redirect()->route('dashboard')->with('error', 'You do not have permission to access Attendance.');
        }

        list($query, $branches) = $this->getIsolatedQuery('attendance_overview');

        $employees = $query->get()->map(function ($user) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'branch_id' => $user->branch_id,
                'assigned_branch_ids' => $user->branches->pluck('id')->toArray(),
                'department' => $user->department ? $user->department->name : 'Unassigned',
                'schedules' => $user->schedules->map(function ($sch) {
                    return [
                        'start_date' => $sch->start_date,
                        'end_date' => $sch->end_date,
                        'shift_type' => $sch->shift_type,
                        'off_days' => $sch->off_days ?? [],
                        'start_time' => $sch->start_time ? date('g:i A', strtotime($sch->start_time)) : null,
                        'end_time' => $sch->end_time ? date('g:i A', strtotime($sch->end_time)) : null,
                    ];
                })->toArray(),
                'overrides' => $user->scheduleOverrides->keyBy(function($item) {
                    return \Carbon\Carbon::parse($item->date)->format('Y-m-d');
                })->map(function ($override) {
                    return [
                        'is_off_day' => (bool) $override->is_off_day,
                        'shift_type' => $override->shift_type,
                        'start_time' => $override->start_time ? date('g:i A', strtotime($override->start_time)) : null,
                        'end_time' => $override->end_time ? date('g:i A', strtotime($override->end_time)) : null,
                    ];
                })->toArray(),
            ];
        });

        return Inertia::render('Attendance/Overview', array_merge([
            'employees' => $employees,
            'branches' => $branches
        ], $this->getSharedProps()));
    }
    
    public function scheduleView()
    {
        // 🟢 DOWNGRADED LOCK: Now allows "View" access so staff can see the schedules without editing them
        if (!Auth::user()->canViewModule('attendance_schedule_view')) {
            abort(403, 'Unauthorized access to Schedule View.');
        }

        list($query, $branches) = $this->getIsolatedQuery('attendance_schedule_view');

        $employees = $query->get()->map(function ($user) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'branch_id' => $user->branch_id,
                'assigned_branch_ids' => $user->branches->pluck('id')->toArray(),
                'department' => $user->department ? $user->department->name : 'Unassigned',
                'schedules' => $user->schedules->map(function ($sch) {
                    return [
                        'start_date' => $sch->start_date,
                        'end_date' => $sch->end_date,
                        'shift_type' => $sch->shift_type,
                        'off_days' => $sch->off_days ?? [],
                        'start_time' => $sch->start_time ? date('g:i A', strtotime($sch->start_time)) : null,
                        'end_time' => $sch->end_time ? date('g:i A', strtotime($sch->end_time)) : null,
                    ];
                })->toArray(),
                'overrides' => $user->scheduleOverrides->keyBy(function($item) {
                    return \Carbon\Carbon::parse($item->date)->format('Y-m-d');
                })->map(function ($override) {
                    return [
                        'is_off_day' => (bool) $override->is_off_day,
                        'shift_type' => $override->shift_type,
                        'start_time' => $override->start_time ? date('g:i A', strtotime($override->start_time)) : null,
                        'end_time' => $override->end_time ? date('g:i A', strtotime($override->end_time)) : null,
                    ];
                })->toArray(),
            ];
        });

        return Inertia::render('Attendance/ScheduleView', array_merge([
            'employees' => $employees,
            'branches' => $branches
        ], $this->getSharedProps()));
    }
    
    public function calendar()
    {
        // 🔐 SECURITY LOCK: Everyone with at least 'view' can see the calendar
        if (!Auth::user()->canViewModule('attendance_calendar')) {
            abort(403, 'Unauthorized access to Calendar.');
        }

        list($query, $branches) = $this->getIsolatedQuery('attendance_calendar');

        $employees = $query->get()->map(function ($user) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'branch_id' => $user->branch_id,
                'assigned_branch_ids' => $user->branches->pluck('id')->toArray(),
                'department' => $user->department ? $user->department->name : 'Unassigned',
                'schedules' => $user->schedules->map(function ($sch) {
                    return [
                        'start_date' => $sch->start_date,
                        'end_date' => $sch->end_date,
                        'shift_type' => $sch->shift_type,
                        'off_days' => $sch->off_days ?? [],
                        'start_time' => $sch->start_time ? date('g:i A', strtotime($sch->start_time)) : null,
                        'end_time' => $sch->end_time ? date('g:i A', strtotime($sch->end_time)) : null,
                    ];
                })->toArray(),
                'overrides' => $user->scheduleOverrides->keyBy(function($item) {
                    return \Carbon\Carbon::parse($item->date)->format('Y-m-d');
                })->map(function ($override) {
                    return [
                        'is_off_day' => (bool) $override->is_off_day,
                        'shift_type' => $override->shift_type,
                        'start_time' => $override->start_time ? date('g:i A', strtotime($override->start_time)) : null,
                        'end_time' => $override->end_time ? date('g:i A', strtotime($override->end_time)) : null,
                    ];
                })->toArray(),
            ];
        });

        return Inertia::render('Attendance/Calendar', array_merge([
            'employees' => $employees,
            'branches' => $branches
        ], $this->getSharedProps()));
    }

    // 🟢 UPDATED: Fetch real data for the table
    public function setupSchedule()
    {
        // 🔐 SECURITY LOCK: Must have at least 'edit' access to set up schedules
        if (!Auth::user()->canEditModule('attendance_setup')) {
            abort(403, 'Unauthorized access to Schedule Setup.');
        }

        list($query, $branches) = $this->getIsolatedQuery('attendance_setup');

        $employees = $query->get()->map(function ($user) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'branch_id' => $user->branch_id,
                'assigned_branch_ids' => $user->branches->pluck('id')->toArray(),
                'department' => $user->department ? $user->department->name : 'Unassigned',
                'schedules' => $user->schedules->map(function ($sch) {
                    return [
                        'start_date' => $sch->start_date,
                        'end_date' => $sch->end_date,
                        'shift_type' => $sch->shift_type,
                        'off_days' => $sch->off_days ? implode(', ', $sch->off_days) : 'None',
                        'raw_off_days' => $sch->off_days ?? [],
                        'start_time' => date('H:i', strtotime($sch->start_time)),
                        'end_time' => date('H:i', strtotime($sch->end_time)),
                    ];
                })->toArray(),
            ];
        });

        return Inertia::render('Attendance/SetupSchedule', array_merge([
            'employees' => $employees,
            'branches' => $branches
        ], $this->getSharedProps()));
    }

    public function storeSchedule(Request $request)
    {
        if (!Auth::user()->canEditModule('attendance_setup')) abort(403);

        $request->validate([
            'employee_id' => 'required_without:employee_ids|nullable|exists:users,id',
            'employee_ids' => 'required_without:employee_id|nullable|array',
            'employee_ids.*' => 'exists:users,id',
            'cutoff_period' => 'required|string', 
            'shift_start' => 'required',
            'shift_end' => 'required',
            'shift_type' => 'required|string',
            'rest_days' => 'array'
        ]);

        $employeeIds = $request->employee_ids ?: [$request->employee_id];
        
        // Split the "YYYY-MM-DD|YYYY-MM-DD" string from React
        list($startDate, $endDate) = explode('|', $request->cutoff_period);

        $weekOrder = ['Monday' => 1, 'Tuesday' => 2, 'Wednesday' => 3, 'Thursday' => 4, 'Friday' => 5, 'Saturday' => 6, 'Sunday' => 7];
        $sortedRestDays = $request->rest_days ?? [];
        usort($sortedRestDays, function ($a, $b) use ($weekOrder) {
            return ($weekOrder[$a] ?? 0) <=> ($weekOrder[$b] ?? 0);
        });

        foreach ($employeeIds as $id) {
            Schedule::updateOrCreate(
                [
                    'user_id' => $id,
                    'start_date' => $startDate,
                    'end_date' => $endDate
                ],
                [
                    'shift_type' => $request->shift_type,
                    'start_time' => $request->shift_start,
                    'end_time' => $request->shift_end,
                    'off_days' => $sortedRestDays,
                ]
            );
        }

        return redirect()->back()->with('success', 'Schedule updated for the cut-off period.');
    }

    public function storeOverride(Request $request)
    {
        if (!Auth::user()->canEditModule('attendance_schedule_view')) abort(403);

        $request->validate([
            'cells' => 'required|array', 
            'is_off_day' => 'required|boolean',
            'shift_start' => 'nullable',
            'shift_end' => 'nullable',
            'shift_type' => 'nullable|string',
        ]);

        foreach ($request->cells as $cell) {
            \App\Models\ScheduleOverride::updateOrCreate(
                [
                    'user_id' => $cell['employee_id'],
                    'date' => $cell['date'],
                ],
                [
                    'is_off_day' => $request->is_off_day,
                    'shift_type' => $request->is_off_day ? null : $request->shift_type,
                    'start_time' => $request->is_off_day ? null : $request->shift_start,
                    'end_time' => $request->is_off_day ? null : $request->shift_end,
                ]
            );
        }

        return redirect()->back()->with('success', 'Daily overrides applied successfully.');
    }

    // 🟢 NEW: Backend endpoint specifically for the FULL permission "Reset" button
    public function resetOverride(Request $request)
    {
        if (!Auth::user()->canDeleteModule('attendance_schedule_view')) abort(403);

        $request->validate([
            'cells' => 'required|array', 
        ]);

        foreach ($request->cells as $cell) {
            \App\Models\ScheduleOverride::where('user_id', $cell['employee_id'])
                ->where('date', $cell['date'])
                ->delete();
        }

        return redirect()->back()->with('success', 'Overrides reset successfully.');
    }
}