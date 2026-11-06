<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Asset extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'asset_tag',
        'category',
        'classification',
        'department',
        'branch',
        'user_id', // 🟢 ADD THIS
        'assigned_personnel',
        'area',
        'purchase_date',
        'supplier_id',
        'supplier_name',
        'warranty_expiration',
        'condition',
        'unit_value',
        'qty',
        'total_value',
        'asset_status',
        'model_no',
        'serial_no',
        'color',
        'photo_path',
        'accountability_form',
    ];

    // This links the asset back to your PR/PO Supplier list!
    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    // This links the asset to a specific user
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}