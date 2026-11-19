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
        $request->validate(['file' => 'required|file|mimes:xlsx|max:2048', 'columns'=>'sometimes|array|max:100', 'columns.*'=>'string|max:100']);
        $reader = IOFactory::createReader('Xlsx');
        $reader->setReadDataOnly(false);
        $book = null;
        try {
            $info = $reader->listWorksheetInfo($request->file('file')->getRealPath());
            abort_if(empty($info) || $info[0]['totalRows'] > 502 || $info[0]['totalColumns'] > 101, 422, 'Use at most 500 data rows and 100 columns.');
            $reader->setLoadSheetsOnly($info[0]['worksheetName']);
            $book = $reader->load($request->file('file')->getRealPath());
            $sheet = $book->getSheet(0);
            $errors = [];
            foreach ($sheet->getCellCollection()->getCoordinates() as $coordinate) {
                if ($sheet->getCell($coordinate)->getDataType() === DataType::TYPE_FORMULA) $errors[] = "Cell {$coordinate}: formulas are not allowed. Replace the formula with its value.";
            }
            $bounds = \App\Support\WorkbookLayout::bounds($sheet);
            abort_unless($bounds, 422, 'The workbook is empty. Download the template and add at least one record.');
            [$firstColumn, $headerRow] = $bounds;
            $rows = \App\Support\WorkbookLayout::rows($sheet);
            $headings = array_map(fn ($value) => preg_replace('/\s+/', '_', strtolower(trim((string) $value))), array_shift($rows) ?? []);
            foreach ($headings as $index => $heading) {
                $cell = Coordinate::stringFromColumnIndex($firstColumn + $index).$headerRow;
                if ($heading === '') $errors[] = "Cell {$cell}: column heading is missing.";
                if ($heading !== '' && count(array_keys($headings, $heading)) > 1) $errors[] = "Cell {$cell}: duplicate heading '{$heading}'. Use each heading once.";
            }
            $missing = array_diff($request->input('columns', []), $headings);
            foreach ($missing as $column) $errors[] = 'Missing column: '.$column.'. Download the latest template.';
            if ($errors) throw \Illuminate\Validation\ValidationException::withMessages(['file' => $errors]);
            $result = [];
            foreach ($rows as $index => $row) {
                $values = array_map(fn ($value) => trim((string) $value), $row);
                if (count(array_filter($values, fn ($value) => $value !== '')) === 0) continue;
                $result[] = [...array_combine($headings, $values), '_sheet_row'=>$headerRow + $index + 1];
            }
            abort_if(!$result, 422, "Add at least one record below the headings in row {$headerRow}.");
            abort_if(count($result) > 500, 422, 'Import at most 500 records at a time.');
            return response()->json(['rows' => $result]);
        } catch (\Illuminate\Validation\ValidationException $error) { throw $error; }
        catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $error) { throw $error; }
        catch (\Throwable $error) {
            throw \Illuminate\Validation\ValidationException::withMessages(['file'=>'The workbook could not be read. Save it as an unencrypted .xlsx file and try again.']);
        } finally { $book?->disconnectWorksheets(); }
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
            \App\Support\WorkbookLayout::prepare($book);
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
                \App\Support\WorkbookLayout::prepare($book);
            (new Xlsx($book))->save('php://output');
            } finally {
                $book->disconnectWorksheets();
            }
        }, 'export.xlsx', ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }
}
