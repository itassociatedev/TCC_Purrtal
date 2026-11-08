<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class SpreadsheetImportController extends Controller
{
    public function read(Request $request)
    {
        $request->validate(['file' => 'required|file|mimes:xlsx|max:2048']);
        $reader = IOFactory::createReader('Xlsx');
        $reader->setReadDataOnly(true);
        $info = $reader->listWorksheetInfo($request->file('file')->getRealPath());
        abort_if(empty($info) || $info[0]['totalRows'] > 501 || $info[0]['totalColumns'] > 100, 422, 'Use at most 500 data rows and 100 columns.');
        $reader->setLoadSheetsOnly($info[0]['worksheetName']);
        $book = $reader->load($request->file('file')->getRealPath());
        try {
            $rows = $book->getSheet(0)->toArray('', false, true, false);
            $headings = array_map(fn ($value) => preg_replace('/\s+/', '_', strtolower(trim((string) $value))), array_shift($rows) ?? []);
            abort_if(!$headings || in_array('', $headings, true) || count(array_unique($headings)) !== count($headings), 422, 'Headings must be unique and non-empty.');
            $result = [];
            foreach ($rows as $row) {
                $values = array_map(fn ($value) => trim((string) $value), $row);
                if (count(array_filter($values, fn ($value) => $value !== '')) === 0) continue;
                $result[] = array_combine($headings, $values);
            }
            abort_if(!$result, 422, 'Include a header and at least one data row.');
            return response()->json(['rows' => $result]);
        } finally {
            $book->disconnectWorksheets();
        }
    }

    public function template(Request $request)
    {
        $data = $request->validate(['columns' => 'required|array|min:1|max:100', 'columns.*' => 'required|string|max:100', 'sample' => 'present|array|max:100', 'sample.*' => 'nullable|string|max:1000']);
        return response()->streamDownload(function () use ($data) {
            $book = new Spreadsheet();
            $sheet = $book->getActiveSheet();
            $sheet->setTitle('Import Template');
            foreach ([$data['columns'], $data['sample']] as $row => $values) {
                foreach ($values as $column => $value) {
                    $display = $row === 0 ? ucwords(str_replace('_', ' ', (string) $value)) : (string) $value;
                    $sheet->setCellValueExplicitByColumnAndRow($column + 1, $row + 1, $display, DataType::TYPE_STRING);
                    $letter = Coordinate::stringFromColumnIndex($column + 1);
                    $width = min(34, max(16, mb_strlen((string) ($data['columns'][$column] ?? '')) + 3, mb_strlen((string) ($data['sample'][$column] ?? '')) + 3));
                    $sheet->getColumnDimension($letter)->setWidth($width);
                }
            }
            $lastColumn = Coordinate::stringFromColumnIndex(max(1, count($data['columns'])));
            $sheet->getStyle("A1:{$lastColumn}1")->applyFromArray([
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => '243247']],
                'alignment' => ['vertical' => 'center', 'wrapText' => true],
            ]);
            if ($data['sample']) {
                $sheet->getStyle("A2:{$lastColumn}2")->applyFromArray([
                    'font' => ['color' => ['rgb' => '52627A']],
                    'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => 'F1F5F9']],
                    'alignment' => ['vertical' => 'top', 'wrapText' => true],
                ]);
                $sheet->getRowDimension(2)->setRowHeight(32);
            }
            $sheet->getRowDimension(1)->setRowHeight(28);
            $sheet->freezePane('A2');
            $sheet->setAutoFilter("A1:{$lastColumn}1");
            (new Xlsx($book))->save('php://output');
            $book->disconnectWorksheets();
        }, 'import-template.xlsx', ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }

    public function export(Request $request)
    {
        $data = $request->validate([
            'columns' => 'required|array|min:1|max:100',
            'columns.*' => 'required|string|max:200',
            'rows' => 'present|array|max:50000',
            'rows.*' => 'array|max:100',
            'rows.*.*' => 'nullable|string|max:100000',
        ]);
        return response()->streamDownload(function () use ($data) {
            $book = new Spreadsheet();
            try {
                $sheet = $book->getActiveSheet();
                $sheet->setTitle('Export');
                $lastColumnIndex = max(1, count($data['columns']));
                $lastColumn = Coordinate::stringFromColumnIndex($lastColumnIndex);
                $lastRow = count($data['rows']) + 1;

                foreach ([$data['columns'], ...$data['rows']] as $row => $values) {
                    foreach ($values as $column => $value) {
                        $display = $row === 0
                            ? ucwords(str_replace('_', ' ', (string) $value))
                            : (string) $value;
                        $sheet->setCellValueExplicitByColumnAndRow($column + 1, $row + 1, $display, DataType::TYPE_STRING);
                    }
                }

                // Keep exports readable in Excel and visually consistent with the XLSX import template.
                foreach ($data['columns'] as $index => $heading) {
                    $maxLength = mb_strlen(ucwords(str_replace('_', ' ', (string) $heading)));
                    foreach (array_slice($data['rows'], 0, 100) as $row) {
                        $maxLength = max($maxLength, mb_strlen((string) ($row[$index] ?? '')));
                    }
                    $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($index + 1))
                        ->setWidth(min(40, max(16, $maxLength + 2)));
                }

                $sheet->getStyle("A1:{$lastColumn}{$lastRow}")->applyFromArray([
                    'alignment' => ['vertical' => 'top', 'wrapText' => true],
                    'borders' => ['bottom' => ['borderStyle' => 'thin', 'color' => ['rgb' => 'D9E2F0']]],
                ]);
                $sheet->getStyle("A1:{$lastColumn}1")->applyFromArray([
                    'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                    'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => '243247']],
                    'alignment' => ['vertical' => 'center', 'wrapText' => true],
                ]);
                if ($lastRow > 1) {
                    $sheet->getStyle("A2:{$lastColumn}{$lastRow}")->applyFromArray([
                        'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => 'F1F5F9']],
                        'font' => ['color' => ['rgb' => '334155']],
                    ]);
                    $sheet->getDefaultRowDimension()->setRowHeight(-1);
                }
                $sheet->getRowDimension(1)->setRowHeight(30);
                $sheet->freezePane('A2');
                $sheet->setAutoFilter("A1:{$lastColumn}{$lastRow}");
                (new Xlsx($book))->save('php://output');
            } finally {
                $book->disconnectWorksheets();
            }
        }, 'export.xlsx', ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }
}
