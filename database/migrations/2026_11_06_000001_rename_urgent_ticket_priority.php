<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $this->renamePriority('urgent', 'critical');
    }

    public function down(): void
    {
        $this->renamePriority('critical', 'urgent');
    }

    private function renamePriority(string $from, string $to): void
    {
        DB::transaction(function () use ($from, $to) {
            DB::table('tickets')->select('id', 'priority', 'sla_policy', 'sla_state')
                ->chunkById(500, function ($tickets) use ($from, $to) {
                    foreach ($tickets as $ticket) {
                        $changes = $ticket->priority === $from ? ['priority' => $to] : [];
                        $policy = json_decode($ticket->sla_policy ?? 'null', true, flags: JSON_THROW_ON_ERROR);
                        if (isset($policy['targets'][$from])) {
                            // Keep the original SLA allowances stored with each ticket.
                            $policy['targets'][$to] = $policy['targets'][$from];
                            unset($policy['targets'][$from]);
                            $changes['sla_policy'] = json_encode($policy, JSON_THROW_ON_ERROR);
                        }
                        $state = json_decode($ticket->sla_state ?? 'null', true, flags: JSON_THROW_ON_ERROR);
                        if (!empty($state['alerts'])) {
                            $alerts = [];
                            foreach ($state['alerts'] as $key => $sentAt) {
                                $alerts[str_replace(":{$from}:", ":{$to}:", $key)] = $sentAt;
                            }
                            // Preserve already-sent alerts so the scheduler won't resend them.
                            if ($alerts !== $state['alerts']) {
                                $state['alerts'] = $alerts;
                                $changes['sla_state'] = json_encode($state, JSON_THROW_ON_ERROR);
                            }
                        }
                        if ($changes) DB::table('tickets')->where('id', $ticket->id)->update($changes);
                    }
                });

            DB::table('ticket_activities')->select('id', 'details')
                ->whereIn('type', ['priority_changed', 'sla_alert'])->whereNotNull('details')
                ->chunkById(500, function ($activities) use ($from, $to) {
                    foreach ($activities as $activity) {
                        $details = json_decode($activity->details, true, flags: JSON_THROW_ON_ERROR);
                        $updated = $details;
                        foreach (['from', 'to'] as $field) {
                            if (($details[$field] ?? null) === $from) $updated[$field] = $to;
                        }
                        if (isset($details['key'])) $updated['key'] = str_replace(":{$from}:", ":{$to}:", $details['key']);
                        if ($updated !== $details) {
                            DB::table('ticket_activities')->where('id', $activity->id)
                                ->update(['details' => json_encode($updated, JSON_THROW_ON_ERROR)]);
                        }
                    }
                });
        });
    }
};
