<?php

use App\Services\AssetTagGenerator;

it('maps branch names and codes to tag prefixes', function () {
    expect(AssetTagGenerator::codeForBranch('Greenhills'))->toBe('GH')
        ->and(AssetTagGenerator::codeForBranch(' makati '))->toBe('MKT')
        ->and(AssetTagGenerator::codeForBranch('ALB'))->toBe('ALB')
        ->and(AssetTagGenerator::codeForBranch('{"code":"GH","name":"Greenhills"}'))->toBe('GH')
        ->and(AssetTagGenerator::codeForBranch('Quezon City'))->toBeNull()
        ->and(AssetTagGenerator::codeForBranch(null))->toBeNull()
        ->and(AssetTagGenerator::codeForBranch(''))->toBeNull();
});

it('uses the next number after the highest tag for the branch', function () {
    expect(AssetTagGenerator::nextFromTags('GH', ['GH-00001', 'GH-00377', 'GH-00100']))->toBe('GH-00378')
        ->and(AssetTagGenerator::nextFromTags('MKT', ['MKT-01140', 'MKT-01145']))->toBe('MKT-01146')
        ->and(AssetTagGenerator::nextFromTags('GH', []))->toBe('GH-00001');
});

it('counts the end of a range so a new tag never falls inside it', function () {
    expect(AssetTagGenerator::highestNumber('GH', 'GH-00004-00022'))->toBe(22)
        ->and(AssetTagGenerator::highestNumber('GH', 'GH-00206-208'))->toBe(208)
        ->and(AssetTagGenerator::highestNumber('GH', 'GH-00212-14'))->toBe(214)
        ->and(AssetTagGenerator::nextFromTags('GH', ['GH-00377', 'GH-00378-00380']))->toBe('GH-00381');
});

it('ignores tags for another prefix or in a different format', function () {
    expect(AssetTagGenerator::highestNumber('GH', 'MKT-01145'))->toBe(0)
        ->and(AssetTagGenerator::highestNumber('GH', 'AST-41C0611D'))->toBe(0)
        ->and(AssetTagGenerator::highestNumber('GH', '00138-00139'))->toBe(0)
        ->and(AssetTagGenerator::highestNumber('ALB', 'ALB-2022-000042'))->toBe(0)
        ->and(AssetTagGenerator::nextFromTags('ALB', ['ALB-2022-000042', 'ALB-2022-000087']))->toBe('ALB-00001');
});

it('makes tags safe to use as file names', function () {
    expect(AssetTagGenerator::fileSafe('GH-00034'))->toBe('GH-00034')
        ->and(AssetTagGenerator::fileSafe('GH-00004/00022 CCTV'))->toBe('GH-00004-00022-CCTV')
        ->and(AssetTagGenerator::fileSafe('  ../x  '))->toBe('x');
});
