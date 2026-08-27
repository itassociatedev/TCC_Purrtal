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
        // Your exact mapped headers
        return ['Supplier Name', 'Product Name', 'Measurement', 'Description', 'Price'];
    }

    public function array(): array
    {
        // The example data row for the users to follow
        return [
            ['Example Supplier Inc.', 'Paracetamol 500mg', 'Box', 'Box of 100 tablets', '150.00']
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

                // 1. Auto-size all columns so the text isn't cut off
                foreach (range('A', 'E') as $columnID) {
                    $sheet->getColumnDimension($columnID)->setAutoSize(true);
                }

                // 2. Wrap the data in an interactive Excel Data Table with filters
                $table = new \PhpOffice\PhpSpreadsheet\Worksheet\Table();
                $table->setRange('A1:E2');
                $table->setName('ProductsTemplateTable');
                $table->setShowFilter(true);
                $sheet->addTable($table);
            },
        ];
    }
}