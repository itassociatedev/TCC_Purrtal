<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Models\AssetPhotoSubmission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use App\Services\OneDriveAssetPhotoService;
use App\Support\AssetAccess;
use Illuminate\Support\Str;

class AssetPhotoController extends Controller
{
    public function capture(Request $request)
    {
        abort_unless(AssetAccess::canEnter($request->user()), 403);
        $assets = Asset::select('id', 'name', 'asset_tag', 'image_path')->orderBy('asset_tag')->get();
        $pendingAssetIds = AssetPhotoSubmission::where('status', 'pending')->pluck('asset_id');
        $requestedAsset = $assets->firstWhere('id', (int) $request->query('asset_id'));
        $nextAsset = $requestedAsset && blank($requestedAsset->image_path) && !$pendingAssetIds->contains($requestedAsset->id)
            ? $requestedAsset
            : $assets->first(fn ($asset) => blank($asset->image_path) && !$pendingAssetIds->contains($asset->id));
        return Inertia::render('Assets/PhotoCapture', [
            'assets' => $assets,
            'nextAssetId' => $nextAsset?->id,
            'rejectedSubmissions' => AssetPhotoSubmission::with(['asset:id,name,asset_tag', 'submitter:id,name', 'reviewer:id,name'])->where('submitted_by', $request->user()->id)->where('status', 'rejected')->latest()->get(),
        ]);
    }

    public function index(Request $request)
    {
        $user = $request->user();
        abort_unless(AssetAccess::canReviewPhotos($user), 403);

        return Inertia::render('Assets/PhotoReview', [
            'pendingCount' => AssetPhotoSubmission::where('status', 'pending')->count(),
            'pendingSubmissions' => AssetPhotoSubmission::with(['asset:id,name,asset_tag', 'submitter:id,name'])->where('status', 'pending')->latest()->paginate(25),
            'rejectedSubmissions' => AssetPhotoSubmission::with(['asset:id,name,asset_tag', 'submitter:id,name', 'reviewer:id,name'])->where('status', 'rejected')->latest()->paginate(25),
        ]);
    }

