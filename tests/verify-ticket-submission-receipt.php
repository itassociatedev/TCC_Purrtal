<?php
// Integration checks roll back all tickets and fake notifications.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\{Ticket, User};
use App\Services\TicketAccess;
use Illuminate\Support\Facades\{DB, Notification};
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
Notification::fake();
DB::beginTransaction();
try {
    $actors = User::with(['role', 'department'])->whereNotNull('department_id')->whereNotNull('branch_id')->get();
    $employee = $actors->first(fn ($u) => TicketAccess::role($u) === 'employee');
    $member = $actors->first(fn ($u) => TicketAccess::role($u) === 'member');
    if (!$employee || !$member) throw new RuntimeException('Employee and IT member fixtures required');
    $send = function ($actor, $data) use ($app) {
        $request = Request::create('/tickets', 'POST', $data);
        $request->setUserResolver(fn () => $actor);
        $request->setLaravelSession($app['session']->driver());
        return app(App\Http\Controllers\TicketController::class)->store($request);
    };
    $check = function ($ok, $message) { if (!$ok) throw new RuntimeException($message); echo 'PASS: '.$message.PHP_EOL; };
    $payload = ['branch_id' => $employee->branch_id, 'subject' => 'Receipt verification '.bin2hex(random_bytes(8)),
        'description' => 'Temporary receipt check', 'category' => config('ticketing.categories')[0],
        'priority' => 'low', 'reporting_channel' => 'portal', 'affected_asset' => 'Workstation', 'operational_impact' => 'Testing'];
    session()->forget('tickets.submission_acknowledgement');
    try { $send($employee, [...$payload, 'subject' => '']); throw new RuntimeException('Invalid submission accepted'); }
    catch (ValidationException $e) { $check(!session()->has('tickets.submission_acknowledgement'), 'Failed submission does not create receipt'); }
    $send($employee, $payload);
    $receipt = session()->pull('tickets.submission_acknowledgement');
    $ticket = Ticket::findOrFail($receipt['id']);
    $check($receipt['subject'] === $payload['subject'] && $receipt['code'] === $ticket->ticket_code, 'Non-IT submission receives matching ticket subject and code');
    $check(empty($ticket->sla_state['acknowledged_at']) && $ticket->status === 'not_started', 'Receipt does not acknowledge SLA or change ticket status');
    $send($member, [...$payload, 'branch_id' => $member->branch_id, 'subject' => 'IT receipt exclusion', 'reporting_channel' => 'email', 'emergency_reason' => 'Testing']);
    $check(!session()->has('tickets.submission_acknowledgement'), 'IT submission does not create popup receipt');
} finally { DB::rollBack(); session()->forget('tickets.submission_acknowledgement'); }
