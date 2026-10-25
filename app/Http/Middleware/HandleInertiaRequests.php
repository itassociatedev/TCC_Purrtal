<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
   public function share(Request $request): array
    {
        $user = $request->user();

        $hasDepartmentAssets = false;

        // If the user is logged in, load their relationships from the database!
        if ($user) {
            // 🟢 ADDED: 'assets' to the eager load so Laravel grabs them from the DB
            $user->load(['role', 'position', 'department', 'branch', 'branches', 'assets']);
            
            // 🟢 Determine if user or department has any assigned assets to toggle module visibility
            try {
                $deptName = is_object($user->department) ? ($user->department->name ?? '') : (is_string($user->department) ? $user->department : '');
                
                $hasDepartmentAssets = DB::table('assets')
                    ->where('department', $deptName)
                    ->orWhere('user_id', $user->id)
                    ->exists();
            } catch (\Exception $e) {
                // Failsafe in case table is migrating or doesn't exist yet
                $hasDepartmentAssets = false; 
            }
        }

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    
                    // Now we send the FULL role, position, and department objects to React!
                    'role' => $user->role, 
                    'position' => $user->position,
                    'department' => $user->department,
                    
                    // Send the branch data to React
                    'branch' => $user->branch,
                    'branches' => $user->branches,
                    
                    // 🟢 ADDED: Send the user's assigned assets to React!
                    'assets' => $user->assets,
                    
                    'is_rotating' => $user->is_rotating,
                    
                    // PROTECT OUR PREVIOUS WORK: Ensure the global access helper makes it to React!
                    'has_global_access' => $user->has_global_access, 
                ] : null,
                
                // FIX: Only attempt to fetch notifications if $user is NOT null!
                'notifications' => $user ? $user->notifications()->latest()->take(20)->get() : [],
                
                // FIX: Matched the key to your React code
                'unreadNotificationsCount' => $user ? $user->unreadNotifications()->count() : 0,

                // NEW: Tell React exactly how many notifications exist in total
                'totalNotificationsCount' => $user ? $user->notifications()->count() : 0,
                
                // 🟢 NEW: Global visibility flag for the Accountability Module
                'has_department_assets' => $hasDepartmentAssets,
            ],

            'flash' => [
                'success' => fn() => $request->session()->get('success'),
                'error' => fn() => $request->session()->get('error'),
            ],
            'system' => [
                'serverDate' => fn() => \Carbon\Carbon::now()->toDateString(),
                'serverNow' => fn() => \Carbon\Carbon::now()->toIso8601String(),
                'timezone' => config('app.timezone'),
            ],
        ];
    }
}