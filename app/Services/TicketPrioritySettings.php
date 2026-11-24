<?php
namespace App\Services;
use App\Models\TicketPriority;
use Illuminate\Support\Facades\Schema;

class TicketPrioritySettings
{
    // No process-wide cache: saved admin changes are visible on the next request.
    public static function targets(bool $activeOnly = false): array
    {
        if (!Schema::hasTable('ticket_priorities')) return config('ticket-sla.targets');
        return TicketPriority::when($activeOnly, fn ($query) => $query->whereNull('archived_at'))->orderBy('sort_order')->orderBy('id')->get()->mapWithKeys(fn ($p) => [$p->key => [
            'label' => $p->label, 'description'=>$p->description ?? '', 'score_points'=>$p->score_points ?? 0, 'response' => $p->response_seconds,
            'resolution' => $p->resolution_seconds, 'update' => $p->update_seconds,
        ]])->all();
    }
    public static function labels(bool $activeOnly = false): array { return array_map(fn ($target) => $target['label'], self::targets($activeOnly)); }
    public static function defaultKey(): string { $keys = array_keys(self::targets(true)); return in_array('low', $keys, true) ? 'low' : $keys[0]; }

    // Prior assignments in history reserve keys even if no ticket currently uses them.
    public static function isUsed(string $key): bool
    {
        return \App\Models\Ticket::where('priority', $key)->exists()
            || \App\Models\TicketActivity::where('type', 'priority_changed')->where(fn ($query) => $query->where('details->from', $key)->orWhere('details->to', $key))->exists();
    }

    public static function requireActive(string $key): void
    {
        // Called inside ticket write transactions: removal and assignment share the priority row lock.
        $priority = TicketPriority::where('key', $key)->lockForUpdate()->first();
        if (!$priority || $priority->archived_at) {
            throw \Illuminate\Validation\ValidationException::withMessages(['priority' => 'This priority is no longer available. Choose an active priority.']);
        }
    }
    public static function policy(): array
    {
        $policy = config('ticket-sla');
        $policy['targets'] = self::targets(true);
        $policy['version'] = 'admin-'.hash('sha256', json_encode($policy['targets']));
        return $policy;
    }
}
