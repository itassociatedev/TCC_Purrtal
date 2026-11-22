<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetPhotoSubmission extends Model
{
    protected $fillable = ['asset_id', 'submitted_by', 'reviewed_by', 'temporary_path', 'status', 'rejection_reason', 'onedrive_item_id', 'onedrive_url', 'reviewed_at'];
    protected $casts = ['reviewed_at' => 'datetime'];

    public function asset() { return $this->belongsTo(Asset::class); }
    public function submitter() { return $this->belongsTo(User::class, 'submitted_by'); }
    public function reviewer() { return $this->belongsTo(User::class, 'reviewed_by'); }
}
