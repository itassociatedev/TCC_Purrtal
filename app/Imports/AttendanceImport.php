<?php

namespace App\Imports;

use App\Models\User;
use App\Models\Schedule;
use App\Models\Shift;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Carbon\Carbon;

class AttendanceImport implements ToCollection
{
    protected $startDate;
    protected $endDate;

    public function __construct($startDate, $endDate)
    {
        $this->startDate = $startDate;
        $this->endDate = $endDate;
    }

    public function collection(Collection $rows)
    {
        // Skip header rows (Row 0 is the Title, Row 1 contains the Headers)
        $dataRows = $rows->slice(2);

        $weekOrder = ['Monday' => 1, 'Tuesday' => 2, 'Wednesday' => 3, 'Thursday' => 4, 'Friday' => 5, 'Saturday' => 6, 'Sunday' => 7];

        foreach ($dataRows as $row) {
            $employeeName = trim($row[0]);
            if (empty($employeeName)) continue;

            // Match the employee by name
            $employee = User::where('name', $employeeName)->first();
            if (!$employee) continue;

            $offDays = [];
            $detectedShift = null;

            $currentDate = Carbon::parse($this->startDate);
            $endDateObj = Carbon::parse($this->endDate);
            
            // Loop through columns horizontally, starting from index 2 (Column C)
            $colIndex = 2;
            while ($currentDate->lte($endDateObj) && isset($row[$colIndex])) {
                $cellValue = trim($row[$colIndex]);
                
                if (strtolower($cellValue) === 'off day') {
                    $offDays[] = $currentDate->format('l');
                } elseif (!empty($cellValue) && !str_contains(strtolower($cellValue), 'no shift')) {
                    // Extract shift name (first line of the cell if there are line breaks)
                    $lines = explode("\n", $cellValue);
                    $shiftName = trim($lines[0]);
                    
                    if (!$detectedShift) {
                        $detectedShift = Shift::where('name', $shiftName)->orWhere('shift_type', $shiftName)->first();
                    }
                }

                $currentDate->addDay();
                $colIndex++;
            }

            // 🟢 If a shift was found on their row, set up the base Schedule!
            if ($detectedShift) {
                $uniqueOffDays = array_unique($offDays);
                usort($uniqueOffDays, function ($a, $b) use ($weekOrder) {
                    return ($weekOrder[$a] ?? 0) <=> ($weekOrder[$b] ?? 0);
                });

                Schedule::updateOrCreate(
                    [
                        'user_id' => $employee->id,
                        'start_date' => $this->startDate,
                        'end_date' => $this->endDate
                    ],
                    [
                        'shift_type' => $detectedShift->shift_type,
                        'start_time' => $detectedShift->start_time,
                        'end_time' => $detectedShift->end_time,
                        'off_days' => $uniqueOffDays,
                    ]
                );
            } else {
                // If the entire row is blank or "No Shift", we wipe their schedule for this cutoff.
                Schedule::where('user_id', $employee->id)
                    ->where('start_date', $this->startDate)
                    ->where('end_date', $this->endDate)
                    ->delete();
            }
        }
    }
}