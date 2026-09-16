<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseRequest extends Model
{
    use HasFactory;
    use SoftDeletes;

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
    'prepared_by_name',
    'prepared_by_role',
    'reviewed_by_name',
    'reviewed_by_role',
    'approved_by_role',
];

protected $casts = [
    'is_evp_override' => 'boolean',
    'cc_users' => 'array',
];

    protected $appends = ['pr_number'];

    public function getPrNumberAttribute()
    {
        $branchName = strtoupper(trim($this->branch));

        // Known branches override
        $knownBranches = [
            'MAKATI' => 'MKT',
            'GREENHILLS' => 'GH',
            'ALABANG' => 'ALB'
        ];

        if (isset($knownBranches[$branchName])) {
            $branchInitials = $knownBranches[$branchName];
        } else {
            $words = array_filter(explode(' ', $branchName));
            if (count($words) > 1) {
                $branchInitials = '';
                foreach (array_slice($words, 0, 3) as $w) {
                    $branchInitials .= $w[0];
                }
            } else {
                $firstLetter = $branchName[0] ?? 'U';
                $consonants = preg_replace('/[AEIOU\W]/', '', substr($branchName, 1));
                $branchInitials = substr($firstLetter . $consonants, 0, 3);

                if (strlen($branchInitials) < 2) {
                    $branchInitials = substr($branchName, 0, 3);
                }
            }
        }

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
