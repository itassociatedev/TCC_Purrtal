<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\{Ticket, User};
use App\Services\{TicketAccess, TicketLeaderboard};
use Illuminate\Support\Facades\{DB, Auth, Route};
use Illuminate\Http\Request;
$check = function ($ok, $message) { if (!$ok) throw new RuntimeException($message); echo "PASS: {$message}\n"; };
$members = TicketAccess::members(true)->with('role')->get()->filter(fn ($u) => TicketAccess::role($u) === 'member')->values();
$service = app(TicketLeaderboard::class);
$baseline = collect($service->summary(true)['members'])->keyBy('id');
$sample = Ticket::where('is_preview', true)->firstOrFail();
DB::beginTransaction();
try {
    $ticket = $sample->replicate();
    $ticket->status = 'closed';
    $ticket->assigned_to = $members[1]->id;
    $ticket->sla_state = array_merge($ticket->sla_state ?? [], ['resolved_by' => $members[0]->id, 'resolved_at' => now()->utc()->toIso8601String()]);
    $ticket->save();
    $rows = collect($service->summary(true)['members'])->keyBy('id');
    $check($rows[$members[0]->id]['resolved'] === $baseline[$members[0]->id]['resolved'] + 1, 'Actual resolver receives credit for a closed ticket');
    $check($rows[$members[1]->id]['resolved'] === $baseline[$members[1]->id]['resolved'], 'Current assignee does not receive another resolver credit');
    $resolved = $service->summary(true, 'all', $members[0]->id, 'resolved')['detail'];
    $check($resolved['total'] === $rows[$members[0]->id]['resolved'] && collect($resolved['entries'])->pluck('ticket.id')->contains($ticket->id), 'Resolved detail uses the same resolver and total as the ranking');
    $ticket->status = 'in_progress';
    $ticket->sla_policy = config('ticket-sla');
    $ticket->priority = 'critical';
    $ticket->sla_state = ['elapsed' => 1000000, 'running_since' => now()->utc()->toIso8601String(), 'acknowledged_at' => null, 'resolved_at' => null, 'paused_at' => null, 'reopen_count' => 1];
    $ticket->save();
    $result = $service->summary(true); $rows = collect($result['members'])->keyBy('id');
    $check($rows[$members[0]->id]['resolved'] === $baseline[$members[0]->id]['resolved'], 'Reopened ticket loses completed credit until resolved again');
    $check($rows[$members[1]->id]['overdue'] === $baseline[$members[1]->id]['overdue'] + 1, 'Overdue open ticket counts against its current owner');
    $overdue = $service->summary(true, 'all', $members[1]->id, 'overdue')['detail'];
    $check($overdue['total'] === $rows[$members[1]->id]['overdue'] && collect($overdue['entries'])->pluck('ticket.id')->contains($ticket->id), 'Overdue detail includes the current owner’s overdue ticket');
    $check(count($result['members']) === $members->count(), 'Every IT member appears, including zero-resolution members');
    foreach ($result['members'] as $m) $check($m['percentage'] === ($result['total_resolved'] ? round($m['resolved'] / $result['total_resolved'] * 100, 2) : 0), 'Contribution percentage uses actual member resolutions');
    foreach ([3.5, 2.5] as $rating) $ticket->activities()->create(['actor_id' => $ticket->creator_id, 'type' => 'feedback', 'message' => 'Rating fixture', 'details' => ['rating' => $rating, 'resolved_by' => $members[0]->id], 'created_at' => now()]);
    $rated = collect($service->summary(true)['members'])->keyBy('id');
    $expectedCount = $baseline[$members[0]->id]['rating_count'] + 1;
    $check($rated[$members[0]->id]['rating_count'] === $expectedCount, 'Latest feedback counts once per ticket for actual resolver');
    $ratings = $service->summary(true, 'all', $members[0]->id, 'ratings')['detail'];
    $feedback = collect($ratings['entries'])->firstWhere('ticket_id', $ticket->id);
    $check($ratings['total'] === $expectedCount && $feedback['rating'] === 2.5 && $feedback['comment'] === 'Rating fixture', 'Ratings detail includes the latest half-star score and comment for the actual resolver');
    // Compute the expected average from original unrounded feedback, not the
    // already rounded baseline display average (which can lose precision).
    $values = App\Models\TicketActivity::whereIn('ticket_id', Ticket::where('is_preview', true)->select('id'))->where('type', 'feedback')->latest('id')->get()->unique('ticket_id')
        ->filter(function ($e) use ($members) {
            $resolver = $e->details['resolved_by'] ?? App\Models\TicketActivity::where('ticket_id', $e->ticket_id)->where('type', 'resolved')->where('id', '<', $e->id)->latest('id')->value('actor_id');
            return (int) $resolver === $members[0]->id;
        })->map(fn ($e) => (float) $e->details['rating']);
    $check($rated[$members[0]->id]['rating_average'] === round($values->avg(), 1), 'Half-star feedback contributes to average rating');
    $check($rated[$members[1]->id]['rating_count'] === $baseline[$members[1]->id]['rating_count'], 'Reassignment does not transfer ratings');
    $check($rated[$members[0]->id]['rank'] === $rows[$members[0]->id]['rank'], 'Rating does not change resolution rank');
    $ticket->is_preview = false; $ticket->save();
    $rows = collect($service->summary(true)['members'])->keyBy('id');
    $check($rows[$members[0]->id]['rating_count'] === $baseline[$members[0]->id]['rating_count'], 'Live ratings excluded from preview leaderboard');
    $check($rows[$members[1]->id]['overdue'] === $baseline[$members[1]->id]['overdue'], 'Live ticket does not leak into preview leaderboard');
    $admin = User::with('role')->get()->first(fn ($u) => TicketAccess::canPreview($u)); Auth::setUser($admin);
    $req = Request::create('/tickets/preview', 'GET', ['preview_user' => $members[0]->id, 'view' => 'leaderboard', 'leaderboard_member' => $members[0]->id, 'leaderboard_detail' => 'ratings']);
    $req->setRouteResolver(fn () => Route::getRoutes()->getByName('tickets.preview.index'));
    $req->setUserResolver(fn () => $admin); $req->setLaravelSession($app['session']->driver());
    try { app(App\Http\Controllers\TicketController::class)->index($req); throw new RuntimeException('Member accessed leaderboard'); }
    catch (Symfony\Component\HttpKernel\Exception\HttpException $e) { $check($e->getStatusCode() === 403, 'Leaderboard restricted to leaders'); }
    // Freeze both clock types so calendar boundaries and export results are deterministic.
    $oldNow = \Illuminate\Support\Carbon::getTestNow();
    $oldImmutable = \Carbon\CarbonImmutable::getTestNow();
    \Illuminate\Support\Carbon::setTestNow('2026-11-04 12:00:00 Asia/Manila');
    \Carbon\CarbonImmutable::setTestNow('2026-11-04 12:00:00 Asia/Manila');
    try {
        $before = [];
        foreach (['day', 'week', 'month', 'year', 'all'] as $period) $before[$period] = $service->summary(true, $period)['total_resolved'];
        foreach (['2026-11-04 08:00:00', '2026-11-02 08:00:00', '2026-11-01 08:00:00', '2026-01-02 08:00:00', '2025-12-31 08:00:00'] as $date) {
            $fixture = $sample->replicate(); $fixture->is_preview = true; $fixture->status = 'resolved';
            $fixture->sla_state = array_merge($fixture->sla_state ?? [], ['resolved_by' => $members[0]->id, 'resolved_at' => \Carbon\CarbonImmutable::parse($date, 'Asia/Manila')->utc()->toIso8601String()]);
            $fixture->save();
        }
        foreach (['day' => 1, 'week' => 2, 'month' => 3, 'year' => 4, 'all' => 5] as $period => $added) {
            $check($service->summary(true, $period)['total_resolved'] === $before[$period] + $added, "{$period} uses Manila resolution-date boundaries");
        }
        $data = $service->summary(true, 'day');
        $dayMember = collect($data['members'])->firstWhere('id', $members[0]->id);
        $dayDetail = $service->summary(true, 'day', $members[0]->id, 'resolved')['detail'];
        $check($dayDetail['total'] === $dayMember['resolved'], 'Drill-down uses the selected Manila calendar period');
        $response = $service->export($data, true);
        ob_start(); ($response->getCallback())(); $bytes = ob_get_clean();
        $file = tempnam(sys_get_temp_dir(), 'ticket-leaderboard-');
        try {
            file_put_contents($file, $bytes); $book = \PhpOffice\PhpSpreadsheet\IOFactory::load($file);
            try {
                $sheet = $book->getSheetByName('Leaderboard');
                $check($sheet->getHighestRow() === count($data['members']) + 1, 'XLSX includes every filtered leaderboard member');
                foreach ($data['members'] as $i => $m) $check((int) $sheet->getCell('E'.($i + 2))->getValue() === $m['resolved'] && $sheet->getCell('F'.($i + 2))->getValue() === number_format($m['percentage'], 2, '.', ''), 'Export resolutions and shares match selected-period screen data');
                $check($book->getSheetByName('Scope')->getCell('B2')->getValue() === 'day', 'Export records period and scope');
            } finally { $book->disconnectWorksheets(); }
        } finally { unlink($file); }
    } finally { \Illuminate\Support\Carbon::setTestNow($oldNow); \Carbon\CarbonImmutable::setTestNow($oldImmutable); }
    echo "Leaderboard checks passed. All writes rolled back.\n";
} finally { DB::rollBack(); }
