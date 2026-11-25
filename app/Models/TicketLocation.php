<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TicketLocation extends Model
{
    use SoftDeletes;

    public const BRANCH_CODES = ['alabang' => 'ALB', 'greenhills' => 'GHS', 'makati' => 'MKT'];

    public $timestamps = false;

    protected $fillable = ['name', 'code'];
}
