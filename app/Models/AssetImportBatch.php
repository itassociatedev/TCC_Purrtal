<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetImportBatch extends Model
{
    protected $fillable = ['uploaded_by', 'original_filename', 'stored_path', 'file_hash', 'created_count', 'updated_count', 'status', 'reversed_at'];
    protected $casts = ['reversed_at' => 'datetime'];

    public function items() { return $this->hasMany(AssetImportItem::class); }
    public function uploader() { return $this->belongsTo(User::class, 'uploaded_by'); }
}
