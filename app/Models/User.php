<?php
// User model with ACL helper methods and relationships

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'image_path',
        'email_verified_at',
        'is_comment_banned',
        'role_id',
        'branch_id',
        'is_rotating',
        'device_limit',
        'authorized_device_ids',
        'department_id',
        'position_id',
        'status',
        'failed_login_attempts',
    ];

    protected $with = ['role'];

    protected $appends = ['has_password', 'has_global_access'];  

    public function getHasPasswordAttribute()
    {
        return !is_null($this->password);
    }

    public function getHasGlobalAccessAttribute()
    {
        if (!$this->role) {
            return false;
        }

        $safeRoleName = strtolower(trim($this->role->name));

        // Add ANY future top-level roles to this array!
        $allowedRoles = [
            'admin',
            'director of corporate services and operations',
            'hrbp',
            'hr assistant'
        ];

        return in_array($safeRoleName, $allowedRoles);
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_rotating' => 'boolean',
            'authorized_device_ids' => 'array',
        ];
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function branches()
    {
        return $this->belongsToMany(Branch::class, 'branch_user');
    }

    public function canAccessBranch($branchId): bool
    {
        return $this->branches()->where('branch_id', $branchId)->exists();
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function position()
    {
        return $this->belongsTo(Position::class);
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    public function getAllowedModulesForUser(): array
    {
        if (!$this->role) {
            return [];
        }

        $adminAcls = $this->role->relationLoaded('adminAcls')
            ? $this->role->adminAcls
            : $this->role->adminAcls()->get();

        $permissions = $adminAcls
            ->filter(fn ($acl) => strtolower(trim($acl->permission_level)) !== 'no_access')
            ->pluck('module')
            ->map(fn ($module) => trim(strtolower($module)))
            ->values()
            ->all();

        if (empty($permissions) && strtolower(trim($this->role->name)) === strtolower(trim(config('admin-acl.superadmin_role', 'admin')))) {
            return array_map('strtolower', array_keys(config('admin-acl.modules', [])));
        }

        return $permissions;
    }

    public function aclPermissionForModule(string $module): string
    {
        if (!$this->role) {
            return 'no_access';
        }

        $normalizedModule = strtolower(trim($module));

        if ($this->role->relationLoaded('adminAcls')) {
            $acl = $this->role->adminAcls
                ->first(fn ($entry) => strtolower(trim($entry->module)) === $normalizedModule);
        } else {
            $acl = $this->role->adminAcls()
                ->whereRaw('LOWER(TRIM(module)) = ?', [$normalizedModule])
                ->first();
        }

        if ($acl) {
            return strtolower(trim($acl->permission_level));
        }

        if (strtolower(trim($this->role->name)) === strtolower(trim(config('admin-acl.superadmin_role', 'admin')))) {
            return 'full';
        }

        return 'no_access';
    }

    protected function resolveAclPermissionLevel(string $module): string
    {
        $permission = $this->aclPermissionForModule($module);
        if (!$this->isHrChildModule($module)) {
            return $permission;
        }

        $overviewPermission = $this->aclPermissionForModule('hr_overview');

        return $this->higherPermissionLevel($permission, $overviewPermission);
    }

    protected function higherPermissionLevel(string $a, string $b): string
    {
        $levels = [
            'no_access' => 0,
            'view' => 1,
            'edit' => 2,
            'full' => 3,
        ];

        $aIndex = $levels[$a] ?? 0;
        $bIndex = $levels[$b] ?? 0;

        return array_search(max($aIndex, $bIndex), $levels, true) ?: 'no_access';
    }

    protected function isHrChildModule(string $module): bool
    {
        return in_array($module, [
            'documents',
            'form_2316_approvals',
            'manpower_requests_form',
            'approval_board_hr',
            'feedback_form',
        ], true);
    }

    public function canAccessModule(string $module): bool
    {
        return $this->resolveAclPermissionLevel($module) !== 'no_access';
    }

    /**
     * 🔐 PERMISSION HIERARCHY - Following clear ACL structure
     * 
     * Full = Create / Edit / Delete / Admin
     * Edit = Create, Approve, Reject (NOT Delete)
     * View = Request and View only (Read-only)
     * None = No access
     */

    /**
     * Can user VIEW data for this module?
     * Returns true for: 'full', 'edit', 'view'
     */
    public function canViewModule(string $module): bool
    {
        $permission = $this->resolveAclPermissionLevel($module);

        return in_array($permission, ['full', 'edit', 'view'], true);
    }

    /**
     * Can user CREATE/REQUEST in this module?
     * Returns true for: 'full', 'edit'
     * (NOT for 'view' - view-only users cannot create)
     */
    public function canCreateModule(string $module): bool
    {
        return in_array($this->aclPermissionForModule($module), ['full', 'edit'], true);
    }

    /**
     * Can user EDIT data in this module?
     * Returns true for: 'full', 'edit'
     */
    public function canEditModule(string $module): bool
    {
        return in_array($this->aclPermissionForModule($module), ['full', 'edit'], true);
    }

    /**
     * Can user APPROVE requests in this module?
     * Returns true for: 'full', 'edit'
     */
    public function canApproveModule(string $module): bool
    {
        $permission = $this->resolveAclPermissionLevel($module);

        return in_array($permission, ['full', 'edit'], true);
    }

    /**
     * Can user REJECT requests in this module?
     * Returns true for: 'full', 'edit'
     */
    public function canRejectModule(string $module): bool
    {
        return in_array($this->aclPermissionForModule($module), ['full', 'edit'], true);
    }

    /**
     * Can user DELETE data in this module?
     * Returns true for: 'full' only
     */
    public function canDeleteModule(string $module): bool
    {
        return $this->aclPermissionForModule($module) === 'full';
    }

    /**
     * Can user perform ADMIN functions in this module?
     * Returns true for: 'full' only
     */
    public function canAdminModule(string $module): bool
    {
        return $this->aclPermissionForModule($module) === 'full';
    }

    public function hasPermission(string $permission): bool
    {
        return $this->canAccessModule($permission);
    }

    public function schedule()
    {
        return $this->hasOne(Schedule::class);
    }

    // override sched
    public function scheduleOverrides()
    {
        return $this->hasMany(ScheduleOverride::class);
    }
}
