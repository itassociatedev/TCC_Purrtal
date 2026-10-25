<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DutyMealBranchRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'duty_date',
        'original_branch_id',
        'requested_branch_id',
        'status',
        'reason',
        'handled_by',
        'handled_at'
    ];

    protected $casts = [
        'duty_date' => 'date',
        'handled_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function originalBranch()
    {
        return $this->belongsTo(Branch::class, 'original_branch_id');
    }

    public function requestedBranch()
    {
        return $this->belongsTo(Branch::class, 'requested_branch_id');
    }

    public function handler()
    {
        return $this->belongsTo(User::class, 'handled_by');
    }
}