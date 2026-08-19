<?php
// Inertia middleware to share common props and handle requests

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;
use Illuminate\Support\Carbon;

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

        // If the user is logged in, load their role and position names from the database!
        if ($user) {
            // 🟢 ADDED: 'branch' and 'branches' to the eager load
            $user->load(['role', 'role.adminAcls', 'position', 'department', 'branch', 'branches']);
        }

        $permissions = $this->getPermissionStrings($user);

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
                    
                    // 🟢 ADDED: Send the branch data to React
                    'branch' => $user->branch,
                    'branches' => $user->branches,
                    
                    'is_rotating' => $user->is_rotating,
                    'image_path' => $user->image_path,
                    'is_comment_banned' => $user->is_comment_banned,
                    
                    // 🟢 PROTECT OUR PREVIOUS WORK: Ensure the global access helper makes it to React!
                    'has_global_access' => $user->has_global_access,

                    // 🟢 NEW: Share permission strings from the role-based ACL
                    'permissions' => $permissions,
                    'acl_modules' => $permissions,
                    'acl_permissions' => $this->getAclPermissionLevels($user),
                    'has_admin_acl_access' => $this->userHasAdminModuleAccess($user),
                ] : null,
                
                // 🟢 FIX: Only attempt to fetch notifications if $user is NOT null!
                'notifications' => $user ? $user->notifications()->latest()->take(20)->get() : [],
                
                // 🟢 FIX: Matched the key to your React code
                'unreadNotificationsCount' => $user ? $user->unreadNotifications()->count() : 0,

                // 🟢 NEW: Tell React exactly how many notifications exist in total
                'totalNotificationsCount' => $user ? $user->notifications()->count() : 0,
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

    /**
     * Get the ACL modules the current user is allowed to access.
     *
     * @param  \Illuminate\Contracts\Auth\Authenticatable|null  $user
     * @return array<int, string>
     */
    protected function getPermissionStrings($user): array
    {
        if (!$user || !$user->role) {
            return [];
        }

        $role = $user->role;
        $permissions = [];

        if ($role->relationLoaded('adminAcls')) {
            $permissions = $role->adminAcls
                ->filter(fn ($acl) => $acl->permission_level !== 'no_access')
                ->pluck('module')
                ->map(fn ($module) => trim(strtolower($module)))
                ->values()
                ->all();
        } else {
            $permissions = $role->adminAcls()
                ->where('permission_level', '!=', 'no_access')
                ->pluck('module')
                ->map(fn ($module) => trim(strtolower($module)))
                ->values()
                ->all();
        }

        if (empty($permissions) && strtolower(trim($role->name)) === strtolower(trim(config('admin-acl.superadmin_role', 'admin')))) {
            return array_map('strtolower', array_keys(config('admin-acl.modules', [])));
        }

        return $permissions;
    }

    /**
     * Get the ACL permission levels for the current user.
     *
     * @param  \Illuminate\Contracts\Auth\Authenticatable|null  $user
     * @return array<int, string>
     */
    protected function getAclPermissionLevels($user): array
    {
        if (!$user || !$user->role) {
            return [];
        }

        $role = $user->role;
        $aclEntries = $role->relationLoaded('adminAcls')
            ? $role->adminAcls
            : $role->adminAcls()->get();

        $permissionLevels = $aclEntries
            ->mapWithKeys(fn ($acl) => [trim(strtolower($acl->module)) => trim(strtolower($acl->permission_level))])
            ->all();

        if (empty($permissionLevels) && strtolower(trim($role->name)) === strtolower(trim(config('admin-acl.superadmin_role', 'admin')))) {
            $permissionLevels = [];
            foreach (array_keys(config('admin-acl.modules', [])) as $module) {
                $permissionLevels[trim(strtolower($module))] = 'full';
            }
        }

        return $permissionLevels;
    }

    /**
     * Check whether the current user has access to any Admin module items.
     *
     * @param  \Illuminate\Contracts\Auth\Authenticatable|null  $user
     * @return bool
     */
    protected function userHasAdminModuleAccess($user): bool
    {
        if (!$user) {
            return false;
        }

        $adminModuleKeys = [
            'admin_overview',
            'announcements',
            'employees',
            'company_content',
            'org_chart',
            'resource_links',
            'system_logs',
            'access_control',
        ];

        return count(array_intersect($this->getPermissionStrings($user), $adminModuleKeys)) > 0;
    }
}
