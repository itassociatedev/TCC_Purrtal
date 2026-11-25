<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class TicketPriority extends Model
{
    protected $fillable = ['key', 'label', 'response_seconds', 'resolution_seconds', 'update_seconds', 'sort_order', 'score_points', 'time_completion_points', 'description'];
    protected function casts(): array { return ['time_completion_points'=>'integer', 'score_points'=>'integer', 'archived_at' => 'datetime', 'response_seconds' => 'integer', 'resolution_seconds' => 'integer', 'update_seconds' => 'integer', 'sort_order' => 'integer']; }
}
