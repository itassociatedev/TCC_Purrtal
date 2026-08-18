<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\User;
use App\Models\Schedule;

class AttendanceController extends Controller
{
    public function overview()
    {
        // 🟢 Fetch all active employees, their cut-off schedules, and their daily overrides
        $employees = User::with(['department', 'schedules', 'scheduleOverrides'])
            ->whereIn('status', ['Active', 'Password reset'])
            ->orderBy('name', 'asc')
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
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
            'employees' => $employees
        ]);
    }
    
    
    public function scheduleView()
    {
        // 🟢 Load 'schedules' (plural) to pull all cut-off periods for the employee
        $employees = User::with(['department', 'schedules', 'scheduleOverrides'])
            ->whereIn('status', ['Active', 'Password reset'])
            ->orderBy('name', 'asc')
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'department' => $user->department ? $user->department->name : 'Unassigned',
                    
                    // 🟢 Map out ALL cut-off schedules for the user
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
            'employees' => $employees
        ]);
    }
    
    
    public function calendar()
    {
        $employees = User::with(['department', 'schedules', 'scheduleOverrides'])
            ->whereIn('status', ['Active', 'Password reset'])
            ->orderBy('name', 'asc')
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
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
            'employees' => $employees
        ]);
    }

    // 🟢 UPDATED: Fetch real data for the table
    public function setupSchedule()
    {
        // 🟢 Notice we are now loading 'schedules' (plural)
        $employees = User::with(['department', 'schedules'])
            ->whereIn('status', ['Active', 'Password reset'])
            ->orderBy('name', 'asc')
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'department' => $user->department ? $user->department->name : 'Unassigned',
                    // 🟢 Map out all schedules for the user
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
            'employees' => $employees
        ]);
    }

    public function storeSchedule(Request $request)
    {
        $request->validate([
            'employee_id' => 'required_without:employee_ids|nullable|exists:users,id',
            'employee_ids' => 'required_without:employee_id|nullable|array',
            'employee_ids.*' => 'exists:users,id',
            'cutoff_period' => 'required|string', // 🟢 Added cutoff validation
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
                    'start_date' => $startDate, // 🟢 Tie it to this specific cutoff!
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
        $request->validate([
            'cells' => 'required|array', // Array of { employee_id, date }
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