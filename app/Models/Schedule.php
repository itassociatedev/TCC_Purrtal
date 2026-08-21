<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Schedule extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'shift_type',
        'start_time',
        'end_time',
        'off_days',
        'pattern', // 🟢 Added pattern
        'start_date', 
        'end_date'
    ];

    // Automatically converts the JSON array to a PHP array when we load it
    protected $casts = [
        'off_days' => 'array',
        'pattern' => 'array', // 🟢 Added pattern cast
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}