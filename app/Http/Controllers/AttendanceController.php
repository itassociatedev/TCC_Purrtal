<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\User;
use App\Models\Schedule;

class AttendanceController extends Controller
{
    public function overview() { return Inertia::render('Attendance/Overview'); }
    public function scheduleView() { return Inertia::render('Attendance/ScheduleView'); }
    public function calendar() { return Inertia::render('Attendance/Calendar'); }

    // 🟢 UPDATED: Fetch real data for the table
    public function setupSchedule()
    {
        $employees = User::with(['department', 'schedule'])
            ->whereIn('status', ['Active', 'Password reset'])
            ->orderBy('name', 'asc')
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'department' => $user->department ? $user->department->name : 'Unassigned',
                    'schedule' => $user->schedule ? [
                        'shift_type' => $user->schedule->shift_type,
                        'off_days' => $user->schedule->off_days ? implode(', ', $user->schedule->off_days) : 'None',
                        // 🟢 NEW: Send raw data for the Edit Modal to use
                        'raw_off_days' => $user->schedule->off_days ?? [],
                        'start_time' => date('H:i', strtotime($user->schedule->start_time)),
                        'end_time' => date('H:i', strtotime($user->schedule->end_time)),
                    ] : null,
                ];
            });

        return Inertia::render('Attendance/SetupSchedule', [
            'employees' => $employees
        ]);
    }

    // 🟢 NEW: Handles the React form submission
    public function storeSchedule(Request $request)
    {
        // 🟢 UPDATED: Conditionally validate either a single ID or a batch array of IDs
        $request->validate([
            'employee_id' => 'required_without:employee_ids|nullable|exists:users,id',
            'employee_ids' => 'required_without:employee_id|nullable|array',
            'employee_ids.*' => 'exists:users,id',
            'shift_start' => 'required',
            'shift_end' => 'required',
            'shift_type' => 'required|string',
            'rest_days' => 'array'
        ]);

        $employeeIds = $request->employee_ids ?: [$request->employee_id];

        // 🟢 NEW: Define the standard Monday to Sunday chronology order
        $weekOrder = ['Monday' => 1, 'Tuesday' => 2, 'Wednesday' => 3, 'Thursday' => 4, 'Friday' => 5, 'Saturday' => 6, 'Sunday' => 7];
        
        $sortedRestDays = $request->rest_days ?? [];
        
        // Sort the days based on the week order array
        usort($sortedRestDays, function ($a, $b) use ($weekOrder) {
            return ($weekOrder[$a] ?? 0) <=> ($weekOrder[$b] ?? 0);
        });

        foreach ($employeeIds as $id) {
            Schedule::updateOrCreate(
                ['user_id' => $id],
                [
                    'shift_type' => $request->shift_type,
                    'start_time' => $request->shift_start,
                    'end_time' => $request->shift_end,
                    'off_days' => $sortedRestDays, // 🟢 Save the chronologically sorted array
                ]
            );
        }

        return redirect()->back()->with('success', 'Schedule updated successfully.');
    }
}