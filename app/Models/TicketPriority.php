<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class TicketPriority extends Model
{
    protected $fillable = ['key', 'label', 'response_seconds', 'resolution_seconds', 'update_seconds', 'sort_order'];
    protected function casts(): array { return ['response_seconds' => 'integer', 'resolution_seconds' => 'integer', 'update_seconds' => 'integer', 'sort_order' => 'integer']; }
}
