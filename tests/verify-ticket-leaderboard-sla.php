<?php
// Read-only aggregation check against the installed database; creates no tickets.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Ticket;
use App\Services\{TicketLeaderboard, TicketSla};
use Carbon\CarbonImmutable;

foreach ([false, true] as $preview) {
    foreach (['all', 'month'] as $period) {
        $data = app(TicketLeaderboard::class)->summary($preview, $period);
        $totals = [];
        $tickets = Ticket::where('is_preview', $preview)->whereIn('status', ['resolved', 'closed'])
            ->with(['activities' => fn ($q) => $q->where('type', 'resolved')])->get();
        foreach ($tickets as $ticket) {
            $resolver = $ticket->sla_state['resolved_by'] ?? $ticket->activities->first()?->actor_id;
            $at = $ticket->sla_state['resolved_at'] ?? $ticket->activities->first()?->created_at;
            if ($data['from'] && (!$at || !CarbonImmutable::parse($at)->betweenIncluded($data['from'], $data['to']))) continue;
            $view = app(TicketSla::class)->snapshot($ticket);
            foreach (['response', 'resolution'] as $metric) {
                if (($view['enabled'] ?? false) && ($view[$metric.'_complete'] ?? false)
                    && is_numeric($view[$metric.'_elapsed'] ?? null) && $view[$metric.'_elapsed'] >= 0) {
                    $totals[$resolver][$metric][] = $view[$metric.'_elapsed'];
                }
            }
        }
        foreach ($data['members'] as $member) {
            foreach (['response', 'resolution'] as $metric) {
                $values = $totals[$member['id']][$metric] ?? [];
                $expected = $values ? round(array_sum($values) / count($values), 2) : null;
                if ($member['sla_'.$metric.'_count'] !== count($values) || $member['sla_'.$metric.'_average'] !== $expected) {
                    throw new RuntimeException('Incorrect SLA aggregate for '.$member['id'].' '.$metric);
                }
            }
        }
        echo 'PASS: '.($preview ? 'test' : 'live').' '.$period.' SLA averages, sample counts and missing values'.PHP_EOL;
    }
}
