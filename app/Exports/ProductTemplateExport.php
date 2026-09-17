<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class ProductTemplateExport implements FromArray, WithHeadings, WithStyles, WithEvents
{
    public function headings(): array
    {
        // 🟢 Added 'Smallest Unit' between Product Name and Details
        return ['Supplier Name', 'Product Name', 'Smallest Unit', 'Details', 'Unit', 'Price'];
    }

    public function array(): array
    {
        // 🟢 Added an example 'Smallest Unit' (e.g., '1 Tablet') to the example row
        return [
            ['Example Supplier Inc.', 'Paracetamol 500mg', '1 Tablet', 'Box of 100 tablets', 'Box', '150.00']
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [
            // Style the heading row (Row 1)
            1 => [
                'font' => [
                    'name'  => 'Segoe UI Semibold',
                    'size'  => 11,
                    'color' => ['argb' => 'FFFFFFFF'], // White text
                ],
                'fill' => [
                    'fillType'   => Fill::FILL_SOLID,
                    'startColor' => ['argb' => 'FF203864'], // Professional Navy Blue
                ],
            ],
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function(AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();

                // 🟢 Expanded range to 'F' to cover the new 6th column
                foreach (range('A', 'F') as $columnID) {
                    $sheet->getColumnDimension($columnID)->setAutoSize(true);
                }

                // 🟢 Expanded the interactive Excel Table range to 'F2'
                $table = new \PhpOffice\PhpSpreadsheet\Worksheet\Table();
                $table->setRange('A1:F2');
                $table->setName('ProductsTemplateTable');
                $sheet->addTable($table);
            },
        ];
    }
}
