<?php

namespace App\Casts;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

class UtcDateTime implements CastsAttributes
{
    // SQL datetime has no timezone. Intake/SLA instants are stored and read as
    // UTC explicitly, even though this application's default timezone is Manila.
    public function get(Model $model, string $key, mixed $value, array $attributes): mixed
    {
        return $value === null ? null : CarbonImmutable::parse($value, 'UTC')->utc();
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): mixed
    {
        return $value === null ? null : CarbonImmutable::parse($value, 'UTC')->utc()->format('Y-m-d H:i:s');
    }
}
