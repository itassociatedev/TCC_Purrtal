<?php

use App\Services\AccountabilityPdfService;
use Tests\TestCase;

uses(TestCase::class);

function accountabilityPdfUser(): object
{
    return (object) [
        'name' => 'Sample Employee',
        'department' => (object) ['name' => 'Operations'],
        'branches' => collect([(object) ['name' => 'Greenhills']]),
    ];
}

function accountabilityPdfAsset(int $number, string $remarks = ''): object
{
    return (object) [
        'name' => 'Asset '.$number,
        'asset_tag' => sprintf('GH-%05d', $number),
        'serial_no' => 'SERIAL-'.$number,
        'model_no' => null,
        'condition' => 'Good',
        'remarks' => $remarks,
    ];
}

it('renders the empty state and acknowledgment without assigned assets', function () {
    $pdf = app(AccountabilityPdfService::class)->render(accountabilityPdfUser(), collect(), collect());

    expect($pdf)->toStartWith('%PDF-1.4')
        ->toContain('No assets assigned')
        ->toContain('Acknowledgment')
        ->toContain('Employee Signature')
        ->toContain('IT Department Representative')
        ->toContain('%%EOF');
});

it('includes every asset and creates continuation pages for large lists', function () {
    $assets = collect(range(1, 45))->map(fn ($number) => accountabilityPdfAsset($number));
    $pdf = app(AccountabilityPdfService::class)->render(accountabilityPdfUser(), $assets, collect());

    expect($pdf)->toContain('GH-00001')
        ->toContain('GH-00045')
        ->toContain('PAGE 2')
        ->toContain('Acknowledgment');
});

it('wraps long remarks and escapes PDF delimiters', function () {
    $remark = str_repeat('Long remark with (parentheses) and serial notes. ', 12).str_repeat('X', 5000).' LONG-END';
    $pdf = app(AccountabilityPdfService::class)->render(
        accountabilityPdfUser(),
        collect([accountabilityPdfAsset(1, $remark)]),
        collect([accountabilityPdfAsset(2, 'Shared asset')]),
    );

    expect($pdf)->toContain('parentheses')
        ->toContain('LONG-END')
        ->toContain('Shared asset')
        ->toContain('IT Department Representative');
});
