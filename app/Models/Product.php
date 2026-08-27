<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'supplier_id',
        'name',
        'details',
        'unit',
        'price',
        'status', 
    ];

    // A Product belongs to one Supplier
    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }
}