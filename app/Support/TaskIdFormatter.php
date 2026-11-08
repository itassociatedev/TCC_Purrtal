<?php

namespace App\Support;

use Illuminate\Support\Str;

final class TaskIdFormatter
{
    public static function prefix(string $value): string
    {
        $words = preg_split('/[^\pL\pN]+/u', trim($value), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if (count($words) > 1) {
            return Str::upper(implode('', array_map(fn ($word) => mb_substr($word, 0, 1), array_slice($words, 0, 2))));
        }

        return Str::upper(mb_substr($words[0] ?? 'TK', 0, 2));
    }

    public static function make(string $prefixSource, string $department, string $role, string $date, int $sequence): string
    {
        $prefix = self::prefix($prefixSource === 'role' ? $role : $department);
        return sprintf('%s-%s-%06d', $prefix, $date, $sequence);
    }
}
