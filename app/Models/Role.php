<?php
// Role model for permission hierarchy and role helpers

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    protected $fillable = ['name'];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function adminAcls(): HasMany
    {
        return $this->hasMany(AdminACL::class);
    }

    public function getPermissionStringsAttribute(): array
    {
        $adminAcls = $this->relationLoaded('adminAcls')
            ? $this->adminAcls
            : $this->adminAcls()->get();

        return $adminAcls
            ->filter(fn ($acl) => $acl->permission_level !== 'no_access')
            ->pluck('module')
            ->map(fn ($module) => trim(strtolower($module)))
            ->values()
            ->all();
    }
}
