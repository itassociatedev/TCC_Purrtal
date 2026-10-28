<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrgChartMember extends Model
{
    protected $fillable = [
        'name',
        'position',
        'branch',
        'sort_order',
        'image_path',
        'image_position_x',
        'image_position_y',
        'image_zoom',
    ];

    protected $casts = [
        'image_position_x' => 'float',
        'image_position_y' => 'float',
        'image_zoom' => 'float',
    ];
}