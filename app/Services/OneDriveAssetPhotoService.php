<?php

namespace App\Services;

use App\Models\Asset;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OneDriveAssetPhotoService
{
    public function upload(Asset $asset, string $contents, string $mimeType, string $extension, int $revision): array
    {
        $config = config('services.onedrive');
        $branchCode = $this->branchCode($asset);
        $branchFolder = $config['branch_folders'][$branchCode] ?? null;
        if (blank($branchFolder)) {
            throw new RuntimeException('No OneDrive folder is configured for branch '.$branchCode.'.');
        }

        $extension = strtolower(preg_replace('/[^a-z0-9]/i', '', $extension) ?: 'jpg');
        // Upload to a new, deterministic versioned name. The previous approved
        // image stays intact until the database approval commits successfully.
        $assetTag = preg_replace('/[^a-z0-9._-]+/i', '-', trim((string) $asset->asset_tag)) ?? '';
        $assetTag = trim($assetTag, '.-_');
        $filename = ($assetTag !== '' ? $assetTag : 'asset-'.$asset->id).'-'.$revision.'.'.$extension;
        $folder = trim((string) ($config['folder_path'] ?? ''), '/').'/'.trim((string) $branchFolder, '/');
        $path = collect(array_filter([$folder, $filename]))
            ->flatMap(fn (string $part) => explode('/', $part))
            ->map(fn (string $part) => rawurlencode($part))
            ->implode('/');

        $response = Http::withToken($this->token())
            ->withBody($contents, $mimeType)
            ->put($this->driveRoot($config).'/root:/'.$path.':/content')
            ->throw();

        return [
            'item_id' => $response->json('id'),
            'url' => $response->json('webUrl'),
            'filename' => $filename,
            'branch_code' => $branchCode,
        ];
    }

    public function download(string $itemId): array
    {
        $config = config('services.onedrive');
        if ((blank($config['site_id'] ?? null) && blank($config['user_id'] ?? null)) || blank($itemId)) {
            throw new RuntimeException('The approved OneDrive photo reference is incomplete.');
        }

        $response = Http::withToken($this->token())
            ->get($this->driveRoot($config).'/items/'.rawurlencode($itemId).'/content')
            ->throw();

        return ['contents' => $response->body(), 'content_type' => $response->header('Content-Type') ?: 'image/jpeg'];
    }

    public function delete(string $itemId): void
    {
        $config = config('services.onedrive');
        if ((blank($config['site_id'] ?? null) && blank($config['user_id'] ?? null)) || blank($itemId)) {
            return;
        }

        Http::withToken($this->token())
            ->delete($this->driveRoot($config).'/items/'.rawurlencode($itemId))
            ->throw();
    }

    private function token(): string
    {
        $config = config('services.onedrive');
        foreach (['tenant_id', 'client_id', 'client_secret'] as $key) {
            if (blank($config[$key] ?? null)) {
                throw new RuntimeException('OneDrive is not configured: missing ONEDRIVE_'.strtoupper($key).'.');
            }
        }
        if (blank($config['site_id'] ?? null) && blank($config['user_id'] ?? null)) {
            throw new RuntimeException('OneDrive is not configured: set ONEDRIVE_SITE_ID or ONEDRIVE_USER_ID.');
        }

        return Http::asForm()->post(
            'https://login.microsoftonline.com/'.rawurlencode($config['tenant_id']).'/oauth2/v2.0/token',
            [
                'client_id' => $config['client_id'],
                'client_secret' => $config['client_secret'],
                'scope' => 'https://graph.microsoft.com/.default',
                'grant_type' => 'client_credentials',
            ]
        )->throw()->json('access_token');
    }

    private function driveRoot(array $config): string
    {
        if (filled($config['site_id'] ?? null)) {
            return 'https://graph.microsoft.com/v1.0/sites/'.rawurlencode($config['site_id']).'/drive';
        }

        return 'https://graph.microsoft.com/v1.0/users/'.rawurlencode($config['user_id']).'/drive';
    }

    private function branchCode(Asset $asset): string
    {
        $branch = trim((string) $asset->branch);
        if (str_starts_with($branch, '{')) {
            $branch = (string) (json_decode($branch, true)['code'] ?? json_decode($branch, true)['name'] ?? '');
        }
        $normalized = strtoupper(preg_replace('/[^a-z0-9]/i', '', $branch));
        $known = [
            'GH' => ['GH', 'GREENHILLS'],
            'MKT' => ['MKT', 'MAKATI'],
            'ALB' => ['ALB', 'ALABANG'],
        ];
        foreach ($known as $code => $names) {
            if (in_array($normalized, $names, true)) {
                return $code;
            }
        }

        if (preg_match('/^(GH|MKT|ALB)(?:[-_\s]|\d|$)/i', trim($asset->asset_tag), $match)) {
            return strtoupper($match[1]);
        }

        throw new RuntimeException('The asset branch could not be matched to a configured OneDrive branch folder.');
    }
}
