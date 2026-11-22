<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Models\AssetPhotoSubmission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use App\Services\OneDriveAssetPhotoService;
use App\Support\AssetAccess;

class AssetPhotoController extends Controller
{
    public function capture(Request $request)
    {
        abort_unless(AssetAccess::canEnter($request->user()), 403);
        $assets = Asset::select('id', 'name', 'asset_tag', 'image_path')->orderBy('asset_tag')->get();
        $pendingAssetIds = AssetPhotoSubmission::where('status', 'pending')->pluck('asset_id');
        $nextAsset = $assets->first(fn ($asset) => blank($asset->image_path) && !$pendingAssetIds->contains($asset->id));
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

        $path = $request->file('photo')->store('asset-photos/pending', 'local');
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

        return back()->with('success', $data['decision'] === 'approved' ? 'Photo approved and uploaded to OneDrive.' : 'Photo rejected and returned to the submitter.');
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
            $uploaded = app(OneDriveAssetPhotoService::class)->upload(
                $asset,
                Storage::disk('local')->get($submission->temporary_path),
                Storage::disk('local')->mimeType($submission->temporary_path) ?: 'image/jpeg',
                $extension
            );
        } catch (\Throwable $e) {
            return 'The photo was not uploaded to OneDrive and remains pending.';
        }

        $asset->update(['image_path' => $uploaded['url'], 'photo_path' => $uploaded['url']]);
        Storage::disk('local')->delete($submission->temporary_path);
        $submission->update(['status' => 'approved', 'reviewed_by' => $reviewerId, 'reviewed_at' => now(), 'onedrive_item_id' => $uploaded['item_id'], 'onedrive_url' => $uploaded['url']]);
        return null;
    }

    public function preview(Request $request, AssetPhotoSubmission $submission)
    {
        $user = $request->user();
        abort_unless(AssetAccess::canReviewPhotos($user) || (AssetAccess::canEnter($user) && $submission->submitted_by === $user->id), 403);
        abort_unless(Storage::disk('local')->exists($submission->temporary_path), 404);
        return response()->file(Storage::disk('local')->path($submission->temporary_path));
    }
}
