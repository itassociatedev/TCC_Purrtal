<?php

use App\Models\Asset;
use App\Services\AssetMasterlistWorkbook;

uses(Tests\TestCase::class);

it('builds the asset roll sheet starting at B2 with grouped headers, text tags and a total formula', function () {
    $assets = collect([
        new Asset(['name' => 'CCTV', 'asset_tag' => 'GH-00004-00022', 'branch' => 'Greenhills', 'unit_value' => 2500, 'qty' => 19, 'condition' => 'Good', 'remarks' => 'Hallway']),
        new Asset(['name' => 'Router', 'asset_tag' => 'MKT-01140', 'branch' => 'Makati', 'unit_value' => 1000, 'qty' => 1, 'condition' => 'Good']),
    ]);

    $sheet = app(AssetMasterlistWorkbook::class)->build($assets)->getActiveSheet();

    // Column A and row 1 are an empty margin.
    foreach (['A1', 'B1', 'A2', 'A9', 'A10'] as $cell) {
        expect($sheet->getCell($cell)->getValue())->toBeNull();
    }
    expect($sheet->getDrawingCollection())->toHaveCount(1)
        ->and($sheet->getDrawingCollection()[0]->getCoordinates())->toBe('B2')
        ->and($sheet->getCell('D2')->getValue())->toBe('TCC ASSETS')
        ->and($sheet->getCell('D5')->getValue())->toBe('All Branches')
        ->and($sheet->getCell('D7')->getValue())->toBe(2)
        ->and($sheet->getCell('C8')->getValue())->toBe('Item Description')
        ->and($sheet->getCell('B9')->getValue())->toBe('#')
        ->and($sheet->getCell('D9')->getValue())->toBe('Tag')
        ->and($sheet->getCell('D10')->getValue())->toBe('GH-00004-00022')
        ->and($sheet->getCell('P10')->getValue())->toBe('=N10*O10')
        ->and($sheet->getCell('P6')->getValue())->toBe('=SUM(P10:P11)')
        ->and($sheet->getCell('W10')->getValue())->toBe('Hallway')
        ->and($sheet->getFreezePane())->toBe('D10');
});

it('does not split the title across the frozen columns', function () {
    $sheet = app(AssetMasterlistWorkbook::class)->build(collect())->getActiveSheet();

    // The frozen area is columns A to C; the title is merged entirely to the right of it.
    expect($sheet->getMergeCells())->toHaveKey('D2:O2');
});

it('writes text cells as text so a value starting with = or + is never a formula', function () {
    $asset = new Asset(['name' => '=1+1', 'asset_tag' => 'GH-77777', 'branch' => 'Greenhills', 'unit_value' => 10, 'qty' => 1, 'condition' => 'Good',
        'remarks' => '=HYPERLINK("http://evil.test","x")', 'supplier_name' => '+SUM(1,1)', 'department' => '@cmd', 'category' => '-2+3', 'area' => '=A1', 'color' => '=1']);

    $sheet = app(AssetMasterlistWorkbook::class)->build(collect([$asset]))->getActiveSheet();

    foreach (['C10', 'F10', 'G10', 'I10', 'K10', 'T10', 'W10'] as $cell) {
        expect($sheet->getCell($cell)->getDataType())->toBe('s');
    }
    // The total column is the one place a formula is intended.
    expect($sheet->getCell('P10')->getDataType())->toBe('f');
});
