<?php

use App\Services\AssetAccountabilityFormPdfService;

uses(Tests\TestCase::class);

function formAsset(int $i, string $remarks = ''): object
{
    return (object) ['name' => "Item $i", 'asset_tag' => sprintf('GH-%05d', $i), 'serial_no' => null, 'model_no' => 'M'.$i, 'condition' => 'Good', 'remarks' => $remarks];
}

it('starts each employee on a new page and numbers pages across the whole pdf', function () {
    $user = fn ($n) => (object) ['name' => $n, 'department' => null, 'branches' => collect()];
    $pdf = app(AssetAccountabilityFormPdfService::class)->render([
        ['user' => $user('Ana'), 'personal' => collect(range(1, 80))->map(fn ($i) => formAsset($i)), 'shared' => []],
        ['user' => $user('Ben'), 'personal' => [formAsset(200, str_repeat('long remark ', 30))], 'shared' => []],
    ], [formAsset(300)]);

    preg_match('/Page (\d+) of (\d+)/', $pdf, $m);
    $pages = substr_count($pdf, '/Type /Page ');
    expect($pdf)->toStartWith('%PDF-1.4')
        ->and($pages)->toBeGreaterThanOrEqual(4)
        ->and($pdf)->toContain("of $pages)")
        ->and(substr_count($pdf, '(Acknowledgment)'))->toBe(2);
});
