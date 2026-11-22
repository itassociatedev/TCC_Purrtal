<?php

namespace App\Services;

use App\Models\Asset;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OneDriveAssetPhotoService
{
    public function upload(Asset $asset, string $contents, string $mimeType, string $extension): array
    {
        $config = config('services.onedrive');
        foreach (['tenant_id', 'client_id', 'client_secret', 'user_id'] as $key) {
            if (blank($config[$key] ?? null)) {
                throw new RuntimeException('OneDrive is not configured: missing ONEDRIVE_' . strtoupper($key) . '.');
            }
        }

        $token = Http::asForm()->post(
            'https://login.microsoftonline.com/' . rawurlencode($config['tenant_id']) . '/oauth2/v2.0/token',
            [
                'client_id' => $config['client_id'],
                'client_secret' => $config['client_secret'],
                'scope' => 'https://graph.microsoft.com/.default',
                'grant_type' => 'client_credentials',
            ]
        )->throw()->json('access_token');

        $filename = preg_replace('/[^A-Za-z0-9._-]+/', '-', $asset->asset_tag) . '.' . strtolower($extension);
        $folder = trim((string) ($config['folder_path'] ?? ''), '/');
        $path = collect(array_filter([$folder, $filename]))
            ->flatMap(fn (string $part) => explode('/', $part))
            ->map(fn (string $part) => rawurlencode($part))
            ->implode('/');

        $response = Http::withToken($token)
            ->withHeaders(['Content-Type' => $mimeType])
            ->put('https://graph.microsoft.com/v1.0/users/' . rawurlencode($config['user_id']) . '/drive/root:/' . $path . ':/content', $contents)
            ->throw();

        return ['item_id' => $response->json('id'), 'url' => $response->json('webUrl'), 'filename' => $filename];
    }
}
