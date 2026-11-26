<?php

namespace App\Support;

class AssetAccess
{
    private const FULL_MANAGER_NAMES = [
        'ralph ranie saura',
        'reuben mikko s. capuno',
        'patrick mimay',
        'robert liton',
        'donald rey saberon',
    ];

    public static function isFullManager($user): bool
    {
        $name = self::value($user?->name);
        $role = self::value($user?->role?->name);

        return in_array($name, self::FULL_MANAGER_NAMES, true)
            || in_array($role, ['admin', 'super admin', 'director of corporate services and operations'], true);
    }

    public static function isIt($user): bool
    {
        $department = self::value($user?->department?->name);
        $role = self::value($user?->role?->name);
        $position = self::value($user?->position?->name);

        return $department === 'it'
            || str_contains($department, 'information technology')
            || str_contains($role, 'information technology')
            || preg_match('/(^|\s)it(\s|$)/i', $role . ' ' . $position) === 1;
    }

    public static function isItIntern($user): bool
    {
        return self::isIt($user)
            && (str_contains(self::value($user?->role?->name), 'intern')
                || str_contains(self::value($user?->position?->name), 'intern'));
    }

    public static function canEnter($user): bool
    {
        $department = self::value($user?->department?->name);
        $role = self::value($user?->role?->name);

        return self::isFullManager($user)
            || self::isIt($user)
            || self::containsAny($department . ' ' . $role, ['inventory', 'procurement', 'audit']);
    }

    public static function canReviewPhotos($user): bool
    {
        return self::isIt($user);
    }

    public static function canPrintAssetStickers($user): bool
    {
        $department = self::value($user?->department?->name);
        $role = self::value($user?->role?->name);
        $position = self::value($user?->position?->name);

        return self::isIt($user)
            || self::containsAny($department . ' ' . $role . ' ' . $position, ['inventory']);
    }

    public static function canViewOverview($user): bool
    {
        return self::isFullManager($user) || (self::isIt($user) && !self::isItIntern($user));
    }

    public static function isEntryOnly($user): bool
    {
        return self::canEnter($user) && !self::isFullManager($user) && !(self::isIt($user) && !self::isItIntern($user));
    }

    private static function value($value): string
    {
        return strtolower(trim((string) $value));
    }

    private static function containsAny(string $value, array $needles): bool
    {
        foreach ($needles as $needle) {
            if (str_contains($value, $needle)) return true;
        }

        return false;
    }
}
