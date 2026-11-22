<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Models\AssetPhotoSubmission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class AssetPhotoController extends Controller
{
    public function capture(Request $request)
    {
        $assets = Asset::select('id', 'name', 'asset_tag', 'image_path')->orderBy('asset_tag')->get();
        return Inertia::render('Assets/PhotoCapture', [
            'assets' => $assets,
            'rejectedSubmissions' => AssetPhotoSubmission::with('asset:id,name,asset_tag')->where('submitted_by', $request->user()->id)->where('status', 'rejected')->latest()->get(),
        ]);
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $isIt = strtolower((string) ($user->department?->name ?? '')) === 'it' || str_contains(strtolower((string) ($user->role?->name ?? '')), 'it');
        abort_unless($isIt || $user->has_global_access, 403);

        return Inertia::render('Assets/PhotoReview', [
            'pendingCount' => AssetPhotoSubmission::where('status', 'pending')->count(),
            'submissions' => AssetPhotoSubmission::with(['asset:id,name,asset_tag', 'submitter:id,name'])->latest()->paginate(25),
        ]);
    }

    public function submit(Request $request)
    {
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
        $isIt = strtolower((string) ($user->department?->name ?? '')) === 'it' || str_contains(strtolower((string) ($user->role?->name ?? '')), 'it');
        abort_unless($isIt || $user->has_global_access, 403);

        $data = $request->validate(['decision' => ['required', 'in:approved,rejected'], 'reason' => ['nullable', 'string', 'max:1000']]);
        if ($data['decision'] === 'rejected') {
            $submission->update(['status' => 'rejected', 'rejection_reason' => $data['reason'], 'reviewed_by' => $user->id, 'reviewed_at' => now()]);
            return back()->with('success', 'Photo rejected and returned to the submitter.');
        }

        $asset = $submission->asset;
        $extension = pathinfo($submission->temporary_path, PATHINFO_EXTENSION) ?: 'jpg';
        $newPath = 'assets/images/' . $asset->asset_tag . '.' . strtolower($extension);
        Storage::disk('public')->put($newPath, Storage::disk('local')->get($submission->temporary_path));
        $asset->update(['image_path' => $newPath, 'photo_path' => $newPath]);
        Storage::disk('local')->delete($submission->temporary_path);
        $submission->update(['status' => 'approved', 'reviewed_by' => $user->id, 'reviewed_at' => now()]);

        return back()->with('success', 'Photo approved and stored with the asset tag filename.');
    }

    public function preview(Request $request, AssetPhotoSubmission $submission)
    {
        $user = $request->user();
        $isIt = strtolower((string) ($user->department?->name ?? '')) === 'it' || str_contains(strtolower((string) ($user->role?->name ?? '')), 'it');
        abort_unless($isIt || $user->has_global_access || $submission->submitted_by === $user->id, 403);
        abort_unless(Storage::disk('local')->exists($submission->temporary_path), 404);
        return response()->file(Storage::disk('local')->path($submission->temporary_path));
    }
}
