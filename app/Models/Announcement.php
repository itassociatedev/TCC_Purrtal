<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Announcement extends Model
{
    protected $fillable = [
        'title',
        'author',
        'content',
        'priority_level_id',
        'image_path',
        'attachment_path',
        'image_zoom',       
        'image_offset_x',  
        'image_offset_y',
    ];

    public function branches()
    {
        return $this->belongsToMany(Branch::class, 'announcement_branch');
    }

    public function priorityLevel(): BelongsTo
    {
        return $this->belongsTo(PriorityLevel::class, 'priority_level_id');
    }

    public function comments()
    {
        return $this->hasMany(Comment::class)->latest(); 
    }
}
