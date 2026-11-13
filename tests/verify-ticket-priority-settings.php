<?php
// Installed-schema integration checks. All fixtures/settings roll back; no notifications leave the test.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\{Ticket, TicketPriority, User};
use App\Services\{TicketAccess, TicketPrioritySettings, TicketSla};
use Illuminate\Support\Facades\{DB, Notification};
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
Notification::fake(); DB::beginTransaction();
try {
    $users = User::with(['role', 'department'])->whereNotNull('department_id')->whereNotNull('branch_id')->get();
    $leader = $users->first(fn ($u) => TicketAccess::role($u) === 'leader');
    $employee = $users->first(fn ($u) => TicketAccess::role($u) === 'employee');
    $member = $users->first(fn ($u) => TicketAccess::role($u) === 'member');
    if (!$leader || !$employee || !$member) throw new RuntimeException('Role fixtures missing');
    $req = function ($actor, $data = []) use ($app) {
        $request = Request::create('/tickets', 'POST', $data);
        $request->setUserResolver(fn () => $actor); $request->setLaravelSession($app['session']->driver());
        return $request;
    };
    $check = function ($ok, $message) { if (!$ok) throw new RuntimeException($message); echo 'PASS: '.$message.PHP_EOL; };
    $controller = app(App\Http\Controllers\TicketPriorityController::class);
    $input = ['label' => 'Settings verification '.bin2hex(random_bytes(4)), 'response_hours' => 0.25, 'resolution_hours' => 0.5, 'update_hours' => '', 'sort_order' => 9];
    foreach ([$employee, $member] as $actor) {
        try { $controller->store($req($actor, $input)); throw new RuntimeException('Unauthorized settings accepted'); }
        catch (HttpException $e) { $check($e->getStatusCode() === 403, 'Non-supervisor cannot change global priorities'); }
        $read = $req($actor); $read->setRouteResolver(fn () => Illuminate\Support\Facades\Route::getRoutes()->getByName('tickets.admin.sla'));
        try { app(App\Http\Controllers\TicketController::class)->index($read); throw new RuntimeException('Unauthorized settings page'); }
        catch (HttpException $e) { $check($e->getStatusCode() === 403, 'Non-supervisor cannot view SLA admin page'); }
    }
    // Laravel normalizes blank optional fields to null at the HTTP middleware boundary.
    $input['update_hours'] = null;
    foreach ([['response_hours' => 0], ['resolution_hours' => 0.1], ['response_hours' => 'invalid'], ['response_hours' => 0.00000001]] as $invalid) {
        try { $controller->store($req($leader, array_merge($input, $invalid))); throw new RuntimeException('Invalid time accepted'); }
        catch (ValidationException $e) { echo 'PASS: invalid duration rejected'.PHP_EOL; }
    }
    $controller->store($req($leader, $input));
    $priority = TicketPriority::where('label', $input['label'])->firstOrFail();
    $key = $priority->key;
    $check(TicketPrioritySettings::targets()[$key]['response'] === 900 && TicketPrioritySettings::targets()[$key]['resolution'] === 1800, 'Custom priority stores fractional hour values as support seconds');
    try { $controller->store($req($leader, $input)); throw new RuntimeException('Duplicate priority accepted'); }
    catch (ValidationException $e) { echo 'PASS: duplicate priority rejected'.PHP_EOL; }
    $ticketInput = ['branch_id' => $employee->branch_id, 'subject' => 'Custom priority verification', 'description' => 'Rolled-back test', 'category' => config('ticketing.categories')[0],
        'priority' => $key, 'reporting_channel' => 'portal', 'affected_asset' => 'Workstation', 'operational_impact' => 'Testing'];
    app(App\Http\Controllers\TicketController::class)->store($req($employee, $ticketInput));
    $ticket = Ticket::where('subject', $ticketInput['subject'])->latest('id')->firstOrFail();
    $sla = app(TicketSla::class);
    $check($ticket->priority === $key && $sla->snapshot($ticket)['resolution_target'] === 1800, 'Ticket creation accepts and snapshots custom priority');
    $controller->update($req($leader, array_merge($input, ['resolution_hours' => 1, 'label' => $input['label'].' renamed'])), $priority);
    $ticket->refresh();
    $check($sla->snapshot($ticket)['resolution_target'] === 1800 && $priority->fresh()->key === $key, 'Settings edit preserves existing ticket target and immutable priority key');
    $state = $ticket->sla_state; $state['elapsed'] = 180; $state['running_since'] = null; $ticket->sla_state = $state; $ticket->save();
    $sla->apply($ticket, $leader, 'leader', ['priority' => 'low', 'priority_reason' => 'Verification']);
    $sla->apply($ticket, $leader, 'leader', ['priority' => $key, 'priority_reason' => 'Verification']);
    $check($sla->snapshot($ticket)['resolution_target'] === 3600 && $sla->snapshot($ticket)['resolution_elapsed'] === 180, 'Changing priority adopts newest target without resetting elapsed time');
    $sla->apply($ticket, $leader, 'leader', ['action' => 'acknowledge', 'assessment' => 'Verified', 'next_steps' => 'Resolve']);
    $sla->apply($ticket, $leader, 'leader', ['status' => 'resolved', 'findings' => 'Test', 'resolution_details' => 'Verified']);
    $sla->apply($ticket, $leader, 'leader', ['priority' => 'critical', 'priority_reason' => 'Post-resolution review']);
    $check($sla->snapshot($ticket)['resolution_target'] === 3600 && $sla->snapshot($ticket)['resolution_status'] === 'Completed', 'Completed resolution result survives later priority changes');
    $check(array_key_exists($key, TicketPrioritySettings::labels()), 'Custom label is available to all dropdown/filter consumers');
    $filterRequest = $req($employee, ['priority_filter' => $key, 'sort' => 'priority']);
    $filterRequest->setRouteResolver(fn () => Illuminate\Support\Facades\Route::getRoutes()->getByName('tickets.all'));
    app(App\Http\Controllers\TicketController::class)->index($filterRequest);
    echo 'PASS: custom priority accepted by ticket filters and database sorting'.PHP_EOL;
    $importRows = app(App\Services\TicketWorkbook::class)->validateRows([[$employee->id, $employee->branch->name, 'Import priority check', config('ticketing.categories')[0],
        TicketPrioritySettings::labels()[$key], $employee->department->name, 'PC', 'Issue', 'Impact', '']], DB::table('ticket_preview_users')->where('user_id', $employee->id)->exists());
    $check($importRows[0]['priority'] === $key, 'XLSX import accepts current custom priority label');
} finally { DB::rollBack(); session()->forget('tickets.submission_acknowledgement'); }
