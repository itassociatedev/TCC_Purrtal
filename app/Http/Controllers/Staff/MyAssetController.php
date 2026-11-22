<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Services\AccountabilityPdfService;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class MyAssetController extends Controller
{
    private function assignedAssets($user)
    {
        return Asset::with(['supplier', 'user', 'accountableUsers'])
            ->where(function ($query) use ($user) {
                $query->where('user_id', $user->id)
                    ->orWhereHas('accountableUsers', fn ($q) => $q->where('users.id', $user->id));
            })->latest()->get();
    }

    public function index()
    {
        $assets = $this->assignedAssets(Auth::user());
        return Inertia::render('Admin/MyAsset', [
            'myAssets' => $assets,
            'personalAssets' => $assets->filter(fn ($asset) => ($asset->accountability_type ?? 'personal') !== 'shared')->values(),
            'sharedAssets' => $assets->filter(fn ($asset) => ($asset->accountability_type ?? 'personal') === 'shared')->values(),
        ]);
    }

    public function accountabilityPdf()
    {
        $user = Auth::user()->load(['department', 'branches']);
        $assets = $this->assignedAssets($user)->sortBy('asset_tag')->values();
        $pdf = app(AccountabilityPdfService::class)->render(
            $user,
            $assets->filter(fn ($asset) => ($asset->accountability_type ?? 'personal') !== 'shared'),
            $assets->filter(fn ($asset) => ($asset->accountability_type ?? 'personal') === 'shared'),
        );
        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="asset-accountability-' . str()->slug($user->name) . '.pdf"',
        ]);
    }
}
