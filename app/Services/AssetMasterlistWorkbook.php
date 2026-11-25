<?php

namespace App\Services;

use Illuminate\Support\Collection;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Builds the "Asset Roll" Excel masterlist (logo, title, branch/date block, grouped column headers, one row
 * per asset), laid out like the Project Brave masterfile (Project-Brave-GH.xlsx). Column A and row 1 are an
 * empty margin, so everything starts at B2. The header names match what the workbook importer understands,
 * so an exported file can be imported again.
 */
class AssetMasterlistWorkbook
{
    /** Row of the logo and title (row 1 is the top margin). */
    private const TOP_ROW = 2;

    private const GROUP_ROW = 8;

    private const HEADER_ROW = 9;

    private const FIRST_DATA_ROW = 10;

    private const NAVY = '2C4676';

    private const CURRENCY = '_([$PHP]\ * #,##0.00_);_([$PHP]\ * \(#,##0.00\);_([$PHP]\ * "-"??_);_(@_)';

    /** Column key => [letter, header, width]. Column A is the left margin. */
    private const COLUMNS = [
        'num' => ['B', '#', 6],
        'name' => ['C', 'Name', 32],
        'tag' => ['D', 'Tag', 18],
        'branch' => ['E', 'Branch', 15],
        'category' => ['F', 'Category', 22],
        'department' => ['G', 'Department', 20],
        'personnel' => ['H', 'Assigned Personnel', 27],
        'area' => ['I', 'Area', 18],
        'date' => ['J', 'Date', 13],
        'supplier' => ['K', 'Supplier', 19],
        'warranty' => ['L', 'Warranty Expiration', 15],
        'condition' => ['M', 'Condition', 14],
        'unit' => ['N', 'Unit Value', 18],
        'qty' => ['O', 'Qty', 8],
        'total' => ['P', 'Total Value', 19],
        'classification' => ['Q', 'Asset Classification', 24],
        'model' => ['R', 'Model No.', 21],
        'serial' => ['S', 'Serial No.', 23],
        'color' => ['T', 'Color', 14],
        'status' => ['U', 'Status', 14],
        'accountability' => ['V', 'Accountability Form', 17],
        'remarks' => ['W', 'Remarks', 32],
        'photo' => ['X', 'Photo/Info Link', 24],
    ];

    /** Group label => [first column key, last column key]. */
    private const GROUPS = [
        'Item Description' => ['name', 'branch'],
        'Location' => ['category', 'area'],
        'Purchase Information' => ['date', 'supplier'],
        'Quantity and Value' => ['warranty', 'qty'],
        'Item Details' => ['total', 'photo'],
    ];

    /** @param Collection<int, \App\Models\Asset> $assets Assets with user, accountableUsers and photoSubmissions loaded. */
    public function build(Collection $assets): Spreadsheet
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Asset Roll');
        $sheet->setShowGridlines(false);
        $sheet->getDefaultRowDimension()->setRowHeight(18);

        // Margin: an empty column A and an empty row 1.
        $sheet->getColumnDimension('A')->setWidth(2.5);
        $sheet->getRowDimension(1)->setRowHeight(10);
        foreach (self::COLUMNS as [$letter, , $width]) {
            $sheet->getColumnDimension($letter)->setWidth($width);
        }

        $last = self::FIRST_DATA_ROW + max($assets->count(), 1) - 1;
        $this->title($sheet, $assets, $last);
        $this->headers($sheet);
        $this->rows($sheet, $assets);

        $sheet->setAutoFilter($this->col('num').self::HEADER_ROW.':'.$this->col('photo').($assets->isEmpty() ? self::HEADER_ROW : $last));
        // Keep the title block and column headers in view, plus the margin, # and Name columns (like the masterfile).
        $sheet->freezePane('D'.self::FIRST_DATA_ROW);
        $sheet->getPageSetup()->setOrientation('landscape')->setFitToWidth(1)->setFitToHeight(0);
        $sheet->getPageSetup()->setRowsToRepeatAtTopByStartAndEnd(self::GROUP_ROW, self::HEADER_ROW);
        $sheet->getSheetView()->setZoomScale(90);

