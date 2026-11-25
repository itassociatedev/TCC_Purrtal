<?php
// Transactional integration check: all fixtures roll back and notifications are faked.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\{Ticket, TicketAssignmentHandover, User};
use App\Services\{TicketAccess, TicketSla};
use Illuminate\Support\Facades\{DB, Notification};
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

Notification::fake();
DB::beginTransaction();
try {
    $source = TicketAccess::members(false, true)->where('status', 'Active')->firstOrFail();
    $actor = $source->replicate();
    $actor->email = 'handover-check-'.bin2hex(random_bytes(8)).'@example.invalid';
    $actor->save();
    $ticket = Ticket::where('is_preview', false)->firstOrFail()->replicate();
    $ticket->status = 'not_started'; $ticket->priority = 'low';
    $ticket->assigned_to = $source->id; $ticket->creator_id = $actor->id;
    $ticket->save();
    app(TicketSla::class)->enroll($ticket, $actor, now());
    $grant = TicketAssignmentHandover::create(['member_id' => $actor->id, 'granted_by' => $source->id,
        'starts_on' => TicketAssignmentHandover::today(), 'ends_on' => TicketAssignmentHandover::today()]);
    $send = function ($data) use ($app, $actor, $ticket) {
        $request = Request::create('/tickets/handover/assign', 'PATCH', $data);
        $request->setUserResolver(fn () => $actor);
        $request->setLaravelSession($app['session']->driver());
        return app(App\Http\Controllers\TicketController::class)->assignDuringHandover($request, $ticket->fresh());
    };
    $check = function ($ok, $message) { if (!$ok) throw new RuntimeException($message); echo 'PASS: '.$message.PHP_EOL; };
    $send(['assigned_to' => $actor->id, 'priority' => 'high', 'priority_reason' => 'Operational impact', 'status' => 'in_progress']);
    $ticket->refresh();
    $check($ticket->assigned_to === $actor->id && $ticket->priority === 'high' && $ticket->status === 'in_progress', 'Active handover can assign, change priority and update status');
    $check($ticket->activities()->where('type', 'priority_changed')->exists(), 'Priority change recorded in ticket history');
    foreach ([['priority' => 'critical'], ['status' => 'closed'], ['status' => 'resolved'], ['action' => 'approve_workaround']] as $data) {
        try { $send($data); throw new RuntimeException('Restricted payload accepted'); }
        catch (ValidationException $e) { echo 'PASS: invalid or privileged payload rejected'.PHP_EOL; }
    }
    $grant->update(['revoked_at' => now()]);
    try { $send(['priority' => 'medium', 'priority_reason' => 'Review']); throw new RuntimeException('Revoked grant accepted'); }
    catch (HttpException $e) { $check($e->getStatusCode() === 403, 'Revoked handover denied'); }
    $grant->update(['revoked_at' => null, 'starts_on' => now('Asia/Manila')->subDays(2)->toDateString(), 'ends_on' => now('Asia/Manila')->subDay()->toDateString()]);
    try { $send(['status' => 'in_progress']); throw new RuntimeException('Expired grant accepted'); }
    catch (HttpException $e) { $check($e->getStatusCode() === 403, 'Expired handover denied'); }
} finally { DB::rollBack(); }
