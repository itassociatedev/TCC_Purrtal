<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ScheduleOverride extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'date',
        'is_off_day',
        'shift_type',
        'start_time',
        'end_time',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}