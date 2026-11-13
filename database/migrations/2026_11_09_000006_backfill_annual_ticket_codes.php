<?php

use App\Models\Ticket;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::transaction(function () {
            $codes = [];
            // Keep issued annual IDs. Allocate the remaining IDs in creation order.
            foreach (Ticket::query()->orderBy('created_at')->orderBy('id')->lockForUpdate()->lazy() as $ticket) {
                if (preg_match('/^[A-Z0-9_]{1,12}-[A-Z]{2}-[0-9]{7}$/D', $ticket->ticket_code)) {
                    continue;
                }

                if (!$ticket->created_at) {
                    throw new \RuntimeException("Ticket {$ticket->id} has no creation date.");
                }

                $ticket->withAllocatedTicketCode(fn () => DB::table('tickets')->where('id', $ticket->id)
                    ->update(['ticket_code' => $ticket->ticket_code]) === 1);
                $codes[$ticket->id] = $ticket->ticket_code;
            }

            DB::table('ticket_activities')->select('id', 'details')
                ->whereNotNull('details->linked_ticket_id')
                ->chunkById(500, function ($activities) use ($codes) {
                    foreach ($activities as $activity) {
                        $details = json_decode($activity->details, true, flags: JSON_THROW_ON_ERROR);
                        $code = $codes[$details['linked_ticket_id']] ?? null;
                        if ($code !== null) {
                            $details['linked_ticket_code'] = $code;
                            DB::table('ticket_activities')->where('id', $activity->id)
                                ->update(['details' => json_encode($details, JSON_THROW_ON_ERROR)]);
                        }
                    }
                });
        }, 3);
    }

    public function down(): void
    {
        // Preserve issued IDs and their counter history.
    }
};
