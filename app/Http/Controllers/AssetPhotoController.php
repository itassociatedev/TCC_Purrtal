<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Models\AssetPhotoSubmission;
use App\Models\User;
use App\Services\OneDriveAssetPhotoService;
use App\Support\AssetAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;

class AssetPhotoController extends Controller
{
    public function capture(Request $request)
    {
        abort_unless(AssetAccess::canEnter($request->user()), 403);
        $user = $request->user();
        $assets = Asset::select('id', 'name', 'asset_tag', 'image_path')->orderBy('asset_tag')->get();
        $pendingAssetIds = AssetPhotoSubmission::where('status', 'pending')->pluck('asset_id');
        $requestedAsset = $assets->firstWhere('id', (int) $request->query('asset_id'));
        $nextAsset = $requestedAsset && blank($requestedAsset->image_path) && ! $pendingAssetIds->contains($requestedAsset->id)
            ? $requestedAsset
            : $assets->first(fn ($asset) => blank($asset->image_path) && ! $pendingAssetIds->contains($asset->id));

        // Entry users see only their own rejected submissions here. Reviewers
        // can access the broader history from the separate review screen.
        $rejectedQuery = AssetPhotoSubmission::with(['asset:id,name,asset_tag', 'submitter:id,name', 'reviewer:id,name'])
            ->where('status', 'rejected');
        if (! AssetAccess::isFullManager($user)) {
            $rejectedQuery->where('submitted_by', $user->id);
        }
        $rejectedSubmissions = $rejectedQuery->latest()->get();
        $this->attachDraftAssetData($rejectedSubmissions);

        return Inertia::render('Assets/PhotoCapture', [
            'assets' => $assets,
            'nextAssetId' => $nextAsset?->id,
            'rejectedSubmissions' => $rejectedSubmissions,
        ]);
    }

