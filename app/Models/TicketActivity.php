<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TicketActivity extends Model
{
    public $timestamps = false;
    protected $fillable = ['ticket_id', 'actor_id', 'type', 'message', 'details', 'created_at'];
    protected function casts(): array { return ['details' => 'array', 'created_at' => 'datetime']; }
    public function actor() { return $this->belongsTo(User::class, 'actor_id'); }
}
