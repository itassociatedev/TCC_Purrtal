<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetImportItem extends Model
{
    protected $fillable = ['asset_import_batch_id', 'asset_id', 'created_by_batch', 'before_values', 'after_hash'];
    protected $casts = ['created_by_batch' => 'boolean', 'before_values' => 'array'];

    public function batch() { return $this->belongsTo(AssetImportBatch::class, 'asset_import_batch_id'); }
    public function asset() { return $this->belongsTo(Asset::class); }
}