    public function submit(Request $request)
    {
        abort_unless(AssetAccess::canEnter($request->user()), 403);
        $data = $request->validate([
            'asset_id' => ['required', 'exists:assets,id'],
            'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);

        $photo = $request->file('photo');
        $path = 'asset-photos/pending/' . Str::uuid() . '.jpg';
        Storage::disk('local')->put($path, $this->compressedJpeg($photo));
        AssetPhotoSubmission::create(['asset_id' => $data['asset_id'], 'submitted_by' => $request->user()->id, 'temporary_path' => $path]);

        return back()->with('success', 'Photo submitted for IT review.');
    }

    public function decide(Request $request, AssetPhotoSubmission $submission)
    {
        $user = $request->user();
        abort_unless(AssetAccess::canReviewPhotos($user), 403);

        $data = $request->validate(['decision' => ['required', 'in:approved,rejected'], 'reason' => ['nullable', 'string', 'max:1000']]);
        abort_if($submission->status !== 'pending', 422, 'Only pending photos can be reviewed.');
        $error = $this->applyDecision($submission, $data['decision'], $data['reason'] ?? null, $user->id);
        if ($error) return back()->withErrors(['photo' => $error]);

        return back()->with('success', $data['decision'] === 'approved'
            ? (config('services.onedrive.enabled') ? 'Photo approved and uploaded to OneDrive.' : 'Photo approved and saved locally while OneDrive integration is on hold.')
            : 'Photo rejected and returned to the submitter.');
    }

    public function bulkDecide(Request $request)
    {
        $user = $request->user();
        abort_unless(AssetAccess::canReviewPhotos($user), 403);

        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:asset_photo_submissions,id'],
            'decision' => ['required', 'in:approved,rejected'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $processed = 0;
        $failed = [];
        $submissions = AssetPhotoSubmission::whereIn('id', $data['ids'])->where('status', 'pending')->get();
        foreach ($submissions as $submission) {
            $error = $this->applyDecision($submission, $data['decision'], $data['reason'] ?? null, $user->id);
            if ($error) $failed[] = $submission->asset?->asset_tag . ': ' . $error;
            else $processed++;
        }

        if ($failed) {
            return back()->withErrors(['photo' => "{$processed} photo(s) processed. The remaining photo(s) stayed pending: " . implode(' | ', $failed)]);
        }

        return back()->with('success', "{$processed} photo(s) {$data['decision']} successfully.");
    }

    private function applyDecision(AssetPhotoSubmission $submission, string $decision, ?string $reason, int $reviewerId): ?string
    {
        if ($decision === 'rejected') {
            $submission->update(['status' => 'rejected', 'rejection_reason' => $reason, 'reviewed_by' => $reviewerId, 'reviewed_at' => now()]);
            return null;
        }

        $asset = $submission->asset;
        if (!$asset) return 'The related asset no longer exists.';

        try {
            $extension = pathinfo($submission->temporary_path, PATHINFO_EXTENSION) ?: 'jpg';
            $contents = Storage::disk('local')->get($submission->temporary_path);
            if (config('services.onedrive.enabled')) {
                $uploaded = app(OneDriveAssetPhotoService::class)->upload($asset, $contents, 'image/jpeg', $extension);
            } else {
                $approvedPath = 'assets/images/' . Str::slug($asset->asset_tag ?: $asset->id) . '.jpg';
                Storage::disk('public')->put($approvedPath, $contents);
                $uploaded = ['url' => Storage::disk('public')->url($approvedPath), 'item_id' => null];
            }
        } catch (\Throwable $e) {
            return 'The photo was not uploaded to OneDrive and remains pending.';
        }

        $asset->update(['image_path' => $uploaded['url'], 'photo_path' => $uploaded['url']]);
        Storage::disk('local')->delete($submission->temporary_path);
        $submission->update(['status' => 'approved', 'reviewed_by' => $reviewerId, 'reviewed_at' => now(), 'onedrive_item_id' => $uploaded['item_id'], 'onedrive_url' => $uploaded['url']]);
        return null;
    }

    private function compressedJpeg($file): string
    {
        $bytes = $file->get();
        if (! function_exists('imagecreatefromstring') || ! function_exists('imagejpeg')) return $bytes;
        $info = @getimagesizefromstring($bytes);
        if (!$info || empty($info[0]) || empty($info[1])) return $bytes;
        $memoryLimit = $this->memoryLimitBytes(ini_get('memory_limit'));
        $estimated = (int) $info[0] * (int) $info[1] * 6;
        if ($memoryLimit > 0 && memory_get_usage(true) + $estimated > (int) ($memoryLimit * 0.72)) return $bytes;
        $image = @imagecreatefromstring($bytes);
        if (! $image) return $bytes;
        $width = imagesx($image); $height = imagesy($image); $max = 2200;
        if ($width > $max || $height > $max) {
            $scale = min($max / $width, $max / $height);
            $targetWidth = max(1, (int) ($width * $scale));
            $targetHeight = max(1, (int) ($height * $scale));
            $targetMemory = $targetWidth * $targetHeight * 6;
            if ($memoryLimit > 0 && memory_get_usage(true) + $targetMemory > (int) ($memoryLimit * 0.82)) {
                imagedestroy($image);
                return $bytes;
            }
            $resized = imagecreatetruecolor($targetWidth, $targetHeight);
            imagecopyresampled($resized, $image, 0, 0, 0, 0, imagesx($resized), imagesy($resized), $width, $height);
            imagedestroy($image); $image = $resized;
        }
        ob_start(); imagejpeg($image, null, 82); $compressed = ob_get_clean(); imagedestroy($image);
        return $compressed ?: $bytes;
    }

    private function memoryLimitBytes(?string $limit): int
    {
        if (!$limit || $limit === '-1') return 0;
        $unit = strtolower(substr($limit, -1));
        $value = (float) $limit;
        return (int) ($unit === 'g' ? $value * 1024 * 1024 * 1024 : ($unit === 'm' ? $value * 1024 * 1024 : ($unit === 'k' ? $value * 1024 : $value)));
    }

    public function preview(Request $request, AssetPhotoSubmission $submission)
    {
        $user = $request->user();
        abort_unless(AssetAccess::canReviewPhotos($user) || (AssetAccess::canEnter($user) && $submission->submitted_by === $user->id), 403);
        abort_unless(Storage::disk('local')->exists($submission->temporary_path), 404);
        return response()->file(Storage::disk('local')->path($submission->temporary_path));
    }
}
