<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\User;
use App\Models\Schedule;
use App\Models\Branch;
use Illuminate\Support\Facades\Auth;

class AttendanceController extends Controller
{
    /**
     * 🟢 HELPER: Secures all Attendance queries using Role-Based Branch Isolation.
     */
    private function getBaseQueryAndBranches()
    {
        $user = Auth::user();
        
        // Build the allowed branch IDs array (Primary Branch + Secondary Branches)
        $allowedBranchIds = $user->branches->pluck('id')->push($user->branch_id)->filter()->unique();

        // Fetch Branches (Admins get all, Managers get assigned)
        $branches = Branch::select('id', 'name')
            ->when($user->role_id !== 1, function ($query) use ($allowedBranchIds) {
                $query->whereIn('id', $allowedBranchIds);
            })
            ->orderBy('name')
            ->get();

        // Build the isolated Employee query
        $query = User::with(['department', 'schedules', 'scheduleOverrides', 'branches'])
            ->whereIn('status', ['Active', 'Password reset'])
            ->when($user->role_id !== 1, function ($query) use ($allowedBranchIds) {
                $query->where(function ($q) use ($allowedBranchIds) {
                    $q->whereIn('branch_id', $allowedBranchIds)
                      ->orWhereHas('branches', function ($pivotQuery) use ($allowedBranchIds) {
                          $pivotQuery->whereIn('branch_id', $allowedBranchIds);
                      });
                });
            })
            ->orderBy('name', 'asc');

        return [$query, $branches];
    }

    public function overview()
    {
        $user = Auth::user();

        // 🔐 INTELLIGENT PERMISSION-BASED REDIRECT
        // If user doesn't have overview access, redirect them to the first module they CAN access
        if (!$user->canViewModule('attendance_overview')) {
            if ($user->canViewModule('attendance_calendar')) {
                return redirect()->route('attendance.calendar');
            } elseif ($user->canEditModule('attendance_schedule_view')) {
                return redirect()->route('attendance.schedule-view');
            } elseif ($user->canEditModule('attendance_setup')) {
                return redirect()->route('attendance.setup-schedule');
            } else {
                // If they have literally zero attendance permissions, kick to dashboard
                return redirect()->route('dashboard')
                    ->with('error', 'You do not have permission to access the Attendance module.');
            }
        }

        list($query, $branches) = $this->getBaseQueryAndBranches();

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

        return Inertia::render('Attendance/Overview', [
            'employees' => $employees,
            'branches' => $branches
        ]);
    }
    
    public function scheduleView()
    {
        // 🔐 SECURITY LOCK: Must have at least 'edit' access for Schedule View
        if (!Auth::user()->canEditModule('attendance_schedule_view')) {
            abort(403, 'Unauthorized access to Schedule View.');
        }

        list($query, $branches) = $this->getBaseQueryAndBranches();

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

        return Inertia::render('Attendance/ScheduleView', [
            'employees' => $employees,
            'branches' => $branches
        ]);
    }
    
    public function calendar()
    {
        // 🔐 SECURITY LOCK: Everyone with at least 'view' can see the calendar
        if (!Auth::user()->canViewModule('attendance_calendar')) {
            abort(403, 'Unauthorized access to Calendar.');
        }

        list($query, $branches) = $this->getBaseQueryAndBranches();

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

        return Inertia::render('Attendance/Calendar', [
            'employees' => $employees,
            'branches' => $branches
        ]);
    }

    // 🟢 UPDATED: Fetch real data for the table
    public function setupSchedule()
    {
        // 🔐 SECURITY LOCK: Must have at least 'edit' access to set up schedules
        if (!Auth::user()->canEditModule('attendance_setup')) {
            abort(403, 'Unauthorized access to Schedule Setup.');
        }

        list($query, $branches) = $this->getBaseQueryAndBranches();

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

        return Inertia::render('Attendance/SetupSchedule', [
            'employees' => $employees,
            'branches' => $branches
        ]);
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
}