        return $spreadsheet;
    }

    public function download(Collection $assets, string $filename): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $spreadsheet = $this->build($assets);

        return response()->streamDownload(function () use ($spreadsheet) {
            (new Xlsx($spreadsheet))->save('php://output');
        }, $filename, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }

    private function col(string $key): string
    {
        return self::COLUMNS[$key][0];
    }

    private function title($sheet, Collection $assets, int $last): void
    {
        $branches = $assets->map(fn ($asset) => $this->branchName($asset->branch))->filter()->unique()->values();
        $branchLabel = $branches->count() === 1 ? $branches->first() : ($branches->isEmpty() ? '-' : 'All Branches');

        // Rows 2 to 4: logo in B2, title to its right. The title starts in column D so the frozen columns never split it.
        $this->logo($sheet);
        $titleFrom = $this->col('tag');
        $titleTo = $this->col('qty');
        $sheet->mergeCells($titleFrom.self::TOP_ROW.':'.$titleTo.self::TOP_ROW);
        $sheet->setCellValue($titleFrom.self::TOP_ROW, 'TCC ASSETS');
        $sheet->getStyle($titleFrom.self::TOP_ROW)->applyFromArray(['font' => ['name' => 'Arial', 'size' => 24, 'bold' => true, 'color' => ['rgb' => '3B4E87']], 'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER]]);
        $sheet->getRowDimension(self::TOP_ROW)->setRowHeight(40);
        $sheet->getRowDimension(3)->setRowHeight(18);
        $sheet->getRowDimension(4)->setRowHeight(18);

        // Info block under the logo (rows 5 to 7): label in C, value in D.
        $labels = [5 => 'Branch:', 6 => 'Last Update:', 7 => 'Assets in this file:'];
        foreach ($labels as $row => $label) {
            $sheet->setCellValue('C'.$row, $label);
            $sheet->getStyle('C'.$row)->getFont()->setName('Trebuchet MS')->setBold(true)->setSize(10);
            $sheet->getStyle('D'.$row)->getFont()->setName('Trebuchet MS')->setSize(10);
            $sheet->getStyle('D'.$row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
        }
        $this->text($sheet, 'D5', $branchLabel);
        $sheet->setCellValue('D6', ExcelDate::PHPToExcel(now()));
        $sheet->getStyle('D6')->getNumberFormat()->setFormatCode('d-mmm-yy');
        $sheet->setCellValue('D7', $assets->count());

        // Total inventory value, right-aligned above the Unit Value / Qty / Total Value columns.
        $labelFrom = $this->col('unit');
        $labelTo = $this->col('qty');
        $totalCol = $this->col('total');
        $sheet->setCellValue($labelFrom.'6', 'Total Inventory Value:');
        $sheet->mergeCells($labelFrom.'6:'.$labelTo.'6');
        $sheet->setCellValue($totalCol.'6', '=SUM('.$totalCol.self::FIRST_DATA_ROW.':'.$totalCol.$last.')');
        $sheet->getStyle($labelFrom.'6')->getFont()->setName('Trebuchet MS')->setBold(true)->setSize(10);
        $sheet->getStyle($labelFrom.'6')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        $sheet->getStyle($totalCol.'6')->applyFromArray([
            'font' => ['name' => 'Arial', 'bold' => true, 'size' => 10],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F4F4F4']],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'BFBFBF']]],
        ]);
        $sheet->getStyle($totalCol.'6')->getNumberFormat()->setFormatCode(self::CURRENCY);
    }

    /** The clinic logo (cat and "The Cat Clinic" text) sits in the top-left corner at B2, like the masterfile. */
    private function logo($sheet): void
    {
        $path = resource_path('images/tcc-clinic-logo.png');
        if (! is_file($path)) {
            return;
        }
        $drawing = new \PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
        $drawing->setName('The Cat Clinic')->setDescription('The Cat Clinic logo')->setPath($path)->setCoordinates($this->col('num').self::TOP_ROW)->setOffsetX(2)->setOffsetY(2)->setHeight(94)->setWorksheet($sheet);
    }

    private function headers($sheet): void
    {
        foreach (self::GROUPS as $label => [$fromKey, $toKey]) {
            $from = $this->col($fromKey);
            $to = $this->col($toKey);
            $sheet->mergeCells($from.self::GROUP_ROW.':'.$to.self::GROUP_ROW);
            $sheet->setCellValue($from.self::GROUP_ROW, $label);
            $sheet->getStyle($from.self::GROUP_ROW.':'.$to.self::GROUP_ROW)->applyFromArray([
                'font' => ['name' => 'Trebuchet MS', 'size' => 12, 'bold' => true, 'color' => ['rgb' => self::NAVY]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                'borders' => ['bottom' => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['rgb' => self::NAVY]]],
            ]);
        }
        $sheet->getRowDimension(self::GROUP_ROW)->setRowHeight(26);

        foreach (self::COLUMNS as [$letter, $header]) {
            $sheet->setCellValue($letter.self::HEADER_ROW, $header);
        }
        $range = $this->col('num').self::HEADER_ROW.':'.$this->col('photo').self::HEADER_ROW;
        $sheet->getStyle($range)->applyFromArray([
            'font' => ['name' => 'Arial', 'size' => 11, 'bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => self::NAVY]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'FFFFFF']]],
        ]);
        $sheet->getRowDimension(self::HEADER_ROW)->setRowHeight(34);
    }

    private function rows($sheet, Collection $assets): void
    {
        $row = self::FIRST_DATA_ROW;
        foreach ($assets->values() as $index => $asset) {
            $sheet->setCellValue($this->col('num').$row, $index + 1);
            $this->text($sheet, $this->col('name').$row, $asset->name);
            // Tags are text, even when they look like numbers or ranges (GH-00004-00022).
            $this->text($sheet, $this->col('tag').$row, $asset->asset_tag);
            $this->text($sheet, $this->col('branch').$row, $this->branchName($asset->branch));
            $this->text($sheet, $this->col('category').$row, $asset->category);
            $this->text($sheet, $this->col('department').$row, $asset->department);
            $this->text($sheet, $this->col('personnel').$row, $this->personnel($asset));
            $this->text($sheet, $this->col('area').$row, $asset->area);
            if ($asset->purchase_date) {
                $sheet->setCellValue($this->col('date').$row, ExcelDate::PHPToExcel(\Carbon\Carbon::parse($asset->purchase_date)));
            }
            $this->text($sheet, $this->col('supplier').$row, $asset->supplier?->name ?? $asset->supplier_name);
            if ($asset->warranty_expiration) {
                $sheet->setCellValue($this->col('warranty').$row, ExcelDate::PHPToExcel(\Carbon\Carbon::parse($asset->warranty_expiration)));
            }
            $this->text($sheet, $this->col('condition').$row, $asset->condition);
            $sheet->setCellValue($this->col('unit').$row, (float) $asset->unit_value);
            $sheet->setCellValue($this->col('qty').$row, max(1, (int) $asset->qty));
            $sheet->setCellValue($this->col('total').$row, '='.$this->col('unit').$row.'*'.$this->col('qty').$row);
            $this->text($sheet, $this->col('classification').$row, $asset->classification);
            $this->text($sheet, $this->col('model').$row, $asset->model_no);
            $this->text($sheet, $this->col('serial').$row, $asset->serial_no);
            $this->text($sheet, $this->col('color').$row, $asset->color);
            $this->text($sheet, $this->col('status').$row, $asset->asset_status);
            $this->text($sheet, $this->col('accountability').$row, $asset->accountability_type ? ucfirst($asset->accountability_type) : '');
            $this->text($sheet, $this->col('remarks').$row, $asset->remarks);
            $this->photoLink($sheet, $this->col('photo').$row, $asset);
            $row++;
        }

        $last = max($row - 1, self::FIRST_DATA_ROW);
        $sheet->getStyle($this->col('num').self::FIRST_DATA_ROW.':'.$this->col('photo').$last)->applyFromArray([
            'font' => ['name' => 'Trebuchet MS', 'size' => 9],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'D0D5DD']]],
        ]);
        foreach (['name', 'personnel', 'remarks', 'photo'] as $left) {
            $sheet->getStyle($this->col($left).self::FIRST_DATA_ROW.':'.$this->col($left).$last)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT)->setIndent(1);
        }
        $sheet->getStyle($this->col('tag').self::FIRST_DATA_ROW.':'.$this->col('tag').$last)->getFont()->setBold(true);
        foreach (['unit', 'total'] as $money) {
            $sheet->getStyle($this->col($money).self::FIRST_DATA_ROW.':'.$this->col($money).$last)->getNumberFormat()->setFormatCode(self::CURRENCY);
        }
        foreach (['date', 'warranty'] as $date) {
            $sheet->getStyle($this->col($date).self::FIRST_DATA_ROW.':'.$this->col($date).$last)->getNumberFormat()->setFormatCode('m/d/yyyy');
        }
        $sheet->getStyle($this->col('total').self::FIRST_DATA_ROW.':'.$this->col('total').$last)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F4F4F4');
        for ($r = self::FIRST_DATA_ROW; $r < $row; $r += 2) {
            // Light banding on every other row keeps long lists readable (Total Value keeps its own grey).
            $sheet->getStyle($this->col('num').$r.':'.$this->col('qty').$r)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F7F9FC');
            $sheet->getStyle($this->col('classification').$r.':'.$this->col('photo').$r)->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F7F9FC');
        }
    }

    /** Text cells are always written as text, so a value such as "=1+1" or "+SUM(...)" is never run as a formula. */
    private function text($sheet, string $cell, $value): void
    {
        $value = (string) ($value ?? '');
        if ($value !== '') {
            $sheet->setCellValueExplicit($cell, $value, DataType::TYPE_STRING);
        }
    }

    private function photoLink($sheet, string $cell, $asset): void
    {
        $approved = $asset->relationLoaded('photoSubmissions')
            && $asset->photoSubmissions->where('status', 'approved')->whereNotNull('onedrive_item_id')->isNotEmpty();
        if (! $approved && ! $asset->image_path) {
            return;
        }
        $url = $approved ? route('assets.photo.show', $asset->id) : (str_starts_with((string) $asset->image_path, 'http') ? $asset->image_path : url($asset->image_path));
        $sheet->setCellValue($cell, 'View photo');
        $sheet->getCell($cell)->getHyperlink()->setUrl($url);
        $sheet->getStyle($cell)->getFont()->getColor()->setRGB('1D4ED8');
        $sheet->getStyle($cell)->getFont()->setUnderline(true);
    }

    private function personnel($asset): string
    {
        $people = $asset->relationLoaded('accountableUsers') ? $asset->accountableUsers->pluck('name')->filter()->values() : collect();
        if ($people->isNotEmpty()) {
            return $people->implode(', ');
        }

        return (string) ($asset->user?->name ?: $asset->assigned_personnel ?: '');
    }

    private function branchName($branch): string
    {
        $branch = trim((string) $branch);
        if ($branch !== '' && str_starts_with($branch, '{')) {
            $decoded = json_decode($branch, true);

            return trim((string) ($decoded['name'] ?? $decoded['code'] ?? ''));
        }

        return $branch;
    }
}
