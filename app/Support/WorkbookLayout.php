<?php
namespace App\Support;

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

final class WorkbookLayout
{
    /** Common workbook margins and readable formatting; existing domain layouts remain intact. */
    public static function prepare(Spreadsheet $book): void
    {
        foreach ($book->getAllSheets() as $sheet) {
            $sheet->setShowGridlines(false);
            $sheet->setPrintGridlines(false);
            if ($sheet->getSheetState() !== Worksheet::SHEETSTATE_VISIBLE) continue;
            $bounds = self::bounds($sheet);
            if (!$bounds) continue;
            [$column, $row] = $bounds;
            if ($row < 2) $sheet->insertNewRowBefore(1, 2 - $row);
            if ($column < 2) $sheet->insertNewColumnBefore('A', 2 - $column);
            $last = $sheet->getHighestDataColumn();
            $sheet->getColumnDimension('A')->setWidth(3);
            $sheet->getRowDimension(1)->setRowHeight(12);
            $sheet->getRowDimension(2)->setRowHeight(28);
            $sheet->getStyle("B2:{$last}2")->applyFromArray([
                'font'=>['bold'=>true,'color'=>['rgb'=>'FFFFFF']],
                'fill'=>['fillType'=>'solid','startColor'=>['rgb'=>'243247']],
                'alignment'=>['wrapText'=>true,'vertical'=>'center'],
            ]);
            $sheet->freezePane('C3');
        }
    }

    public static function bounds(Worksheet $sheet): ?array
    {
        $row = PHP_INT_MAX; $column = PHP_INT_MAX;
        foreach ($sheet->getCellCollection()->getCoordinates() as $coordinate) {
            $cell = $sheet->getCell($coordinate);
            if ($cell->getValue() === null || $cell->getValue() === '') continue;
            [$letter, $number] = Coordinate::coordinateFromString($coordinate);
            $row = min($row, $number);
            $column = min($column, Coordinate::columnIndexFromString($letter));
        }
        return $row === PHP_INT_MAX ? null : [$column, $row];
    }

    public static function headingRow(string $path): int
    {
        $reader = \PhpOffice\PhpSpreadsheet\IOFactory::createReader('Xlsx');
        $reader->setReadDataOnly(true);
        $book = $reader->load($path);
        try { return self::bounds($book->getSheet(0))[1] ?? 1; }
        finally { $book->disconnectWorksheets(); }
    }

    /** Support both older A1 workbooks and the new B2 format. */
    public static function rows(Worksheet $sheet): array
    {
        $bounds = self::bounds($sheet);
        if (!$bounds) return [];
        [$column, $row] = $bounds;
        return $sheet->rangeToArray(Coordinate::stringFromColumnIndex($column).$row.':'.$sheet->getHighestDataColumn().$sheet->getHighestDataRow(), null, false, false, false);
    }
}
