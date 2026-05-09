<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ResourceLink extends Model
{
    use HasFactory;

    protected $fillable = [
        'title', 
        'url', 
        'image_path',
        'description', 
        'type', 
        'is_active',
        'sort_order'
    ];
}
