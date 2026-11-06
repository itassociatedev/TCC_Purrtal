<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
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
            foreach ([$data['columns'], $data['sample']] as $row => $values) {
                foreach ($values as $column => $value) $sheet->setCellValueExplicitByColumnAndRow($column + 1, $row + 1, (string) $value, DataType::TYPE_STRING);
            }
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
                foreach ([$data['columns'], ...$data['rows']] as $row => $values) {
                    foreach ($values as $column => $value) {
                        $sheet->setCellValueExplicitByColumnAndRow($column + 1, $row + 1, (string) $value, DataType::TYPE_STRING);
                    }
                }
                $sheet->freezePane('A2');
                (new Xlsx($book))->save('php://output');
            } finally {
                $book->disconnectWorksheets();
            }
        }, 'export.xlsx', ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }
}
