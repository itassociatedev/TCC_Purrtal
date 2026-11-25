<?php

namespace App\Console\Commands;

use App\Models\Ticket;
use App\Services\TicketSla;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CheckTicketSlas extends Command
{
    protected $signature = 'tickets:check-sla';
    protected $description = 'Check SLA warnings, breaches and progress reminders for live tracked tickets';

    public function handle(TicketSla $sla): int
    {
        Ticket::where('is_preview', false)->whereNotNull('sla_policy')->whereNotNull('priority')
            ->where('status', '!=', 'closed')->select('id')->chunkById(100, function ($tickets) use ($sla) {
                foreach ($tickets as $ticket) {
                    DB::transaction(function () use ($sla, $ticket) {
                        $locked = Ticket::whereKey($ticket->id)->lockForUpdate()->first();
                        if ($locked) $sla->check($locked);
                    });
                }
            });
        $this->info('Ticket SLA checks completed.');
        return self::SUCCESS;
    }
}
