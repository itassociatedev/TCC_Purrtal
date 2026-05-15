<?php

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
}
