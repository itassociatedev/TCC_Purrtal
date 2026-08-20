<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\User;
use App\Models\Schedule;
use App\Models\Branch;
use App\Models\Shift;
use App\Models\AttendanceSetting;
use App\Models\Holiday; // 🟢 INJECTED FOR EDITABLE HOLIDAYS
use App\Models\SystemLog; // 🟢 INJECTED FOR LOGGING
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB; // 🟢 INJECTED FOR DIRECT DB TIMESTAMPS
use Carbon\Carbon;

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

    // 🟢 API MAPPER HELPER: Consolidated to ensure all views share the exact same logic
    private function mapEmployeeSchedules($query)
    {
        return $query->get()->map(function ($user) {
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
                    return Carbon::parse($item->date)->format('Y-m-d');
                })->map(function ($override) {
                    return [
                        'is_off_day' => (bool) $override->is_off_day,
                        'shift_type' => $override->shift_type,
                        'start_time' => $override->start_time ? date('g:i A', strtotime($override->start_time)) : null,
                        'end_time' => $override->end_time ? date('g:i A', strtotime($override->end_time)) : null,
                        // 🟢 MAGIC FIX: Verifies if the DB timestamp is exactly our forced 2000-01-01 import flag
                        'is_manual' => $override->updated_at ? (Carbon::parse($override->updated_at)->year > 2000) : true,
                    ];
                })->toArray(),
                'duty_meals' => $user->dutyMealParticipants ? $user->dutyMealParticipants->mapWithKeys(function ($p) {
                    return [Carbon::parse($p->dutyMeal->duty_date)->format('Y-m-d') => $p->choice];
                })->toArray() : [],
            ];
        });
    }

    public function overview()
    {
        $user = Auth::user();

        if (!$user->canViewModule('attendance_overview')) {
            if ($user->canViewModule('attendance_calendar')) return redirect()->route('attendance.calendar');
            if ($user->canEditModule('attendance_setup')) return redirect()->route('attendance.setup-schedule');
            return redirect()->route('dashboard')->with('error', 'You do not have permission to access Attendance.');
        }

        list($query, $branches) = $this->getIsolatedQuery('attendance_overview');

        return Inertia::render('Attendance/Overview', array_merge([
            'employees' => $this->mapEmployeeSchedules($query),
            'branches' => $branches
        ], $this->getSharedProps()));
    }
    
    // 🟢 DELETED scheduleView() - It is now entirely replaced by setupSchedule()
    
    public function setupSchedule()
    {
        if (!Auth::user()->canEditModule('attendance_setup')) {
            // Allows fallback to View-Only if they originally had Schedule View access
            if (!Auth::user()->canViewModule('attendance_schedule_view')) {
                abort(403, 'Unauthorized access to Setup Schedule.');
            }
        }

        // We use the 'attendance_setup' ACL rules to gather the staff
        list($query, $branches) = $this->getIsolatedQuery('attendance_setup');

        return Inertia::render('Attendance/SetupSchedule', array_merge([
            'employees' => $this->mapEmployeeSchedules($query),
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
        $query->with(['dutyMealParticipants.dutyMeal']);

        // 🟢 Generate 3 years of standard mathematical holidays
        $currentYear = now()->year;
        $mathHolidaysRaw = array_merge(
            $this->getPhilippineHolidays($currentYear - 1),
            $this->getPhilippineHolidays($currentYear),
            $this->getPhilippineHolidays($currentYear + 1)
        );

        $mathHolidays = [];
        foreach ($mathHolidaysRaw as $date => $name) {
            $mathHolidays[$date] = [
                'id' => null, // Math holidays don't have DB IDs
                'name' => $name,
            ];
        }

        // 🟢 Fetch custom editable holidays from the database and key them BY DATE
        $dbHolidaysRaw = \App\Models\Holiday::all();
        $dbHolidays = [];
        foreach ($dbHolidaysRaw as $h) {
            $dbHolidays[$h->date] = [
                'id' => $h->id,
                'name' => $h->name,
            ];
        }
        
        // 🟢 Safely merge them together. If a DB holiday shares the same date as a Math holiday, the DB wins.
        $holidays = array_replace($mathHolidays, $dbHolidays);

        return Inertia::render('Attendance/Calendar', array_merge([
            'employees' => $this->mapEmployeeSchedules($query),
            'branches' => $branches,
            'holidays' => $holidays 
        ], $this->getSharedProps()));
    }

    // 🟢 NEW ENDPOINT: Store or Update an Event/Holiday
    public function storeHoliday(Request $request)
    {
        if (!Auth::user()->canEditModule('attendance_calendar')) abort(403);
        
        $request->validate([
            'date' => 'required|date',
            'name' => 'required|string|max:255'
        ]);

        Holiday::updateOrCreate(
            ['date' => $request->date],
            ['name' => $request->name]
        );

        return redirect()->back()->with('success', 'Event/Holiday added successfully.');
    }

    // 🟢 NEW ENDPOINT: Delete an Event/Holiday
    public function destroyHoliday($id)
    {
        if (!Auth::user()->canEditModule('attendance_calendar')) abort(403);
        
        $holiday = Holiday::find($id);
        if ($holiday) {
            $holiday->delete();
        }

        return redirect()->back()->with('success', 'Event/Holiday removed successfully.');
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

        // 🟢 NEW: Dispatch Notification to Assigned Users
        try {
            $usersToNotify = User::whereIn('id', $employeeIds)->get();
            $message = "Your schedule has been assigned for the cut-off period: $startDate to $endDate.";
            \Illuminate\Support\Facades\Notification::send($usersToNotify, new \App\Notifications\ScheduleAssigned($message));
        } catch (\Exception $e) {}

        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Update',
                'module' => 'Attendance Setup',
                'description' => "Assigned cut-off schedule ({$startDate} to {$endDate}) for " . count($employeeIds) . " employee(s).",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {}

        return redirect()->back()->with('success', 'Schedule updated for the cut-off period.');
    }

    public function storeOverride(Request $request)
    {
        // Allowed if they can edit setup
        if (!Auth::user()->canEditModule('attendance_setup')) abort(403);

        $request->validate([
            'cells' => 'required|array', 
            'is_off_day' => 'required|boolean',
            'shift_start' => 'nullable',
            'shift_end' => 'nullable',
            'shift_type' => 'nullable|string',
        ]);

        $affectedUserIds = [];

        foreach ($request->cells as $cell) {
            $override = \App\Models\ScheduleOverride::updateOrCreate(
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

            // Force touch to ensure Eloquent stamps this as manually modified (now)
            $override->touch();
            $affectedUserIds[] = $cell['employee_id'];
        }

        // 🟢 NEW: Dispatch Notification for Overrides
        try {
            $uniqueUserIds = array_unique($affectedUserIds);
            $usersToNotify = User::whereIn('id', $uniqueUserIds)->get();
            $message = "An Admin has modified or overridden your daily schedule. Please check your calendar.";
            \Illuminate\Support\Facades\Notification::send($usersToNotify, new \App\Notifications\ScheduleAssigned($message));
        } catch (\Exception $e) {}

        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Update',
                'module' => 'Schedule View',
                'description' => "Applied daily schedule overrides to " . count($request->cells) . " cell(s).",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {}

        return redirect()->back()->with('success', 'Daily overrides applied successfully.');
    }

    // 🟢 NEW: Backend endpoint specifically for the FULL permission "Reset" button
    public function resetOverride(Request $request)
    {
        if (!Auth::user()->canDeleteModule('attendance_setup')) abort(403);

        $request->validate([
            'cells' => 'required|array', 
        ]);

        foreach ($request->cells as $cell) {
            \App\Models\ScheduleOverride::where('user_id', $cell['employee_id'])
                ->where('date', $cell['date'])
                ->delete();
        }

        // 🟢 SYSTEM LOGGING
        try {
            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Delete',
                'module' => 'Schedule View',
                'description' => "Reset manual overrides for " . count($request->cells) . " cell(s) back to default.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {}

        return redirect()->back()->with('success', 'Overrides reset successfully.');
    }

    // 🟢 FROM SCRATCH: Smart Import Engine
    public function importSchedule(Request $request)
    {
        if (!Auth::user()->canEditModule('attendance_setup')) abort(403);

        $request->validate([
            'file' => 'required|file',
        ]);

        try {
            $file = $request->file('file');
            $extension = strtolower($file->getClientOriginalExtension());
            $rows = [];

            // 1. Read the file
            if ($extension === 'csv' || $extension === 'txt') {
                $path = $file->getRealPath();
                if (($handle = fopen($path, 'r')) !== FALSE) {
                    while (($row = fgetcsv($handle, 10000, ',')) !== FALSE) {
                        $rows[] = $row;
                    }
                    fclose($handle);
                }
            } else {
                if (!class_exists('ZipArchive')) {
                    return redirect()->back()->with('error', 'Server Error: The PHP "ZipArchive" extension is missing. Please save and upload your backup as a CSV file instead!');
                }
                $data = \Maatwebsite\Excel\Facades\Excel::toArray(new \App\Imports\AttendanceImport(null, null), $file);
                $rows = $data[0] ?? [];
            }

            if (count($rows) < 2) {
                return redirect()->back()->with('error', 'The uploaded file is empty or formatted incorrectly.');
            }

            // 2. Parse Dates from Header Row
            $headerRow = $rows[1] ?? [];
            $columnDates = [];
            $currentYear = now()->year;

            for ($col = 2; $col < count($headerRow); $col++) {
                $headerText = trim($headerRow[$col] ?? '');
                if (empty($headerText)) continue;

                try {
                    $parsedDate = \Carbon\Carbon::parse($headerText . ' ' . $currentYear);
                    $columnDates[$col] = $parsedDate->format('Y-m-d');
                } catch (\Exception $e) {}
            }

            if (empty($columnDates)) return redirect()->back()->with('error', 'Could not detect valid dates in the header row.');

            $parsedDateStrings = array_values($columnDates);
            $startDate = min($parsedDateStrings);
            $endDate = max($parsedDateStrings);
            $weekOrder = ['Monday' => 1, 'Tuesday' => 2, 'Wednesday' => 3, 'Thursday' => 4, 'Friday' => 5, 'Saturday' => 6, 'Sunday' => 7];

            // 3. Process each Employee Row
            for ($i = 2; $i < count($rows); $i++) {
                $row = $rows[$i];
                $employeeName = trim($row[0] ?? '');
                if (empty($employeeName)) continue;

                $employee = User::where('name', $employeeName)->first();
                if (!$employee) continue;

                $cellData = [];
                $shiftCounts = [];
                $dayOffTally = [];

                // A. Extract and Clean Data for Every Cell
                foreach ($columnDates as $colIndex => $dateString) {
                    $rawCell = $row[$colIndex] ?? '';
                    
                    // 🟢 SAFE CLEANING: Removes non-breaking spaces and trailing spaces but KEEPS \n
                    $cellValue = str_replace("\xC2\xA0", ' ', $rawCell);
                    $cellValue = str_replace(["\r\n", "\r"], "\n", $cellValue);
                    $cellValue = preg_replace('/[ \t]+/', ' ', $cellValue); 
                    $cellValue = trim($cellValue);

                    $dayName = \Carbon\Carbon::parse($dateString)->format('l');

                    $parsedCell = [
                        'date' => $dateString,
                        'dayName' => $dayName,
                        'isOff' => false,
                        'isNoShift' => false,
                        'shift' => null
                    ];

                    if (empty($cellValue) || stripos($cellValue, 'no shift') !== false) {
                        $parsedCell['isNoShift'] = true;
                    } elseif (stripos($cellValue, 'off day') !== false) {
                        $parsedCell['isOff'] = true;
                        $dayOffTally[$dayName] = ($dayOffTally[$dayName] ?? 0) + 1; 
                    } else {
                        // Extract shift name and times safely using \n
                        $lines = array_values(array_filter(array_map('trim', explode("\n", $cellValue))));
                        $shiftTypeName = $lines[0] ?? '';
                        $timeRange = $lines[1] ?? '';

                        $startTime = null;
                        $endTime = null;
                        
                        if (!empty($timeRange) && str_contains($timeRange, '-')) {
                            list($rawStart, $rawEnd) = explode('-', $timeRange);
                            $startTime = date('H:i:s', strtotime(trim($rawStart)));
                            $endTime = date('H:i:s', strtotime(trim($rawEnd)));
                        }

                        $matchedShift = null;
                        if ($startTime && $endTime) {
                            $matchedShift = Shift::where('start_time', 'LIKE', "{$startTime}%")->where('end_time', 'LIKE', "{$endTime}%")->first();
                        }
                        if (!$matchedShift) {
                            // Strip any accidental time data attached to the name string just in case
                            $cleanName = trim(preg_replace('/[0-9]{1,2}:[0-9]{2}\s*[AP]M\s*-\s*[0-9]{1,2}:[0-9]{2}\s*[AP]M/i', '', $shiftTypeName));
                            $matchedShift = Shift::where('name', $cleanName)->orWhere('shift_type', $cleanName)->first();
                        }

                        if ($matchedShift) {
                            $parsedCell['shift'] = $matchedShift;
                            $shiftCounts[$matchedShift->id] = ($shiftCounts[$matchedShift->id] ?? 0) + 1;
                        } else {
                            $parsedCell['isNoShift'] = true; 
                        }
                    }
                    
                    $cellData[$dateString] = $parsedCell;
                }

                // B. Construct the Base Schedule
                if (empty($shiftCounts)) {
                    Schedule::where('user_id', $employee->id)->where('start_date', $startDate)->where('end_date', $endDate)->delete();
                    \App\Models\ScheduleOverride::where('user_id', $employee->id)->whereIn('date', array_keys($cellData))->delete();
                    continue;
                }

                // Find the primary shift
                arsort($shiftCounts);
                $primaryShiftId = array_key_first($shiftCounts);
                $primaryShift = Shift::find($primaryShiftId);

                // Collect unique off days
                $baseOffDays = array_keys($dayOffTally);
                usort($baseOffDays, function ($a, $b) use ($weekOrder) {
                    return ($weekOrder[$a] ?? 0) <=> ($weekOrder[$b] ?? 0);
                });

                Schedule::updateOrCreate(
                    ['user_id' => $employee->id, 'start_date' => $startDate, 'end_date' => $endDate],
                    ['shift_type' => $primaryShift->shift_type, 'start_time' => $primaryShift->start_time, 'end_time' => $primaryShift->end_time, 'off_days' => $baseOffDays]
                );

                // C. Compare & Apply Overrides
                foreach ($cellData as $dateString => $cell) {
                    $expectedIsOff = in_array($cell['dayName'], $baseOffDays);
                    $needsOverride = false;

                    if ($cell['isNoShift']) {
                        $needsOverride = true;
                    } elseif ($cell['isOff']) {
                        if (!$expectedIsOff) $needsOverride = true; 
                    } else {
                        if ($expectedIsOff) {
                            $needsOverride = true; 
                        } elseif ($cell['shift']->id !== $primaryShift->id) {
                            $needsOverride = true; 
                        }
                    }

                    if ($needsOverride) {
                        // 🟢 100% BULLETPROOF BYPASS OF ELOQUENT TIMESTAMPS
                        // Using raw DB updates ensures Eloquent doesn't forcefully overwrite our 2000-01-01 flag with now()
                        DB::table('schedule_overrides')->updateOrInsert(
                            [
                                'user_id' => $employee->id,
                                'date' => $dateString
                            ],
                            [
                                'is_off_day' => $cell['isOff'],
                                'shift_type' => $cell['shift'] ? $cell['shift']->shift_type : null,
                                'start_time' => $cell['shift'] ? $cell['shift']->start_time : null,
                                'end_time' => $cell['shift'] ? $cell['shift']->end_time : null,
                                'created_at' => '2000-01-01 00:00:00',
                                'updated_at' => '2000-01-01 00:00:00'
                            ]
                        );
                    } else {
                        \App\Models\ScheduleOverride::where('user_id', $employee->id)->where('date', $dateString)->delete();
                    }
                }
            }

            SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Import',
                'module' => 'Attendance Setup',
                'description' => "Imported schedule backup matrix.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);

            return redirect()->back()->with('success', 'Schedule backup successfully mapped and imported.');

        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'Error importing schedule: ' . $e->getMessage());
        }
    }

    public function exportOverview(Request $request)
    {
        if (!Auth::user()->canViewModule('attendance_overview')) abort(403);

        // 🟢 NEW: Accept start and end date of the cutoff period, and the format flag
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $startDateStr = $request->start_date;
        $endDateStr = $request->end_date;
        $startDate = \Carbon\Carbon::parse($startDateStr);
        $endDate = \Carbon\Carbon::parse($endDateStr);
        $formatOnly = $request->boolean('format_only');
        
        list($query, $branches) = $this->getIsolatedQuery('attendance_overview');

        // Apply Branch Filter
        if ($request->filled('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }

        // 🟢 NEW: Apply Department Filter directly to the query
        if ($request->filled('department')) {
            $query->whereHas('department', function($q) use ($request) {
                $q->where('name', $request->department);
            });
        }

        $rawEmployees = $query->get();

        // 🟢 DYNAMIC LOOP: Build dates array based on Cutoff duration instead of strict 7-days
        $dates = [];
        for ($date = $startDate->copy(); $date->lte($endDate); $date->addDay()) {
            $dates[] = [
                'dateString' => $date->format('Y-m-d'),
                'dayName' => $date->format('l'),
                'display' => $date->format('D, M d'),
            ];
        }

        $weekRange = $dates[0]['display'] . ' - ' . end($dates)['display'];

        $employees = $rawEmployees->map(function ($user) use ($dates, $formatOnly) {
            $userShifts = [];

            // Only calculate and map shifts if we are NOT doing a blank format
            if (!$formatOnly) {
                $schedules = $user->schedules->toArray();
                $overrides = $user->scheduleOverrides->keyBy('date')->toArray();

                foreach ($dates as $dateObj) {
                    $ds = $dateObj['dateString'];
                    $dn = $dateObj['dayName'];
                    $shiftData = null;

                    if (isset($overrides[$ds])) {
                        $shiftData = [
                            'is_off' => (bool)$overrides[$ds]['is_off_day'],
                            'shift_type' => $overrides[$ds]['shift_type'],
                            'start_time' => $overrides[$ds]['start_time'] ? date('g:i A', strtotime($overrides[$ds]['start_time'])) : null,
                            'end_time' => $overrides[$ds]['end_time'] ? date('g:i A', strtotime($overrides[$ds]['end_time'])) : null,
                            // 🟢 FIXED: Ensures imported dates don't highlight in Excel either!
                            'is_override' => isset($overrides[$ds]['updated_at']) ? (\Carbon\Carbon::parse($overrides[$ds]['updated_at'])->year > 2000) : true,
                        ];
                    } else {
                        foreach ($schedules as $sch) {
                            if ($ds >= $sch['start_date'] && $ds <= $sch['end_date']) {
                                $shiftData = [
                                    'is_off' => in_array($dn, $sch['off_days'] ?? []),
                                    'shift_type' => $sch['shift_type'],
                                    'start_time' => $sch['start_time'] ? date('g:i A', strtotime($sch['start_time'])) : null,
                                    'end_time' => $sch['end_time'] ? date('g:i A', strtotime($sch['end_time'])) : null,
                                    'is_override' => false
                                ];
                                break;
                            }
                        }
                    }
                    $userShifts[$ds] = $shiftData;
                }
            }

            return [
                'id' => $user->id,
                'name' => $user->name,
                'department' => $user->department ? $user->department->name : 'Unassigned',
                'shifts' => $userShifts
            ];
        });

        try {
            \App\Models\SystemLog::create([
                'user_id' => Auth::id(),
                'action' => 'Export',
                'module' => 'Attendance Overview',
                'description' => "Exported attendance overview matrix for period: {$weekRange}." . ($formatOnly ? " (Blank Format)" : ""),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        } catch (\Exception $e) {}

        $fileName = ($formatOnly ? "Attendance_Blank_Format_" : "Attendance_Report_") . "{$startDateStr}_to_{$endDateStr}.xlsx";
        return \Maatwebsite\Excel\Facades\Excel::download(new \App\Exports\AttendanceExport($employees, $dates, $weekRange, $formatOnly), $fileName);
    }

    // 🟢 NEW: Mathematical Philippine Holiday Generator
    private function getPhilippineHolidays($year)
    {
        $holidays = [
            "$year-01-01" => "New Year's Day",
            "$year-04-09" => "Araw ng Kagitingan",
            "$year-05-01" => "Labor Day",
            "$year-06-12" => "Independence Day",
            "$year-08-21" => "Ninoy Aquino Day",
            "$year-11-01" => "All Saints' Day",
            "$year-11-02" => "All Souls' Day",
            "$year-11-30" => "Bonifacio Day",
            "$year-12-08" => "Immaculate Conception",
            "$year-12-24" => "Christmas Eve",
            "$year-12-25" => "Christmas Day",
            "$year-12-30" => "Rizal Day",
            "$year-12-31" => "New Year's Eve",
        ];

        // 🟢 MOVABLE 1: Holy Week (Calculated mathematically via Easter)
        $easterDays = easter_days($year);
        $easter = \Carbon\Carbon::createFromDate($year, 3, 21)->addDays($easterDays);
        
        $holidays[$easter->copy()->subDays(3)->format('Y-m-d')] = "Maundy Thursday";
        $holidays[$easter->copy()->subDays(2)->format('Y-m-d')] = "Good Friday";
        $holidays[$easter->copy()->subDays(1)->format('Y-m-d')] = "Black Saturday";
        $holidays[$easter->format('Y-m-d')] = "Easter Sunday";

        // 🟢 MOVABLE 2: National Heroes Day (Always the Last Monday of August)
        $heroesDay = \Carbon\Carbon::parse("last monday of august $year")->format('Y-m-d');
        $holidays[$heroesDay] = "National Heroes Day";

        return $holidays;
    }
}