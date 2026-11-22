<?php

namespace App\Exports;

use App\Models\Branch;
use App\Models\Department;
use App\Models\Supplier;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;

class AssetTemplateExport implements WithHeadings, WithEvents
{
    public function headings(): array
    {
        return [
            'Asset Name', 'Asset Tag', 'Serial No.', 'Model No.', 'Color',
            'Category', 'Status', 'Condition', 'Assigned Personnel',
            'Department', 'Branch', 'Area', 'Supplier', 'Purchased Date',
            'Warranty Exp.', 'Qty', 'Unit Value', 'Deviation'
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function(AfterSheet $event) {
                $categories = 'Office Equipment|Furniture|Electronics|Vehicles|Tools|Kitchenware|Clothing|Software Licenses|Other';
                $departments = Department::pluck('name')->implode('|', '|');
                $branches = Branch::pluck('name')->implode('|', '|');
                $suppliers = Supplier::pluck('name')->implode('|', '|');
                $conditions = 'Excellent|Good|Fair|Poor';
                $statuses = 'New|Assigned|In Storage|Maintenance|Disposed';
                $classifications = 'NONCURRENT|SUPPLIES';

                $sheet = $event->sheet->getDelegate();

                // Apply dropdowns to Rows 2 through 500
                for ($row = 2; $row <= 500; $row++) {
                    // Column F: Category
                    $validation = $sheet->getCell("F{$row}")->getDataValidation();
                    $validation->setType(DataValidation::TYPE_LIST)
                        ->setErrorStyle(DataValidation::STYLE_INFORMATION)
                        ->setAllowBlank(true)
                        ->setShowDropDown(true)
                        ->setFormula1('"' . $categories . '"');

                    // Column H: Condition
                    $validation = $sheet->getCell("H{$row}")->getDataValidation();
                    $validation->setType(DataValidation::TYPE_LIST)
                        ->setErrorStyle(DataValidation::STYLE_INFORMATION)
                        ->setAllowBlank(true)
                        ->setShowDropDown(true)
                        ->setFormula1('"' . $conditions . '"');

                    // Column G: Status
                    $validation = $sheet->getCell("G{$row}")->getDataValidation();
                    $validation->setType(DataValidation::TYPE_LIST)
                        ->setErrorStyle(DataValidation::STYLE_INFORMATION)
                        ->setAllowBlank(true)
                        ->setShowDropDown(true)
                        ->setFormula1('"' . $statuses . '"');
                }
            },
        ];
    }
}