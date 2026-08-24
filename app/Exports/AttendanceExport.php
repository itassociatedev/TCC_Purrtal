<?php

namespace App\Exports;

use Illuminate\Contracts\View\View;
use Maatwebsite\Excel\Concerns\FromView;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class AttendanceExport implements FromView, ShouldAutoSize, WithStyles
{
    protected $employees;
    protected $dates;
    protected $weekRange;
    protected $formatOnly; // 🟢 NEW FLAG

    public function __construct($employees, $dates, $weekRange, $formatOnly = false)
    {
        $this->employees = $employees;
        $this->dates = $dates;
        $this->weekRange = $weekRange;
        $this->formatOnly = $formatOnly;
    }

    public function view(): View
    {
        return view('exports.attendance_overview', [
            'employees' => $this->employees,
            'dates' => $this->dates,
            'weekRange' => $this->weekRange,
            'formatOnly' => $this->formatOnly // 🟢 PASS TO BLADE VIEW
        ]);
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => ['font' => ['bold' => true, 'size' => 14]],
            2 => ['font' => ['bold' => true]],
        ];
    }
}