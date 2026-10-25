<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Asset; 

class MyAssetController extends Controller
{
    public function index(Request $request)
    {
        // Securely load ONLY the assets assigned to the logged-in user
        // This checks both their ID and if someone typed their name manually
        $user = $request->user();

        $myAssets = Asset::where('user_id', $user->id)
            ->orWhere('assigned_personnel', 'LIKE', '%' . $user->name . '%')
            ->with('user') // Load relationships if you have them
            ->get();

        return Inertia::render('Staff/PersonalAssets', [
            'myAssets' => $myAssets
        ]);
    }
}