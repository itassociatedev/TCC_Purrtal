<?php
namespace Tests\Feature;
use Tests\TestCase;
use App\Support\WorkbookLayout;
use App\Http\Controllers\SpreadsheetImportController;
use Illuminate\Http\{Request,UploadedFile};
use PhpOffice\PhpSpreadsheet\{Spreadsheet,IOFactory};
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
class WorkbookLayoutTest extends TestCase
{
    private function upload(Spreadsheet $book, array $columns): array {
        $path=tempnam(sys_get_temp_dir(),'tcc-xlsx-');
        try {
            (new Xlsx($book))->save($path);
            $request=Request::create('/spreadsheet-import/read','POST',['columns'=>$columns],[],['file'=>new UploadedFile($path,'sample.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',null,true)]);
            return (new SpreadsheetImportController)->read($request)->getData(true);
        } finally { @unlink($path); $book->disconnectWorksheets(); }
    }
    public function test_layout_hides_gridlines_and_b2_import_round_trips(): void {
        $book=new Spreadsheet();$sheet=$book->getActiveSheet();$sheet->fromArray([['title','description'],['Task','Check computers']]);
        WorkbookLayout::prepare($book);
        $this->assertFalse($sheet->getShowGridlines());$this->assertSame('title',$sheet->getCell('B2')->getValue());$this->assertNull($sheet->getCell('A1')->getValue());
        $data=$this->upload($book,['title','description']);
        $this->assertSame('Task',$data['rows'][0]['title']);$this->assertSame(3,$data['rows'][0]['_sheet_row']);
    }
    public function test_older_a1_imports_remain_readable(): void {
        $book=new Spreadsheet();$book->getActiveSheet()->fromArray([['title'],['Task']]);
        $data=$this->upload($book,['title']);$this->assertSame('Task',$data['rows'][0]['title']);$this->assertSame(2,$data['rows'][0]['_sheet_row']);
    }
    public function test_missing_heading_names_the_field(): void {
        $book=new Spreadsheet();$book->getActiveSheet()->fromArray([['title'],['Task']]);
        $this->expectException(\Illuminate\Validation\ValidationException::class);$this->expectExceptionMessage('description');
        $this->upload($book,['title','description']);
    }
    public function test_common_export_and_template_both_begin_at_b2(): void {
        foreach(['template','export'] as $method) {
            $data=['columns'=>['title','description']]+($method==='template'?['sample'=>['Task','Check computers']]:['rows'=>[['Task','Check computers']]]);
            $request=Request::create('/spreadsheet-import/'.$method,'POST',$data);
            $response=(new SpreadsheetImportController)->{$method}($request);
            ob_start();$response->sendContent();$bytes=ob_get_clean();$path=tempnam(sys_get_temp_dir(),'tcc-export-');
            try { file_put_contents($path,$bytes);$book=IOFactory::load($path);$sheet=$book->getActiveSheet();$this->assertSame('Title',$sheet->getCell('B2')->getValue());$this->assertSame('Task',$sheet->getCell('B3')->getValue());$zip=new \ZipArchive();$zip->open($path);$this->assertStringContainsString('showGridLines="false"',$zip->getFromName('xl/worksheets/sheet1.xml'));$zip->close();$book->disconnectWorksheets(); }
            finally { @unlink($path); }
        }
    }
    public function test_laravel_excel_exports_use_the_same_layout(): void {
        $export=new class implements \Maatwebsite\Excel\Concerns\FromArray { public function array(): array { return [['Name','Status'],['David','Active']]; } };
        $bytes=\Maatwebsite\Excel\Facades\Excel::raw($export,\Maatwebsite\Excel\Excel::XLSX);$path=tempnam(sys_get_temp_dir(),'tcc-excel-');
        try { file_put_contents($path,$bytes);$book=IOFactory::load($path);$this->assertSame('Name',$book->getActiveSheet()->getCell('B2')->getValue());$zip=new \ZipArchive();$zip->open($path);$this->assertStringContainsString('showGridLines="false"',$zip->getFromName('xl/worksheets/sheet1.xml'));$zip->close();$book->disconnectWorksheets(); }
        finally { @unlink($path); }
    }
}
