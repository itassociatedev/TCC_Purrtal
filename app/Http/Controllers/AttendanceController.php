<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\User;
use App\Models\Schedule;
use App\Models\Branch;
use App\Models\Shift;
use App\Models\AttendanceSetting;
use App\Models\Holiday; 
use App\Models\SystemLog; 
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB; 
use Carbon\Carbon;

class AttendanceController extends Controller
{
    /**
     * 🟢 DYNAMIC ROW-LEVEL ISOLATION: 
     * Reads the ACL Matrix and strictly restricts the employee data returned to the frontend.
     */
    private function getIsolatedQuery(string $moduleKey)
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        
        $aclLevel = strtolower($user->aclPermissionForModule($moduleKey));
        $isAdmin = $user->role_id === 1 || strtolower(trim($user->role->name ?? '')) === 'admin';

        $hasGlobalVisibility = $isAdmin;

        $allowedBranchIds = $user->branches->pluck('id')->push($user->branch_id)->filter()->unique();

        $branchesQuery = Branch::select('id', 'name')->orderBy('name');
        if (!$hasGlobalVisibility) {
            $branchesQuery->whereIn('id', $allowedBranchIds);
        }
        $branches = $branchesQuery->get();

        $query = User::with(['department', 'schedules', 'scheduleOverrides', 'branches', 'dutyMealParticipants.dutyMeal'])
            ->whereIn('status', ['Active', 'Password reset']);

        if ($hasGlobalVisibility) {
            return [$query->orderBy('name', 'asc'), $branches];
        }

