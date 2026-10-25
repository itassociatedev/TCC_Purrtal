<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class MyAssetController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        $user->load('department'); 
        
        $userDept = strtolower(trim(is_string($user->department) ? $user->department : ($user->department->name ?? '')));

        // Find everyone currently in this user's department
        $sameDeptUserIds = [$user->id];
        if (!empty($userDept)) {
            $allUsers = User::with('department')->get();
            foreach ($allUsers as $u) {
                $uDept = strtolower(trim(is_string($u->department) ? $u->department : ($u->department->name ?? '')));
                $isIT1 = in_array($userDept, ['it', 'information technology']);
                $isIT2 = in_array($uDept, ['it', 'information technology']);
                if (($isIT1 && $isIT2) || ($uDept === $userDept && $userDept !== '')) {
                    $sameDeptUserIds[] = $u->id;
                }
            }
        }

        $assets = Asset::with(['supplier', 'user'])
            ->where(function($query) use ($userDept, $sameDeptUserIds) {
                // 🟢 STRICT FIX: If it is assigned to a user, that user MUST be in this department.
                $query->whereIn('user_id', $sameDeptUserIds)
                // OR: If the asset is currently UNASSIGNED to anyone, fallback to the department text column
                      ->orWhere(function($q) use ($userDept) {
                          $q->whereNull('user_id');
                          if (in_array($userDept, ['it', 'information technology'])) {
                              $q->where(function($sub) {
                                  $sub->where('department', 'LIKE', '%it%')
                                      ->orWhere('department', 'LIKE', '%information technology%');
                              });
                          } else {
                              $q->where('department', 'LIKE', '%' . $userDept . '%');
                          }
                      });
            })
            ->latest()
            ->get();

        return Inertia::render('Admin/MyAsset', [
            'myAssets' => $assets
        ]);
    }
}