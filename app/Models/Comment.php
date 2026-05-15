<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Comment extends Model
{
    use HasFactory;

    // 1. Force Laravel to ALWAYS attach the user
    protected $with = ['user'];

    protected $fillable = ['user_id', 'announcement_id', 'content'];

    // 2. Explicitly tell Laravel to use 'user_id' to find the name
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function announcement()
    {
        return $this->belongsTo(Announcement::class, 'announcement_id');
    }
}