        if ($moduleKey === 'attendance_calendar' && $aclLevel === 'view') {
            $query->where('id', $user->id);
            return [$query->orderBy('name', 'asc'), $branches];
        }

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
                        'off_days' => is_string($sch->off_days) ? json_decode($sch->off_days, true) : ($sch->off_days ?? []),
                        'start_time' => $sch->start_time ? date('g:i A', strtotime($sch->start_time)) : null,
                        'end_time' => $sch->end_time ? date('g:i A', strtotime($sch->end_time)) : null,
                        'pattern' => is_string($sch->pattern) ? json_decode($sch->pattern, true) : $sch->pattern, 
                    ];
                })->toArray(),
                'overrides' => $user->scheduleOverrides->keyBy(function($item) {
                    return Carbon::parse($item->date)->format('Y-m-d');
                })->map(function ($override) {
                    return [
                        'is_off_day' => (bool) $override->is_off_day,
                        'is_leave' => (bool) $override->is_leave, 
                        'shift_type' => $override->shift_type,
                        'start_time' => $override->start_time ? date('g:i A', strtotime($override->start_time)) : null,
                        'end_time' => $override->end_time ? date('g:i A', strtotime($override->end_time)) : null,
                        'is_manual' => $override->updated_at ? (Carbon::parse($override->updated_at)->year > 2000) : true,
                        'was_modified' => $override->created_at && $override->updated_at && Carbon::parse($override->created_at)->ne(Carbon::parse($override->updated_at)),
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
        /** @var \App\Models\User $user */
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
    
    public function setupSchedule()
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        
        if (!$user->canEditModule('attendance_setup')) {
            if (!$user->canViewModule('attendance_schedule_view')) {
                abort(403, 'Unauthorized access to Setup Schedule.');
            }
        }

        list($query, $branches) = $this->getIsolatedQuery('attendance_setup');

        return Inertia::render('Attendance/SetupSchedule', array_merge([
            'employees' => $this->mapEmployeeSchedules($query),
            'branches' => $branches
        ], $this->getSharedProps()));
    }

    public function calendar()
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        
        if (!$user->canViewModule('attendance_calendar')) {
            abort(403, 'Unauthorized access to Calendar.');
        }

        list($query, $branches) = $this->getIsolatedQuery('attendance_calendar');

        $currentYear = now()->year;
        $mathHolidaysRaw = array_merge(
            $this->getPhilippineHolidays($currentYear - 1),
            $this->getPhilippineHolidays($currentYear),
            $this->getPhilippineHolidays($currentYear + 1)
        );

        $mathHolidays = [];
        foreach ($mathHolidaysRaw as $date => $name) {
            $mathHolidays[$date] = [
                'id' => null, 
                'name' => $name,
            ];
        }

        $dbHolidaysRaw = \App\Models\Holiday::all();
        $dbHolidays = [];
        foreach ($dbHolidaysRaw as $h) {
            $dbHolidays[$h->date] = [
                'id' => $h->id,
                'name' => $h->name,
            ];
        }
        
        $holidays = array_replace($mathHolidays, $dbHolidays);

        return Inertia::render('Attendance/Calendar', array_merge([
            'employees' => $this->mapEmployeeSchedules($query),
            'branches' => $branches,
            'holidays' => $holidays 
        ], $this->getSharedProps()));
    }

    public function storeHoliday(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        
        if (!$user->canEditModule('attendance_calendar')) abort(403);
        
        $request->validate([
            'id' => 'nullable|numeric', 
            'date' => 'required|date',
            'name' => 'required|string|max:255'
        ]);

        if ($request->filled('id')) {
            $holiday = Holiday::findOrFail($request->id);
            $holiday->update(['date' => $request->date, 'name' => $request->name]);
        } else {
            Holiday::updateOrCreate(
                ['date' => $request->date],
                ['name' => $request->name]
            );
        }

        return redirect()->back()->with('success', 'Event/Holiday saved successfully.');
    }

    public function destroyHoliday(int $id)
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        
        if (!$user->canEditModule('attendance_calendar')) abort(403);
        
        $holiday = Holiday::find($id);
        if ($holiday) {
            $holiday->delete();
        }

        return redirect()->back()->with('success', 'Event/Holiday removed successfully.');
    }

    public function storeSchedule(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        
        if (!$user->canEditModule('attendance_setup')) abort(403);

        $request->validate([
            'employee_id' => 'required_without:employee_ids|nullable|exists:users,id',
            'employee_ids' => 'required_without:employee_id|nullable|array',
            'employee_ids.*' => 'exists:users,id',
            'cutoff_period' => 'required|string', 
            'pattern' => 'required|array',
            'pattern.*.is_off_day' => 'boolean',
            'pattern.*.is_leave' => 'boolean', 
            'pattern.*.shift_start' => 'nullable|string',
            'pattern.*.shift_end' => 'nullable|string',
            'pattern.*.shift_type' => 'nullable|string',
        ]);

        $employeeIds = $request->employee_ids ?: [$request->employee_id];
        
        list($startDate, $endDate) = explode('|', $request->cutoff_period);

        $firstWorkingDay = collect($request->pattern)->firstWhere(function ($day) {
            return !$day['is_off_day'] && !$day['is_leave'];
        });
        
        $fallbackType = $firstWorkingDay ? $firstWorkingDay['shift_type'] : 'Custom Pattern';
        $fallbackStart = $firstWorkingDay ? $firstWorkingDay['shift_start'] : '00:00:00';
        $fallbackEnd = $firstWorkingDay ? $firstWorkingDay['shift_end'] : '00:00:00';

        foreach ($employeeIds as $id) {
            Schedule::updateOrCreate(
                [
                    'user_id' => $id,
                    'start_date' => $startDate,
                    'end_date' => $endDate
                ],
                [
                    'pattern' => $request->pattern, 
                    'shift_type' => $fallbackType,   
                    'start_time' => $fallbackStart,  
                    'end_time' => $fallbackEnd,      
                    'off_days' => [],
                ]
            );
        }

        try {
            $usersToNotify = User::whereIn('id', $employeeIds)->get();
            $message = "📅Your schedule has been assigned for the cut-off period: $startDate to $endDate.";
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
        /** @var \App\Models\User $user */
        $user = Auth::user();
        
        if (!$user->canEditModule('attendance_setup')) abort(403);

        $request->validate([
            'cells' => 'required|array', 
            'is_off_day' => 'required|boolean',
            'is_leave' => 'required|boolean', 
            'shift_start' => 'nullable',
            'shift_end' => 'nullable',
            'shift_type' => 'nullable|string',
        ]);

        $affectedUserIds = [];
        $isInactive = $request->is_off_day || $request->is_leave;

        foreach ($request->cells as $cell) {
            $override = \App\Models\ScheduleOverride::firstOrNew([
                'user_id' => $cell['employee_id'],
                'date' => $cell['date'],
            ]);
            
            $override->is_off_day = $request->is_off_day;
            $override->is_leave = $request->is_leave; 
            $override->shift_type = $isInactive ? null : $request->shift_type;
            $override->start_time = $isInactive ? null : $request->shift_start;
            $override->end_time = $isInactive ? null : $request->shift_end;

            if ($override->exists) {
                $override->updated_at = now(); 
            }

            $override->save();
            $affectedUserIds[] = $cell['employee_id'];
        }

        try {
            $uniqueUserIds = array_unique($affectedUserIds);
            $usersToNotify = User::whereIn('id', $uniqueUserIds)->get();
            $message = "📅 Your schedule has been updated. Please check your calendar.";
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

        return redirect()->back()->with('success', 'Daily shifts applied successfully.');
    }

    public function resetOverride(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        
        if (!$user->canDeleteModule('attendance_setup')) abort(403);

        $request->validate([
            'cells' => 'required|array', 
        ]);

        foreach ($request->cells as $cell) {
            \App\Models\ScheduleOverride::where('user_id', $cell['employee_id'])
                ->where('date', $cell['date'])
                ->delete();
        }

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

        return redirect()->back()->with('success', 'Shifts reset successfully.');
    }

    public function importSchedule(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        
        if (!$user->canEditModule('attendance_setup')) abort(403);

        $request->validate([
            'file' => 'required|file',
        ]);

        try {
            $file = $request->file('file');
            $extension = strtolower($file->getClientOriginalExtension());
            $rows = [];

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

            $importedUserIds = [];

            for ($i = 2; $i < count($rows); $i++) {
                $row = $rows[$i];
                $employeeName = trim($row[0] ?? '');
                if (empty($employeeName)) continue;

                $employee = User::where('name', $employeeName)->first();
                if (!$employee) continue;

                $importedUserIds[] = $employee->id;

                $cellData = [];
                $shiftCounts = [];
                $dayOffTally = [];

                foreach ($columnDates as $colIndex => $dateString) {
                    $rawCell = $row[$colIndex] ?? '';
                    
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

                if (empty($shiftCounts)) {
                    Schedule::where('user_id', $employee->id)->where('start_date', $startDate)->where('end_date', $endDate)->delete();
                    \App\Models\ScheduleOverride::where('user_id', $employee->id)->whereIn('date', array_keys($cellData))->delete();
                    continue;
                }

                arsort($shiftCounts);
                $primaryShiftId = array_key_first($shiftCounts);
                $primaryShift = Shift::find($primaryShiftId);

                $baseOffDays = array_keys($dayOffTally);
                usort($baseOffDays, function ($a, $b) use ($weekOrder) {
                    return ($weekOrder[$a] ?? 0) <=> ($weekOrder[$b] ?? 0);
                });

                Schedule::updateOrCreate(
                    ['user_id' => $employee->id, 'start_date' => $startDate, 'end_date' => $endDate],
                    ['shift_type' => $primaryShift->shift_type, 'start_time' => $primaryShift->start_time, 'end_time' => $primaryShift->end_time, 'off_days' => $baseOffDays]
                );

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

            try {
                if (!empty($importedUserIds)) {
                    $uniqueUserIds = array_unique($importedUserIds);
                    $usersToNotify = User::whereIn('id', $uniqueUserIds)->get();
                    $message = "📅Your schedule has been assigned for the cut-off period: $startDate to $endDate.";
                    \Illuminate\Support\Facades\Notification::send($usersToNotify, new \App\Notifications\ScheduleAssigned($message));
                }
            } catch (\Exception $e) {}

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
        /** @var \App\Models\User $user */
        $user = Auth::user();
        
        if (!$user->canViewModule('attendance_overview')) abort(403);

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

        if ($request->filled('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }

        if ($request->filled('department')) {
            $query->whereHas('department', function($q) use ($request) {
                $q->where('name', $request->department);
            });
        }

        $rawEmployees = $query->get();

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
                            'is_leave' => (bool)$overrides[$ds]['is_leave'], 
                            'shift_type' => $overrides[$ds]['shift_type'],
                            'start_time' => $overrides[$ds]['start_time'] ? date('g:i A', strtotime($overrides[$ds]['start_time'])) : null,
                            'end_time' => $overrides[$ds]['end_time'] ? date('g:i A', strtotime($overrides[$ds]['end_time'])) : null,
                            'is_override' => isset($overrides[$ds]['updated_at']) ? (\Carbon\Carbon::parse($overrides[$ds]['updated_at'])->year > 2000) : true,
                        ];
                    } else {
                        foreach ($schedules as $sch) {
                            if ($ds >= $sch['start_date'] && $ds <= $sch['end_date']) {
                                if (isset($sch['pattern']) && isset($sch['pattern'][$dn])) {
                                    $dayConfig = $sch['pattern'][$dn];
                                    $shiftData = [
                                        'is_off' => (bool)$dayConfig['is_off_day'],
                                        'is_leave' => (bool)($dayConfig['is_leave'] ?? false), 
                                        'shift_type' => $dayConfig['shift_type'],
                                        'start_time' => $dayConfig['shift_start'] ? date('g:i A', strtotime($dayConfig['shift_start'])) : null,
                                        'end_time' => $dayConfig['shift_end'] ? date('g:i A', strtotime($dayConfig['shift_end'])) : null,
                                        'is_override' => false
                                    ];
                                } else {
                                    $shiftData = [
                                        'is_off' => in_array($dn, $sch['off_days'] ?? []),
                                        'is_leave' => false,
                                        'shift_type' => $sch['shift_type'],
                                        'start_time' => $sch['start_time'] ? date('g:i A', strtotime($sch['start_time'])) : null,
                                        'end_time' => $sch['end_time'] ? date('g:i A', strtotime($sch['end_time'])) : null,
                                        'is_override' => false
                                    ];
                                }
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

    private function getPhilippineHolidays(int $year)
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

        $easterDays = easter_days($year);
        $easter = \Carbon\Carbon::createFromDate($year, 3, 21)->addDays($easterDays);
        
        $holidays[$easter->copy()->subDays(3)->format('Y-m-d')] = "Maundy Thursday";
        $holidays[$easter->copy()->subDays(2)->format('Y-m-d')] = "Good Friday";
        $holidays[$easter->copy()->subDays(1)->format('Y-m-d')] = "Black Saturday";
        $holidays[$easter->format('Y-m-d')] = "Easter Sunday";

        $heroesDay = \Carbon\Carbon::parse("last monday of august $year")->format('Y-m-d');
        $holidays[$heroesDay] = "National Heroes Day";

        return $holidays;
    }
}