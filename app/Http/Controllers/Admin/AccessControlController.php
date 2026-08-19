<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminACL;
use App\Models\Role;
use App\Services\LoggerService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AccessControlController extends Controller
{
    /**
     * 🟢 HELPER: Automatically extracts a flat array of modules directly from groupedModules.
     * This guarantees the Database and the UI are always 100% synchronized, preventing
     * the bug where saved permissions revert to "No Access" on page reload.
     */
    private function getSyncedModules()
    {
        $groupedModules = AdminACL::groupedModules();
        $modules = [];
        
        foreach ($groupedModules as $group => $mods) {
            foreach ($mods as $key => $name) {
                $modules[$key] = $name;
            }
        }
        
        return $modules;
    }

    /**
     * Display the ACL management interface.
     */
    public function index()
    {
        // Load all roles dynamically so newly created roles like Intern show up automatically.
        $roles = Role::with('adminAcls')->orderBy('name')->get();

        // 🟢 FIXED: Use the dynamic sync helper instead of the outdated AdminACL::modules()
        $groupedModules = AdminACL::groupedModules();
        $modules = $this->getSyncedModules();

        // Get current ACL permissions organized by role and module
        $aclMatrix = [];
        foreach ($roles as $role) {
            $aclEntries = $role->adminAcls->keyBy('module');
            $aclMatrix[$role->id] = [
                'role_name' => $role->name,
                'permissions' => [],
            ];

            foreach (array_keys($modules) as $module) {
                $aclMatrix[$role->id]['permissions'][$module] = $aclEntries[$module]->permission_level ?? 'no_access';
            }
        }

        // Get permission levels
        $permissionLevels = AdminACL::permissionLevels();

        return Inertia::render('Admin/AccessControl', [
            'roles' => $roles,
            'modules' => $modules,
            'groupedModules' => $groupedModules,
            'aclMatrix' => $aclMatrix,
            'permissionLevels' => $permissionLevels,
        ]);
    }

    /**
     * Update a single permission.
     */
    public function updatePermission(Request $request)
    {
        $validated = $request->validate([
            'role_id' => 'required|exists:roles,id',
            'module' => 'required|string',
            'permission_level' => 'required|in:full,edit,view,no_access',
        ]);

        $user = auth()->user();
        if (!$user?->canEditModule('access_control')) {
            abort(403, 'You do not have permission to update access control settings.');
        }

        $targetRole = Role::find($validated['role_id']);
        if ($targetRole && strtolower(trim($targetRole->name)) === strtolower(trim(config('admin-acl.superadmin_role', 'admin')))) {
            abort(403, 'The Admin role permissions cannot be changed.');
        }

        // Create or update the ACL entry
        AdminACL::updateOrCreate(
            [
                'role_id' => $validated['role_id'],
                'module' => $validated['module'],
            ],
            [
                'permission_level' => $validated['permission_level'],
            ]
        );

        LoggerService::log(
            'System Logs & Security',
            'Update',
            sprintf(
                'ACL permission for role %d (%s) on module "%s" changed to %s.',
                $validated['role_id'],
                Role::find($validated['role_id'])?->name ?? 'Unknown Role',
                $validated['module'],
                $validated['permission_level']
            ),
            'success',
            auth()->id()
        );

        return back()->with('success', 'Permission updated successfully');
    }

    /**
     * Update multiple permissions at once (bulk update).
     */
    public function bulkUpdate(Request $request)
    {
        $validated = $request->validate([
            'permissions' => 'required|array',
            'permissions.*.role_id' => 'required|exists:roles,id',
            'permissions.*.module' => 'required|string',
            'permissions.*.permission_level' => 'required|in:full,edit,view,no_access',
        ]);

        $user = auth()->user();
        if (!$user?->canEditModule('access_control')) {
            abort(403, 'You do not have permission to bulk update access control settings.');
        }

        $updatedRoleIds = [];
        foreach ($validated['permissions'] as $permission) {
            $role = Role::find($permission['role_id']);
            if ($role && strtolower(trim($role->name)) === strtolower(trim(config('admin-acl.superadmin_role', 'admin')))) {
                continue;
            }

            AdminACL::updateOrCreate(
                [
                    'role_id' => $permission['role_id'],
                    'module' => $permission['module'],
                ],
                [
                    'permission_level' => $permission['permission_level'],
                ]
            );
            $updatedRoleIds[] = $permission['role_id'];

            LoggerService::log(
                'System Logs & Security',
                'Update',
                sprintf(
                    'ACL permission for role %d (%s) on module "%s" changed to %s.',
                    $permission['role_id'],
                    Role::find($permission['role_id'])?->name ?? 'Unknown Role',
                    $permission['module'],
                    $permission['permission_level']
                ),
                'success',
                auth()->id()
            );
        }

        return redirect()->route('admin.access-control.index')
            ->with('flash', ['success' => 'All permissions updated successfully']);
    }

    /**
     * Reset all permissions to default (no_access).
     */
    public function reset(Request $request)
    {
        $validated = $request->validate([
            'role_id' => 'required|exists:roles,id',
        ]);

        $user = auth()->user();
        if (!$user?->canEditModule('access_control')) {
            abort(403, 'You do not have permission to reset access control settings.');
        }

        $targetRole = Role::find($validated['role_id']);
        $isSuperAdmin = $targetRole && strtolower(trim($targetRole->name)) === strtolower(trim(config('admin-acl.superadmin_role', 'admin')));

        // 🟢 FIXED: Use synced modules here as well
        $modules = $this->getSyncedModules();

        AdminACL::where('role_id', $validated['role_id'])->delete();
        if ($isSuperAdmin) {
            foreach ($modules as $module => $moduleName) {
                AdminACL::updateOrCreate(
                    [
                        'role_id' => $validated['role_id'],
                        'module' => $module,
                    ],
                    [
                        'permission_level' => 'full',
                    ]
                );
            }
        }

        LoggerService::log(
            'System Logs & Security',
            'Delete',
            sprintf(
                'ACL permissions for role %d (%s) were reset to default no_access. Admin Overview remains full.',
                $validated['role_id'],
                Role::find($validated['role_id'])?->name ?? 'Unknown Role'
            ),
            'warning',
            auth()->id()
        );

        return redirect()->route('admin.access-control.index')
            ->with('flash', ['success' => 'Permissions reset to default']);
    }

    /**
     * Export ACL as JSON/CSV.
     */
    public function export()
    {
        $roles = Role::orderBy('name')->get();
        // 🟢 FIXED: Use synced modules for accurate exporting
        $modules = $this->getSyncedModules();

        $data = [];
        foreach ($roles as $role) {
            $rowData = ['Role' => $role->name];

            foreach (array_keys($modules) as $module) {
                $acl = AdminACL::where('role_id', $role->id)
                    ->where('module', $module)
                    ->first();

                $rowData[$modules[$module]] = $acl?->permission_level ?? 'no_access';
            }

            $data[] = $rowData;
        }

        // Return as JSON download
        return response()->json($data, 200, [
            'Content-Disposition' => 'attachment; filename="admin-acl-' . now()->format('Y-m-d') . '.json"',
        ]);
    }
}