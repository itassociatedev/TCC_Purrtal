<?php
namespace App\Services;

use App\Models\{Ticket,TicketPriority};
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Schema;

class TicketResolutionScore
{
    public static function deadline(Ticket $ticket,string $priority,bool $historical=false,?string $at=null): ?string
    {
        $policy=$ticket->sla_policy;
        $target=$historical ? ($ticket->sla_state['resolution_result']['target'] ?? $policy['targets'][$priority]['resolution'] ?? null) : ($policy['targets'][$priority]['resolution'] ?? null);
        if (!$ticket->sla_received_at || !$target || !$policy) return null;
        try {
            $clock=new SupportClock($policy);$running=CarbonImmutable::parse($ticket->sla_received_at);$remaining=(int)$target;$stoppedAt=null;
            $cutoff=CarbonImmutable::parse($at ?? now());
            if($cutoff->lt($running))return null;
            // Reconstruct active support segments so revision holds, legacy pauses and reopen gaps
            // do not consume the SLA allowance. After a deadline is crossed, lateness is wall-clock time.
            foreach($ticket->activities()->reorder('created_at')->orderBy('id')->get() as $event){
                $instant=CarbonImmutable::parse($event->created_at);
                if($instant->gt($cutoff))break;
                if($instant->lt(CarbonImmutable::parse($ticket->sla_received_at)))continue;
                if(in_array($event->type,['paused','revision_requested','rejected','approve_workaround','resolved'],true) && $running){
                    $used=$clock->seconds($running,$instant);
                    if($used>=$remaining)return $clock->deadline($running,$remaining);
                    $remaining-=$used;$running=null;$stoppedAt=$instant;
                }elseif(in_array($event->type,['resumed','revision_submitted','reopened'],true) && !$running){$running=$instant;}
            }
            return $clock->deadline($running ?? $stoppedAt ?? $ticket->sla_received_at,$remaining);
        }catch(\Throwable){return null;}
    }
    public static function capture(string $priority,int $resolver,string $at,?string $deadline=null): array
    {
        $setting=TicketPriority::where('key',$priority)->lockForUpdate()->first();
        $base=['priority'=>$priority,'label'=>$setting?->label ?? $priority,'points'=>(int)($setting?->score_points ?? 0),'resolved_by'=>$resolver,'resolved_at'=>$at];
        // Historical migrations run before the completion-points column exists; keep their old snapshot upgradeable.
        $newModel=$setting ? array_key_exists('time_completion_points',$setting->getAttributes()) : Schema::hasColumn('ticket_priorities','time_completion_points');
        if (!$newModel) return $base;
        $cap=(int)($setting?->time_completion_points ?? 0);$late=null;$time=0;
        if($deadline!==null){
            $late=max(0,CarbonImmutable::parse($at)->getTimestamp()-CarbonImmutable::parse($deadline)->getTimestamp());
            $penalty=$late===0?0:($late<=86400?1:($late<=172800?2:3));
            $time=max(0,$cap-$penalty);
        }
        return [...$base,'model'=>'priority_time_v2','priority_points'=>$base['points'],'time_points'=>$time,'time_max_points'=>$cap,
            'resolution_deadline'=>$deadline,'lateness_seconds'=>$late,'lateness_basis'=>'calendar_hours',
            'time_evidence'=>$deadline===null?'missing_deadline':'recorded','points'=>$base['points']+$time];
    }
    public static function backfill(Ticket $ticket,bool $recalculate=false): void
    {
        $state=$ticket->sla_state ?? [];$before=$state['resolution_score'] ?? null;
        if (($before && !$recalculate) || ($before['model'] ?? '')==='priority_time_v2' || !in_array($ticket->status,['resolved','closed'],true)) return;
        $resolution=$ticket->activities()->where('type','resolved')->latest('id')->first();
        $at=$before['resolved_at'] ?? $state['resolved_at'] ?? $resolution?->created_at?->toIso8601String();
        $resolver=$before['resolved_by'] ?? $state['resolved_by'] ?? $resolution?->actor_id;
        if (!$at || !$resolver) return;
        $priority=$before['priority'] ?? $ticket->priority;
        if(!$before) foreach($ticket->activities()->where('type','priority_changed')->orderByDesc('id')->get() as $event){
            $after=$resolution ? $event->id>$resolution->id : $event->created_at->gt(CarbonImmutable::parse($at));
            if($after && isset($event->details['from']))$priority=$event->details['from'];
        }
        $score=self::capture($priority,(int)$resolver,$at,self::deadline($ticket,$priority,true,$at));$score['source']='historical_backfill';
        $state['resolution_score']=$score;$ticket->sla_state=$state;$ticket->save();
        app(TicketSla::class)->activity($ticket,null,$recalculate?'resolution_score_recalculated':'resolution_score_backfilled',
            $recalculate?'Resolution score updated to priority plus calendar-time completion.':'Resolution points recorded using historical resolution priority.',
            $recalculate?['before'=>$before,'after'=>$score]:$score);
    }
}
