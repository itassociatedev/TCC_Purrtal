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

    public function __construct($employees, $dates, $weekRange)
    {
        $this->employees = $employees;
        $this->dates = $dates;
        $this->weekRange = $weekRange;
    }

    public function view(): View
    {
        return view('exports.attendance_overview', [
            'employees' => $this->employees,
            'dates' => $this->dates,
            'weekRange' => $this->weekRange
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