    public function index(Request $request)
    {
        $user = $request->user();
        abort_unless(AssetAccess::canReviewPhotos($user), 403);

        // Rejected history visibility: IT interns + full-access see all; others see only own
        $rejectedQuery = AssetPhotoSubmission::with(['asset:id,name,asset_tag,branch,department,category', 'submitter:id,name', 'reviewer:id,name'])
            ->where('status', 'rejected');
        if (! AssetAccess::isItIntern($user) && ! AssetAccess::isFullManager($user)) {
            $rejectedQuery->where('submitted_by', $user->id);
        }

        return Inertia::render('Assets/PhotoReview', [
            'pendingCount' => AssetPhotoSubmission::where('status', 'pending')->count(),
            'pendingSubmissions' => $this->reviewQueue(),
            'rejectedSubmissions' => $rejectedQuery->latest()->paginate(25),
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
        if (AssetPhotoSubmission::where('asset_id', $data['asset_id'])->where('status', 'pending')->exists()) {
            return back()->withErrors(['photo' => 'This asset already has a photo waiting for IT review.']);
        }
        $contents = $this->compressedJpeg($photo);
        $path = $this->storePendingPhoto($photo, $contents);
        AssetPhotoSubmission::create(['asset_id' => $data['asset_id'], 'submission_type' => 'photo_update', 'submitted_by' => $request->user()->id, 'temporary_path' => $path]);

        return back()->with('success', 'Photo submitted for IT review.');
    }

    public function decide(Request $request, AssetPhotoSubmission $submission)
    {
        $user = $request->user();
        abort_unless(AssetAccess::canReviewPhotos($user), 403);

        $data = $request->validate(['decision' => ['required', 'in:approved,rejected'], 'reason' => ['nullable', 'string', 'max:1000']]);
        abort_if($submission->status !== 'pending', 422, 'Only pending photos can be reviewed.');
        $error = $this->applyDecision($submission, $data['decision'], $data['reason'] ?? null, $user->id);
        if ($error) {
            return back()->withErrors(['photo' => $error]);
        }

        return back()->with('success', $data['decision'] === 'approved'
            ? (config('services.onedrive.enabled') ? 'Photo approved and uploaded to OneDrive.' : 'Photo approved and saved locally.')
            : 'Photo rejected.');
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
            if ($error) {
                $failed[] = ($submission->asset?->asset_tag ?? $submission->asset_data['asset_tag'] ?? 'Submission '.$submission->id).': '.$error;
            } else {
                $processed++;
            }
        }

        if ($failed) {
            return back()->withErrors(['photo' => "{$processed} photo(s) processed. The remaining photo(s) stayed pending: ".implode(' | ', $failed)]);
        }

        return back()->with('success', "{$processed} photo(s) {$data['decision']} successfully.");
    }

    private function applyDecision(AssetPhotoSubmission $submission, string $decision, ?string $reason, int $reviewerId): ?string
    {
        if ($decision === 'rejected') {
            // Rejected originals are not needed for history; retain only the
            // submission metadata and optional reviewer message in the DB.
            if (filled($submission->temporary_path) && Storage::disk('local')->exists($submission->temporary_path)) {
                if (! Storage::disk('local')->delete($submission->temporary_path)) {
                    return 'The rejected photo could not be deleted from temporary storage. It remains pending; please retry.';
                }
            }

            $submission->update([
                'status' => 'rejected',
                'rejection_reason' => $reason,
                'reviewed_by' => $reviewerId,
                'reviewed_at' => now(),
                'temporary_path' => '',
            ]);

            return null;
        }

        if (! config('services.onedrive.enabled')) {
            return 'OneDrive is not enabled. The photo and asset remain pending until the OneDrive setup is complete.';
        }

        $uploaded = null;
        $oldItemId = null;
        $oldImagePath = null;
        try {
            $extension = pathinfo($submission->temporary_path, PATHINFO_EXTENSION) ?: 'jpg';
            $contents = Storage::disk('local')->get($submission->temporary_path);
            $imageInfo = @getimagesizefromstring($contents);
            $mimeType = $imageInfo['mime'] ?? 'image/jpeg';
            $oldSubmission = $submission->asset_id
                ? AssetPhotoSubmission::where('asset_id', $submission->asset_id)->where('status', 'approved')->latest('reviewed_at')->first()
                : null;
            $oldItemId = $oldSubmission?->onedrive_item_id;

            DB::transaction(function () use ($submission, $contents, $mimeType, $extension, $reviewerId, &$uploaded, &$oldImagePath) {
                $locked = AssetPhotoSubmission::whereKey($submission->id)->lockForUpdate()->first();
                if (! $locked || $locked->status !== 'pending') {
                    throw new \RuntimeException('This photo submission has already been reviewed.');
                }

                if ($locked->submission_type === 'new_asset') {
                    $asset = new Asset;
                    $asset->fill($locked->asset_data ?? []);
                    $this->applyDerivedAssetFields($asset);
                    $asset->save();
                } else {
                    $asset = Asset::lockForUpdate()->find($locked->asset_id);
                    if (! $asset) {
                        throw new \RuntimeException('The related asset no longer exists.');
                    }
                    $oldImagePath = $asset->image_path;
                    if ($locked->submission_type === 'asset_update') {
                        $assetData = $locked->asset_data ?? [];
                        unset($assetData['image_path'], $assetData['photo_path'], $assetData['id'], $assetData['created_at'], $assetData['updated_at']);
                        $asset->fill($assetData);
                        $this->applyDerivedAssetFields($asset);
                        if (array_key_exists('user_id', $assetData)) {
                            $assignedId = $assetData['user_id'] ? (int) $assetData['user_id'] : null;
                            $asset->accountability_type = 'personal';
                            $asset->user_id = $assignedId;
                            $asset->assigned_personnel = $assignedId ? User::find($assignedId)?->name : null;
                            $asset->asset_status = $assignedId ? 'Assigned' : 'In Storage';
                        }
                    }
                }

                $uploaded = app(OneDriveAssetPhotoService::class)->upload($asset, $contents, $mimeType, $extension, $locked->id);
                $photoEndpoint = route('assets.photo.show', $asset->id, false);
                $asset->update(['image_path' => $photoEndpoint, 'photo_path' => $photoEndpoint]);
                if ($locked->submission_type === 'asset_update' && array_key_exists('user_id', $locked->asset_data ?? [])) {
                    $assignedId = $asset->user_id ? (int) $asset->user_id : null;
                    $asset->accountableUsers()->sync($assignedId ? [$assignedId => ['is_team_leader' => false, 'accountability_type' => 'personal']] : []);
                }
                $locked->update([
                    'asset_id' => $asset->id,
                    'status' => 'approved',
                    'reviewed_by' => $reviewerId,
                    'reviewed_at' => now(),
                    'onedrive_item_id' => $uploaded['item_id'],
                    'onedrive_url' => $uploaded['url'],
                ]);
            });
        } catch (\Throwable $e) {
            if ($uploaded['item_id'] ?? null) {
                try {
                    app(OneDriveAssetPhotoService::class)->delete($uploaded['item_id']);
                } catch (\Throwable $cleanupError) {
                    Log::error('OneDrive photo upload could not be rolled back after an approval failure.', ['submission_id' => $submission->id]);
                }
            }
            Log::warning('Asset photo approval failed.', ['submission_id' => $submission->id, 'exception' => $e->getMessage()]);

            return 'The photo was not uploaded to OneDrive and remains pending.';
        }

        if ($oldItemId && $oldItemId !== ($uploaded['item_id'] ?? null)) {
            try {
                app(OneDriveAssetPhotoService::class)->delete($oldItemId);
            } catch (\Throwable $e) {
                Log::warning('Previous OneDrive asset photo could not be removed after replacement.', ['submission_id' => $submission->id]);
            }
        }
        if ($oldImagePath && str_starts_with($oldImagePath, '/storage/')) {
            Storage::disk('public')->delete(substr($oldImagePath, strlen('/storage/')));
        }
        if (filled($submission->temporary_path)) {
            if (Storage::disk('local')->delete($submission->temporary_path)) {
                $submission->update(['temporary_path' => '']);
            } else {
                Log::warning('Approved asset photo temporary copy could not be deleted.', ['submission_id' => $submission->id]);
            }
        }

        return null;
    }

    private function reviewQueue()
    {
        $page = AssetPhotoSubmission::with(['asset:id,name,asset_tag,branch,department,category', 'submitter:id,name'])
            ->where('status', 'pending')->latest()->paginate(25);

        $page->getCollection()->each(function (AssetPhotoSubmission $submission) {
            if (! $submission->asset && $submission->asset_data) {
                $submission->setRelation('asset', new Asset($submission->asset_data));
            }
        });

        return $page;
    }

    private function attachDraftAssetData($submissions): void
    {
        $submissions->each(function (AssetPhotoSubmission $submission) {
            if (! $submission->asset && $submission->asset_data) {
                $submission->setRelation('asset', new Asset($submission->asset_data));
            }
        });
    }

    private function applyDerivedAssetFields(Asset $asset): void
    {
        if (! empty($asset->purchase_date) && ! empty($asset->warranty_expiration)) {
            $asset->deviation = round((strtotime($asset->warranty_expiration) - strtotime($asset->purchase_date)) / 86400).' Days';
        }
        $asset->total_value = ($asset->unit_value * ($asset->qty ?: 1));
    }

    private function storePendingPhoto($file, string $contents): string
    {
        $image = @getimagesizefromstring($contents);
        $extensions = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
        $extension = $extensions[$image[2] ?? null] ?? strtolower($file->extension() ?: 'jpg');
        $path = 'asset-photos/pending/'.Str::uuid().'.'.$extension;
        if (! Storage::disk('local')->put($path, $contents)) {
            throw new \RuntimeException('The temporary asset photo could not be stored.');
        }

        return $path;
    }

    private function compressedJpeg($file): string
    {
        $bytes = $file->get();
        if (! function_exists('imagecreatefromstring') || ! function_exists('imagejpeg')) {
            return $bytes;
        }
        $info = @getimagesizefromstring($bytes);
        if (! $info || empty($info[0]) || empty($info[1])) {
            return $bytes;
        }
        $memoryLimit = $this->memoryLimitBytes(ini_get('memory_limit'));
        $estimated = (int) $info[0] * (int) $info[1] * 6;
        if ($memoryLimit > 0 && memory_get_usage(true) + $estimated > (int) ($memoryLimit * 0.72)) {
            return $bytes;
        }
        $image = @imagecreatefromstring($bytes);
        if (! $image) {
            return $bytes;
        }
        $width = imagesx($image);
        $height = imagesy($image);
        $max = 2200;
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
            imagedestroy($image);
            $image = $resized;
        }
        ob_start();
        imagejpeg($image, null, 82);
        $compressed = ob_get_clean();
        imagedestroy($image);

        return $compressed ?: $bytes;
    }

