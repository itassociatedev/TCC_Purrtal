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
        $allowedRoles = array_merge(config('ticketing.all_branch_roles', []),
            config('ticketing.leader_roles', []), config('ticketing.member_roles', []));
        $name = strtolower(trim($user->role?->name ?? ''));
        $department = strtolower(trim($user->department?->name ?? ''));
        $itDepartment = in_array($department, array_map(fn ($name) => strtolower(trim($name)), config('ticketing.all_branch_departments', [])), true);
        $query = Branch::query();
        if ($itDepartment || in_array($name, array_map(fn ($role) => strtolower(trim($role)), $allowedRoles), true)) {
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

    // Normalize case and spaces, then match exact configured role names.
    // Unlisted roles use the employee workflow rather than inheriting IT privileges.
    public static function role(User $user): string
    {
        $name = strtolower(trim($user->role?->name ?? ''));
        foreach (['leader', 'member'] as $type) {
            $roles = array_map(fn ($role) => strtolower(trim($role)), config("ticketing.{$type}_roles", []));
            if (in_array($name, $roles, true)) return $type;
        }
        return 'employee';
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
        $roles = $membersOnly ? config('ticketing.member_roles') : array_merge(config('ticketing.member_roles'), config('ticketing.leader_roles'));
        return User::whereHas('role', fn ($query) => $query->whereIn(
            \Illuminate\Support\Facades\DB::raw('LOWER(TRIM(name))'),
            array_map(fn ($name) => strtolower(trim($name)), $roles)
        ))->whereIn('id', $preview
            ? \Illuminate\Support\Facades\DB::table('ticket_preview_users')->select('user_id')
            : User::select('id')->whereNotIn('id', \Illuminate\Support\Facades\DB::table('ticket_preview_users')->select('user_id')));
    }
}
