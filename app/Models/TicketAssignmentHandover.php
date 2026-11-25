<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class TicketAssignmentHandover extends Model
{
    protected $fillable = ['member_id', 'granted_by', 'starts_on', 'ends_on', 'revoked_at'];

    public static function today(): string
    {
        return now('Asia/Manila')->toDateString();
    }

    public function scopeActive(Builder $query): Builder
    {
        // Both selected calendar dates are included.
        $today = self::today();
        return $query->whereNull('revoked_at')->where('starts_on', '<=', $today)->where('ends_on', '>=', $today);
    }

    public function member()
    {
        return $this->belongsTo(User::class);
    }
}
