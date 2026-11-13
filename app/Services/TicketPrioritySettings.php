<?php
namespace App\Services;
use App\Models\TicketPriority;
use Illuminate\Support\Facades\Schema;

class TicketPrioritySettings
{
    // No process-wide cache: saved admin changes are visible on the next request.
    public static function targets(): array
    {
        if (!Schema::hasTable('ticket_priorities')) return config('ticket-sla.targets');
        return TicketPriority::orderBy('sort_order')->orderBy('id')->get()->mapWithKeys(fn ($p) => [$p->key => [
            'label' => $p->label, 'response' => $p->response_seconds,
            'resolution' => $p->resolution_seconds, 'update' => $p->update_seconds,
        ]])->all();
    }
    public static function labels(): array { return array_map(fn ($target) => $target['label'], self::targets()); }
    public static function policy(): array
    {
        $policy = config('ticket-sla');
        $policy['targets'] = self::targets();
        $policy['version'] = 'admin-'.hash('sha256', json_encode($policy['targets']));
        return $policy;
    }
}
