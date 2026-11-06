<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TaskModuleRecord extends Model
{
    use SoftDeletes;
    protected $guarded = [];
    protected function casts(): array { return ['payload'=>'array','version'=>'integer','creator_id'=>'integer','assignee_id'=>'integer','reviewer_id'=>'integer']; }
    public function document(): array
    {
        return [...$this->payload, '_serverKey' => $this->client_key, '_serverVersion' => $this->version];
    }
}
