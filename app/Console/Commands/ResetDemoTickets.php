<?php

namespace App\Console\Commands;

use App\Models\{Ticket, User};
use App\Notifications\TicketNotification;
use App\Services\TicketDemoFactory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\{DB, Notification, Storage};
use Illuminate\Support\Str;

class ResetDemoTickets extends Command
{
    protected $signature = 'tickets:reset-demo {--include-live : Replace non-preview local tickets as well}';
    protected $description = 'Back up and replace local demonstration tickets with SLA-enabled samples';

    public function handle(TicketDemoFactory $factory): int
    {
        // Never expose this destructive test-data workflow to production.
        if (!app()->environment(['local', 'testing'])) {
            $this->error('Demo reset is restricted to local/testing environments.');
            return self::FAILURE;
        }
        Notification::fake(); // Resetting examples must not notify actual employees.
        $archivePath = 'ticket-backups/'.now()->format('Ymd-His').'-'.Str::uuid().'.json';
        DB::transaction(function () use ($factory, $archivePath) {
            $query = Ticket::query();
            if (!$this->option('include-live')) $query->where('is_preview', true);
            $tickets = $query->lockForUpdate()->get();
            $ids = $tickets->pluck('id');
            $notificationQuery = DB::table('notifications')->where('type', TicketNotification::class)->whereIn('data->ticket_id', $ids);
            $backup = ['created_at' => now()->toIso8601String(), 'scope' => $this->option('include-live') ? 'all_local_tickets' : 'preview_tickets',
                'tickets' => DB::table('tickets')->whereIn('id', $ids)->get(),
                'activities' => DB::table('ticket_activities')->whereIn('ticket_id', $ids)->get(),
                'notifications' => (clone $notificationQuery)->get()];
            if (!Storage::disk('local')->put($archivePath, json_encode($backup, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR))) {
                throw new \RuntimeException('Backup failed; no tickets were removed.');
            }
            // Keep account/branch records and monotonically increasing ticket IDs.
            // Ticket activities cascade; only notifications for removed tickets are cleared.
            $notificationQuery->delete();
            Ticket::whereIn('id', $ids)->delete();
            $count = $factory->seedPreview();
            foreach ($tickets->where('is_preview', false)->pluck('creator_id')->unique() as $creatorId) {
                if ($creator = User::find($creatorId)) {
                    $factory->make($creator, null, null, 'new', false);
                    $count++;
                }
            }
            $this->info("Replaced {$tickets->count()} old tickets with {$count} SLA-enabled examples.");
        });
        $this->info('Backup: '.Storage::disk('local')->path($archivePath));
        return self::SUCCESS;
    }
}
