<?php

// Integration checks use the installed schema, fake all notifications, and roll
// back all records. They do not depend on unrelated legacy migration ordering.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\{Branch, Department, Role, Ticket, User};
use App\Services\TicketSla;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\{DB, Notification};
use Illuminate\Support\Str;

$assert = function ($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
    echo "PASS: {$message}\n";
};
$time = function ($local) {
    $at = CarbonImmutable::parse($local, 'Asia/Manila');
    Carbon::setTestNow($at);
    CarbonImmutable::setTestNow($at);
};
$failed = false;
DB::beginTransaction();
Notification::fake();
try {
    $time('2026-10-27 08:00:00');
    $makeUser = function ($role) {
        return User::withoutEvents(fn () => User::create(['name' => 'SLA verification '.$role,
            'email' => Str::uuid().'@example.invalid', 'password' => Str::random(64), 'status' => 'Disabled',
            'role_id' => Role::firstOrCreate(['name' => $role])->id, 'branch_id' => Branch::firstOrFail()->id,
            'department_id' => Department::firstOrCreate(['name' => 'IT'])->id]));
    };
    $employee = $makeUser('employee');
    $leader = $makeUser('IT TL');
    $member = $makeUser('IT Member');
    $controller = app(\App\Http\Controllers\TicketController::class);
    $request = function ($name, $actor, $input) use ($app) {
        $req = \Illuminate\Http\Request::create('/tickets', 'PATCH', $input);
        $req->setRouteResolver(fn () => \Illuminate\Support\Facades\Route::getRoutes()->getByName($name));
        $req->setUserResolver(fn () => $actor);
        $req->setLaravelSession($app['session']->driver());
        return $req;
    };
    $intake = ['branch_id' => $member->branch_id, 'subject' => 'Emergency enrollment check',
        'description' => 'Portal unavailable', 'category' => 'Network', 'employee_department' => \App\Models\Department::firstOrCreate(['name' => 'IT'])->name,
        'affected_asset' => 'Branch network', 'operational_impact' => 'Cannot access portal',
        'reporting_channel' => 'viber',
        'emergency_reason' => 'No connectivity to portal', 'emergency_received_at' => now()->subMinutes(10)->toIso8601String(),
        'priority' => 'critical'];
    $controller->store($request('tickets.store', $member, $intake));
    $emergency = Ticket::where('subject', 'Emergency enrollment check')->firstOrFail();
    $sla = app(TicketSla::class);
    $assert($emergency->assigned_to === $member->id && $emergency->priority === 'critical' && $emergency->reporting_channel === 'viber'
        && $sla->snapshot($emergency)['resolution_elapsed'] === 0, 'IT creation uses creation time, assigns owner and applies initial priority');
    try {
        $controller->update($request('tickets.update', $employee, ['status' => 'closed']), $emergency);
        throw new RuntimeException('Employee management allowed');
    } catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
        $assert($e->getStatusCode() === 403, 'Controller rejects employee ticket management');
    }
    try {
        $controller->update($request('tickets.update', $member, ['status' => 'closed']), $emergency);
        throw new RuntimeException('Controller allowed member closure');
    } catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
        $assert($e->getStatusCode() === 403, 'Controller enforces leader-only closure');
    }
    $makeTicket = function () use ($sla, $employee, $member) {
        $ticket = Ticket::create(['creator_id' => $employee->id, 'employee_name' => $employee->name,
            'branch_id' => $employee->branch_id, 'subject' => 'SLA rollback verification',
            'description' => 'Temporary verification record', 'category' => 'Hardware',
            'assigned_to' => $member->id, 'is_preview' => false]);
        $sla->enroll($ticket, $employee, now());
        return $ticket;
    };
    $t = $makeTicket();
    $time('2026-10-27 09:00:00');
    $assert($sla->snapshot($t)['resolution_elapsed'] === 3600 && $sla->snapshot($t)['resolution_target'] === null, 'Not Set accrues support time without a deadline');
    $sla->apply($t, $leader, 'leader', ['priority' => 'critical', 'priority_reason' => 'Essential operations affected']);
    $assert($sla->snapshot($t)['resolution_remaining'] === 10800, 'Initial classification uses receipt time, not classification time');
    $sla->apply($t, $member, 'member', ['action' => 'acknowledge', 'assessment' => 'Printer unavailable', 'next_steps' => 'Check connection']);
    $assert($sla->snapshot($t)['response_status'] === 'Breached', 'Late acknowledgment is recorded as a response breach');
    $time('2026-10-27 09:30:00');
    try {
        $sla->apply($t, $member, 'member', ['action' => 'pause', 'pause_reason' => 'vendor', 'note' => 'Must be rejected']);
        throw new RuntimeException('Pause was accepted');
    } catch (Illuminate\Validation\ValidationException $e) {
        $assert(isset($e->errors()['action']), 'New pauses are rejected');
    }
    // Legacy stored pauses still support resumption; do not create them through the removed action.
    $legacyPause = $t->sla_state;
    $legacyPause['elapsed'] = 5400;
    $legacyPause['running_since'] = null;
    $legacyPause['paused_at'] = now()->utc()->toIso8601String();
    $legacyPause['pause_reason'] = 'vendor';
    $t->sla_state = $legacyPause; $t->save();
    $time('2026-10-27 11:00:00');
    $assert($sla->snapshot($t)['resolution_elapsed'] === 5400, 'Historical stored pause excludes waiting time');
    $sla->apply($t, $leader, 'leader', ['priority' => 'medium', 'priority_reason' => 'Review during vendor wait']);
    $assert($sla->snapshot($t)['resolution_target'] === 124200 && $sla->snapshot($t)['resolution_elapsed'] === 5400 && $sla->snapshot($t)['paused'], 'Paused ticket follows newest priority without resuming or resetting elapsed time');
    $sla->apply($t, $leader, 'leader', ['priority' => 'critical', 'priority_reason' => 'Restore Critical classification']);
    $sla->apply($t, $member, 'member', ['action' => 'resume', 'note' => 'Vendor is available']);
    $time('2026-10-27 11:30:00');
    $sla->apply($t, $leader, 'leader', ['priority' => 'high', 'priority_reason' => 'Workaround available']);
    $assert($sla->snapshot($t)['resolution_elapsed'] === 7200 && $sla->snapshot($t)['resolution_remaining'] === 21600, 'Priority changes retain elapsed resolution time');
    $assert($sla->snapshot($t)['response_status'] === 'Breached', 'Priority change cannot hide a completed response breach');
    $time('2026-10-27 12:00:00');
    $docs = ['status' => 'resolved', 'findings' => 'Faulty connection', 'troubleshooting_performed' => 'Tested cable',
        'corrective_actions' => 'Replaced cable', 'resolution_details' => 'Printing restored permanently'];
    $sla->apply($t, $member, 'member', $docs);
    $assert($sla->snapshot($t)['resolution_elapsed'] === 9000 && $t->sla_state['resolved_by'] === $member->id, 'Resolution records support time and actual resolver');
    $completedTarget = $t->sla_state['resolution_result']['target'];
    $sla->apply($t, $leader, 'leader', ['priority' => 'low', 'priority_reason' => 'Updated classification after resolution']);
    $assert($sla->snapshot($t)['resolution_target'] === 207000 && $sla->snapshot($t)['resolution_remaining'] === 198000 && $sla->snapshot($t)['resolution_elapsed'] === 9000, 'Completed resolution display follows newest priority rather than frozen completion target');
    $assert($t->sla_state['resolution_result']['target'] === $completedTarget, 'Historical completion target is preserved for audit');
    $sla->apply($t, $leader, 'leader', ['priority' => 'high', 'priority_reason' => 'Restore High classification']);
    try {
        $sla->apply($t, $member, 'member', ['status' => 'closed', 'note' => 'Close']);
        throw new RuntimeException('Member closure allowed');
    } catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
        $assert($e->getStatusCode() === 403, 'Only leaders may close tickets');
    }
    $sla->apply($t, $leader, 'leader', ['status' => 'closed', 'note' => 'Requester verified the printer']);
    $time('2026-10-28 08:00:00');
    $sla->apply($t, $member, 'member', ['status' => 'in_progress', 'note' => 'Issue returned']);
    $assert($t->closed_at === null && $sla->snapshot($t)['resolution_elapsed'] === 9000, 'Reopening excludes resolved and closed intervals');
    $time('2026-10-28 08:30:00');
    $assert($sla->snapshot($t)['resolution_elapsed'] === 10800 && $t->sla_state['reopen_count'] === 1, 'Original allowance resumes after reopening');

    $time('2026-10-27 08:00:00');
    $p1 = $makeTicket();
    $sla->apply($p1, $leader, 'leader', ['priority' => 'critical', 'priority_reason' => 'Branch connectivity outage']);
    $sla->apply($p1, $member, 'member', ['action' => 'acknowledge', 'assessment' => 'Primary ISP failed', 'next_steps' => 'Enable backup']);
    $time('2026-10-27 09:00:00');
    $workaround = ['action' => 'approve_workaround', 'workaround' => 'Backup internet active', 'recovery_plan' => 'ISP repair and monitoring'];
    try {
        $sla->apply($p1, $member, 'member', $workaround);
        throw new RuntimeException('Member workaround approval allowed');
    } catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
        $assert($e->getStatusCode() === 403, 'P1 workaround acceptance is leader-only');
    }
    $sla->apply($p1, $leader, 'leader', $workaround);
    $time('2026-10-27 14:00:00');
    $assert($sla->snapshot($p1)['resolution_status'] === 'Completed' && $p1->status !== 'closed'
        && $sla->snapshot($p1)['resolution_elapsed'] === 3600, 'Accepted P1 workaround satisfies SLA while permanent work stays open');
    $sla->apply($p1, $leader, 'leader', ['action' => 'reopen', 'note' => 'Backup workaround failed']);
    $assert(!$sla->snapshot($p1)['resolution_complete'] && $sla->snapshot($p1)['resolution_remaining'] === 10800,
        'Failed workaround resumes the original remaining allowance');

    $sla->apply($p1, $member, 'member', ['status' => 'resolved'] + $docs);
    $controller->update($request('tickets.update', $employee, ['action' => 'confirm']), $p1);
    $p1->refresh();
    $assert(!empty($p1->sla_state['confirmed_at']) && $p1->status === 'resolved', 'Requester confirmation records verification without automatic closure');
    $sla->apply($p1, $leader, 'leader', ['status' => 'closed', 'note' => 'Verified and ready for optional feedback']);
    $controller->update($request('tickets.update', $employee, ['action' => 'feedback', 'rating' => '4']), $p1);
    $feedback = $p1->activities()->where('type', 'feedback')->firstOrFail();
    $assert($feedback->details['rating'] === 4 && $feedback->actor_id === $employee->id
        && $p1->fresh()->status === 'closed', 'Requester can submit a rating without a comment and ticket status is unchanged');
    $controller->update($request('tickets.update', $employee, ['action' => 'feedback', 'rating' => 5, 'note' => 'Helpful updates']), $p1);
    $assert($p1->activities()->where('type', 'feedback')->count() === 1 && $p1->activities()->where('type', 'feedback')->first()->details['rating'] === 4, 'Repeated feedback cannot overwrite the original rating');
    try {
        $controller->update($request('tickets.update', $employee, ['action' => 'feedback', 'rating' => 6]), $p1);
        throw new RuntimeException('Invalid feedback rating accepted');
    } catch (\Illuminate\Validation\ValidationException $e) {
        $assert(isset($e->errors()['rating']), 'Feedback rating must remain between 1 and 5');
    }
    try {
        $controller->update($request('tickets.update', $member, ['action' => 'feedback', 'rating' => 5]), $p1);
        throw new RuntimeException('Non-requester feedback accepted');
    } catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
        $assert($e->getStatusCode() === 403, 'Only the requester can submit ticket feedback');
    }

    $time('2026-10-27 08:00:00');
    $warning = $makeTicket();
    $sla->apply($warning, $leader, 'leader', ['priority' => 'critical', 'priority_reason' => 'Critical incident']);
    $sla->apply($warning, $member, 'member', ['action' => 'acknowledge', 'assessment' => 'Investigating', 'next_steps' => 'Check service']);
    $time('2026-10-27 11:12:00');
    $sla->check($warning);
    $sla->check($warning);
    $assert($warning->activities()->where('type', 'sla_alert')->where('details->key', 'warning:critical:0')->count() === 1,
        '20%-remaining warning is emitted exactly once per priority/reopen cycle');
    Notification::assertSentTo($member, \App\Notifications\TicketNotification::class);
    Notification::assertSentTo($leader, \App\Notifications\TicketNotification::class);
    $time('2026-10-27 12:01:00');
    $sla->check($warning);
    $assert($warning->sla_state['resolution_ever_breached'] === true, 'Breach history persists beyond deadline');
    $legacy = new Ticket;
    $assert($sla->snapshot($legacy)['enabled'] === false, 'Existing tickets are excluded');
    echo "All SLA integration checks passed. Writes rolled back and notifications faked.\n";
} catch (Throwable $e) {
    fwrite(STDERR, get_class($e).': '.$e->getMessage()."\n".$e->getTraceAsString()."\n");
    $failed = true;
} finally {
    DB::rollBack();
    Carbon::setTestNow();
    CarbonImmutable::setTestNow();
}
exit($failed ? 1 : 0);
