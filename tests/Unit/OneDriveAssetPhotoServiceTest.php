<?php

use App\Models\Asset;
use App\Services\OneDriveAssetPhotoService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    config()->set('services.onedrive', [
        'enabled' => true,
        'tenant_id' => 'tenant-test',
        'client_id' => 'client-test',
        'client_secret' => 'secret-test',
        'user_id' => 'onedrive-owner@example.test',
        'site_id' => null,
        'folder_path' => 'TCC Purrtal/Asset Photos',
        'branch_folders' => ['GH' => 'Greenhills', 'MKT' => 'Makati', 'ALB' => 'Alabang'],
    ]);
});

it('uploads to the configured branch folder using the asset tag and submission version', function () {
    Http::fake([
        'https://login.microsoftonline.com/*' => Http::response(['access_token' => 'test-token']),
        'https://graph.microsoft.com/v1.0/*' => Http::response(['id' => 'drive-item-44', 'webUrl' => 'https://onedrive.example.test/item']),
    ]);
    $asset = new Asset(['branch' => 'Greenhills', 'asset_tag' => 'GH-00044']);
    $asset->id = 44;
    $imageBytes = "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\xFF\xD9";

    $result = app(OneDriveAssetPhotoService::class)->upload($asset, $imageBytes, 'image/jpeg', 'jpg', 91);

    expect($result['item_id'])->toBe('drive-item-44')
        ->and($result['filename'])->toBe('GH-00044-91.jpg')
        ->and($result['branch_code'])->toBe('GH');

    Http::assertSent(fn ($request) => $request->method() === 'PUT'
        && str_contains($request->url(), 'Asset%20Photos/Greenhills/GH-00044-91.jpg:/content')
        && $request->body() === $imageBytes
        && $request->hasHeader('Content-Type', 'image/jpeg')
        && $request->hasHeader('Authorization', 'Bearer test-token'));
});

it('uses the asset tag branch code if the branch name is missing', function () {
    Http::fake([
        'https://login.microsoftonline.com/*' => Http::response(['access_token' => 'test-token']),
        'https://graph.microsoft.com/v1.0/*' => Http::response(['id' => 'drive-item-45', 'webUrl' => 'https://onedrive.example.test/item']),
    ]);
    $asset = new Asset(['branch' => null, 'asset_tag' => 'MKT-00045']);
    $asset->id = 45;

    $result = app(OneDriveAssetPhotoService::class)->upload($asset, 'jpeg-bytes', 'image/jpeg', 'jpg', 92);

    expect($result['branch_code'])->toBe('MKT')
        ->and($result['filename'])->toBe('MKT-00045-92.jpg');
    Http::assertSent(fn ($request) => str_contains($request->url(), 'Asset%20Photos/Makati/MKT-00045-92.jpg:/content'));
});

it('refuses to upload an asset whose branch cannot be routed safely', function () {
    $asset = new Asset(['branch' => 'Unknown branch', 'asset_tag' => 'TCC-00046']);
    $asset->id = 46;

    expect(fn () => app(OneDriveAssetPhotoService::class)->upload($asset, 'bytes', 'image/jpeg', 'jpg', 93))
        ->toThrow(RuntimeException::class, 'branch could not be matched');
});

it('can read approved image bytes through the selected site drive endpoint', function () {
    config()->set('services.onedrive.site_id', 'tenant.sharepoint.com,site-guid,web-guid');
    Http::fake([
        'https://login.microsoftonline.com/*' => Http::response(['access_token' => 'test-token']),
        'https://graph.microsoft.com/v1.0/*' => Http::response('image-bytes', 200, ['Content-Type' => 'image/jpeg']),
    ]);

    $file = app(OneDriveAssetPhotoService::class)->download('drive-item-47');

    expect($file['contents'])->toBe('image-bytes')->and($file['content_type'])->toBe('image/jpeg');
    Http::assertSent(fn ($request) => $request->method() === 'GET'
        && str_contains($request->url(), '/sites/tenant.sharepoint.com%2Csite-guid%2Cweb-guid/drive/items/drive-item-47/content'));
});
