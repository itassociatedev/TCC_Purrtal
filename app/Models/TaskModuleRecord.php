<?php

namespace App\Models;

use App\Support\TaskIdFormatter;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TaskModuleRecord extends Model
{
    use SoftDeletes;
    protected $guarded = [];
    protected function casts(): array { return ['payload'=>'array','version'=>'integer','creator_id'=>'integer','assignee_id'=>'integer','reviewer_id'=>'integer']; }
    public function document(): array
    {
        $payload = $this->payload;
        $payload['taskCode'] ??= TaskIdFormatter::make(
            $payload['taskIdPrefixSource'] ?? 'department',
            $payload['department'] ?? $this->department,
            $payload['assigneeRole'] ?? '',
            $this->created_at?->timezone('Asia/Manila')->format('Ymd') ?? now('Asia/Manila')->format('Ymd'),
            (int) $this->id,
        );

        return [...$payload, '_serverKey' => $this->client_key, '_serverVersion' => $this->version];
    }
}
