<?php

namespace App\Services;

use App\Models\User;
use App\Models\Branch;

class TicketAccess
{
    public static function branches(User $user)
    {
        // Use one scope for dropdown options and submission validation, including
        // the selected test identity in preview instead of the real administrator.
        $allowedRoles = config('ticketing.all_branch_roles', []);
        $name = strtolower(trim($user->role?->name ?? ''));
        $department = strtolower(trim($user->department?->name ?? ''));
        $itDepartment = in_array($department, array_map(fn ($name) => strtolower(trim($name)), config('ticketing.all_branch_departments', [])), true);
        $query = Branch::query();
        if (self::role($user) !== 'employee' || self::canViewLeaderboard($user) || $itDepartment || in_array($name, array_map(fn ($role) => strtolower(trim($role)), $allowedRoles), true)) {
            return $query;
        }
        $ids = $user->branches()->pluck('branches.id')->push($user->branch_id)->filter()->unique();
        return $query->whereIn('id', $ids);
    }

    // Preview access is separate from permission to manage live tickets.
    public static function canPreview(User $user): bool
    {
        return self::role($user) === 'leader'
            || in_array(strtolower(trim($user->role?->name ?? '')), ['admin', 'it admin'], true);
    }

    public static function canViewLeaderboard(User $user): bool
    {
        // EVP visibility, like IT management, follows the position rather than portal ACL role.
        return self::role($user) === 'leader' || in_array(strtolower(trim($user->position?->name ?? '')),
            array_map(fn ($name) => strtolower(trim($name)), config('ticketing.leaderboard_viewer_positions', [])), true);
    }

    // Ticketing permissions follow the HR position, never the shared portal role.
    public static function role(User $user): string
    {
        $position = strtolower(trim($user->position?->name ?? ''));
        if ($position === 'it team leader') return 'leader';
        return $position === 'it' || str_starts_with($position, 'it ') ? 'member' : 'employee';
    }

    // Assignment, lifecycle and SLA notifications use the same position-based authority.
    public static function notificationRole(User $user): string
    {
        return self::role($user);
    }

    public static function canRateResolver(User $requester, User $resolver): bool
    {
        // Requester ownership is checked separately. A team leader may rate an
        // IT member, but member-to-member feedback and self-ratings are excluded.
        return !$requester->is($resolver)
            && !(self::role($requester) === 'member' && self::role($resolver) === 'member');
    }

    // An assignee may be an IT member or team leader and belong to the selected environment.
    public static function members(bool $preview = false, bool $membersOnly = false)
    {
        // Match the PHP classifier exactly, including future IT positions.
        return User::with('position')->whereHas('position', function ($query) use ($membersOnly) {
            $query->where(function ($it) {
                $it->whereRaw('LOWER(TRIM(name)) = ?', ['it'])
                    ->orWhereRaw('LOWER(TRIM(name)) LIKE ?', ['it %']);
            });
            if ($membersOnly) $query->whereRaw('LOWER(TRIM(name)) != ?', ['it team leader']);
        })->whereIn('id', $preview
            ? \Illuminate\Support\Facades\DB::table('ticket_preview_users')->select('user_id')
            : User::select('id')->whereNotIn('id', \Illuminate\Support\Facades\DB::table('ticket_preview_users')->select('user_id')));
    }
}
