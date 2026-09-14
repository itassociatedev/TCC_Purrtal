<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseRequest extends Model
{
    use HasFactory;

    protected $fillable = [
    'user_id',
    'branch',
    'department',
    'date_prepared',
    'request_type',
    'priority',
    'date_needed',
    'budget_status',
    'budget_ref',
    'purpose_of_request',
    'impact_if_not_procured',
    'status',
    'rejection_reason',
    'cc_users',
    'is_evp_override',
    'reviewed_by_id',
    'approved_by_id',
];

protected $casts = [
    'is_evp_override' => 'boolean',
    'cc_users' => 'array',
];

    protected $appends = ['pr_number'];

    public function getPrNumberAttribute()
    {
        $branch = strtoupper(trim($this->branch));
        $branchInitials = 'UNK';

        if (str_contains($branch, 'MAKATI')) $branchInitials = 'MKT';
        elseif (str_contains($branch, 'GREENHILLS')) $branchInitials = 'GH';
        elseif (str_contains($branch, 'ALABANG')) $branchInitials = 'ALB';

        return 'PR-' . $branchInitials . '-' . str_pad($this->id, 5, '0', STR_PAD_LEFT);
    }

    public function items()
    {
        return $this->hasMany(PurchaseRequestItem::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function cc_user()
    {
        return $this->belongsTo(User::class, 'cc_user_id');
    }

    public function purchaseOrders()
    {
        return $this->hasMany(PurchaseOrder::class);
    }

    public function reviewedBy() {
        return $this->belongsTo(User::class, 'reviewed_by_id');
    }

    public function approvedBy() {
        return $this->belongsTo(User::class, 'approved_by_id');
    }
}
