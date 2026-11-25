<?php
// Exercise real controller/service paths; fixtures roll back and messages never leave the test.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\Ticket;
use App\Services\{TicketAccess, TicketSla};
use App\Notifications\TicketNotification;
use Illuminate\Support\Facades\{DB, Notification, Route};
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
Notification::fake(); DB::beginTransaction();
try {
    $leader = TicketAccess::members(false)->with('role')->get()->first(fn ($u) => TicketAccess::role($u) === 'leader');
    if (!$leader) throw new RuntimeException('Supervisor fixture required');
    $ticket = Ticket::where('is_preview', false)->firstOrFail()->replicate();
    $ticket->status = 'in_progress'; $ticket->priority = 'low'; $ticket->assigned_to = $leader->id; $ticket->save();
    $sla = app(TicketSla::class); $sla->enroll($ticket, $leader, now());
    $related = $ticket->replicate(); $related->ticket_code = 'ALB-HW-2699999'; $related->save();
    DB::table('tickets')->where('id', $related->id)->update(['ticket_code' => 'ALB-HW-2699999']);
    $request = function (array $data) use ($leader, $app, $ticket) {
        $request = Request::create('/tickets/'.$ticket->id, 'PATCH', $data);
        $request->setUserResolver(fn () => $leader);
        $request->setLaravelSession($app['session']->driver());
        $request->setRouteResolver(fn () => Route::getRoutes()->getByName('tickets.update'));
        app(App\Http\Controllers\TicketController::class)->update($request, $ticket->fresh());
    };
    $check = function ($ok, $message) { if (!$ok) throw new RuntimeException($message); echo 'PASS: '.$message.PHP_EOL; };
    foreach (['  alb-hw-2699999  ', (string) $related->id] as $code) {
        $request(['action' => 'update', 'note' => 'Related ticket check', 'linked_ticket_id' => $code]);
        $check(true, 'Related ticket accepted: '.$code);
    }
    foreach (['ALB-HW-2699998', $ticket->ticket_code] as $code) {
        try { $request(['action' => 'update', 'note' => 'Must fail', 'linked_ticket_id' => $code]); throw new RuntimeException('Invalid related ticket accepted'); }
        catch (ValidationException $e) { $check(isset($e->errors()['linked_ticket_id']), 'Unknown/self related ticket rejected'); }
    }
    $inactive = $leader->replicate(); $inactive->email = 'inactive-check-'.bin2hex(random_bytes(8)).'@example.invalid'; $inactive->status = 'Inactive'; $inactive->save();
    try { $request(['action' => 'save', 'assigned_to' => $inactive->id]); throw new RuntimeException('Inactive assignee accepted'); }
    catch (ValidationException $e) { $check(isset($e->errors()['assigned_to']), 'Inactive assignee rejected'); }
    $sla->apply($ticket->fresh(), $leader, 'leader', ['action' => 'delay', 'delay_reason' => 'Waiting for replacement part',
        'actions_taken' => 'Contacted supplier', 'assistance_required' => 'None', 'next_update_at' => now()->addHour()->toIso8601String()]);
    $event = $ticket->activities()->where('type', 'delay')->firstOrFail();
    $check($event->message === 'Waiting for replacement part' && $event->details['delay_reason'] === $event->message, 'Delay accepts a single explanation and preserves it in history');
    try {
        $sla->apply($ticket->fresh(), $leader, 'leader', ['action' => 'delay', 'actions_taken' => 'Checked', 'assistance_required' => 'None', 'next_update_at' => now()->addHour()->toIso8601String()]);
        throw new RuntimeException('Missing delay explanation accepted');
    } catch (ValidationException $e) { $check(isset($e->errors()['delay_reason']), 'Delay still requires its explanation'); }
    $sla->apply($ticket->fresh(), $leader, 'leader', ['action' => 'acknowledge', 'assessment' => 'Checked', 'next_steps' => 'Repair']);
    $sla->apply($ticket->fresh(), $leader, 'leader', ['action' => 'save', 'status' => 'resolved', 'findings' => 'Fault found', 'resolution_details' => 'Fixed and verified']);
    Notification::fake();
    $sla->apply($ticket->fresh(), $leader, 'leader', ['action' => 'save', 'status' => 'closed', 'note' => 'Verified with requester']);
    $check($ticket->fresh()->status === 'closed', 'Supervisor closes resolved ticket');
    Notification::assertSentToTimes($ticket->creator, TicketNotification::class, 1);
    $check(true, 'Tracked closure notifies requester exactly once');
} finally { DB::rollBack(); }
