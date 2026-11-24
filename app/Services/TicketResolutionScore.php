<?php
namespace App\Services;

use App\Models\{Ticket, TicketPriority};

class TicketResolutionScore
{
    public static function capture(string $priority, int $resolver, string $at): array
    {
        // Read current administrator settings at resolution, not the ticket's older SLA policy.
        $setting=TicketPriority::where('key',$priority)->lockForUpdate()->first();
        return ['priority'=>$priority, 'label'=>$setting?->label ?? $priority,
            'points'=>(int)($setting?->score_points ?? 0), 'resolved_by'=>$resolver, 'resolved_at'=>$at];
    }

    public static function backfill(Ticket $ticket): void
    {
        $state=$ticket->sla_state ?? [];
        if (isset($state['resolution_score']) || !in_array($ticket->status,['resolved','closed'],true)) return;
        $resolution=$ticket->activities()->where('type','resolved')->latest('id')->first();
        $at=$state['resolved_at'] ?? $resolution?->created_at?->toIso8601String();
        $resolver=$state['resolved_by'] ?? $resolution?->actor_id;
        if (!$at || !$resolver) return; // Missing historical evidence stays unscored.
        $priority=$ticket->priority;
        // Undo changes made after resolution to recover the priority at that milestone.
        foreach ($ticket->activities()->where('type','priority_changed')->orderByDesc('id')->get() as $event) {
            $after=$resolution ? $event->id>$resolution->id : $event->created_at->gt(\Carbon\CarbonImmutable::parse($at));
            if ($after && isset($event->details['from'])) $priority=$event->details['from'];
        }
        $score=self::capture($priority,(int)$resolver,$at);
        $score['source']='historical_backfill';
        $state['resolution_score']=$score;$ticket->sla_state=$state;$ticket->save();
        app(TicketSla::class)->activity($ticket,null,'resolution_score_backfilled','Resolution points recorded using historical resolution priority.',$score);
    }
}