    private function memoryLimitBytes(?string $limit): int
    {
        if (! $limit || $limit === '-1') {
            return 0;
        }
        $unit = strtolower(substr($limit, -1));
        $value = (float) $limit;

        return (int) ($unit === 'g' ? $value * 1024 * 1024 * 1024 : ($unit === 'm' ? $value * 1024 * 1024 : ($unit === 'k' ? $value * 1024 : $value)));
    }

    public function preview(Request $request, AssetPhotoSubmission $submission)
    {
        $user = $request->user();
        abort_unless(AssetAccess::canReviewPhotos($user) || (AssetAccess::canEnter($user) && $submission->submitted_by === $user->id), 403);
        abort_unless($submission->status === 'pending' && filled($submission->temporary_path), 404);
        abort_unless(Storage::disk('local')->exists($submission->temporary_path), 404);

        return response()->file(Storage::disk('local')->path($submission->temporary_path));
    }

    public function showApproved(Request $request, Asset $asset)
    {
        abort_unless(AssetAccess::canViewOverview($request->user()), 403);
        $submission = $asset->photoSubmissions()
            ->where('status', 'approved')
            ->whereNotNull('onedrive_item_id')
            ->latest('reviewed_at')
            ->first();
        abort_unless($submission, 404);

        $file = app(OneDriveAssetPhotoService::class)->download($submission->onedrive_item_id);
        $contentType = strtolower(trim(explode(';', $file['content_type'])[0]));
        abort_unless(in_array($contentType, ['image/jpeg', 'image/png', 'image/webp'], true), 502, 'OneDrive returned an unsupported asset image.');

        return response($file['contents'], 200, [
            'Content-Type' => $contentType,
            'Cache-Control' => 'private, max-age=300',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
