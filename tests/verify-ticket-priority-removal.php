<?php
// Roll back every priority/ticket fixture; fake notifications to avoid external effects.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\{Ticket, TicketPriority, User};
use App\Services\{TicketAccess, TicketPrioritySettings, TicketSla};
use Illuminate\Support\Facades\{DB, Notification, Route};
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
Notification::fake(); DB::beginTransaction();
try {
    $users = User::with('role')->get();
    $leader = $users->first(fn ($u) => TicketAccess::role($u) === 'leader');
    $controller = app(App\Http\Controllers\TicketPriorityController::class);
    $request = function ($actor, $data = []) use ($app) {
        $r = Request::create('/tickets/admin/priorities', 'POST', $data);
        $r->setUserResolver(fn () => $actor); $r->setLaravelSession($app['session']->driver()); return $r;
    };
    $check = function ($ok, $message) { if (!$ok) throw new RuntimeException($message); echo 'PASS: '.$message.PHP_EOL; };
    $make = function () {
        $key = 'removal_check_'.bin2hex(random_bytes(5));
        return TicketPriority::create(['key' => $key, 'label' => $key, 'response_seconds' => 600, 'resolution_seconds' => 3600, 'sort_order' => 100]);
    };
    $unused = $make();
    foreach (['member', 'employee'] as $role) {
        $actor = $users->first(fn ($u) => TicketAccess::role($u) === $role);
        foreach (['destroy', 'restore'] as $action) {
            try { $controller->$action($request($actor), $unused); throw new RuntimeException('Unauthorized removal/restore accepted'); }
            catch (HttpException $e) { $check($e->getStatusCode() === 403, $role.' cannot '.$action.' priorities'); }
        }
    }
    $controller->destroy($request($leader), $unused);
    $check(!TicketPriority::find($unused->id), 'Unused priority deleted');
    $used = $make();
    $ticket = Ticket::where('is_preview', false)->firstOrFail()->replicate();
    $ticket->status = 'in_progress'; $ticket->priority = $used->key; $ticket->assigned_to = $leader->id; $ticket->save();
    $sla = app(TicketSla::class); $sla->enroll($ticket, $leader, now());
    $before = $sla->snapshot($ticket); $policy = $ticket->sla_policy; $state = $ticket->sla_state;
    $controller->destroy($request($leader), $used);
    $check((bool) $used->fresh()->archived_at && $ticket->fresh()->priority === $used->key, 'Used priority archived without changing ticket');
    $check(isset(TicketPrioritySettings::labels()[$used->key]) && !isset(TicketPrioritySettings::labels(true)[$used->key]), 'Archived priority retained in historical labels but excluded from selections');
    $check(!isset(TicketPrioritySettings::policy()['targets'][$used->key]), 'New policy snapshots exclude archived priority');
    $check($ticket->fresh()->sla_policy === $policy && $ticket->fresh()->sla_state === $state && $sla->snapshot($ticket)['resolution_target'] === $before['resolution_target'], 'Archiving preserves saved policy, timer and SLA target');
    try { $sla->enroll($ticket, $leader, now()); throw new RuntimeException('Archived enrollment accepted'); }
    catch (ValidationException $e) { echo 'PASS: archived enrollment blocked at write boundary'.PHP_EOL; }
    $filter = $request($leader, ['priority_filter' => $used->key]);
    $filter->setRouteResolver(fn () => Route::getRoutes()->getByName('tickets.all'));
    app(App\Http\Controllers\TicketController::class)->index($filter);
    echo 'PASS: historical priority filter accepted'.PHP_EOL;
    $sla->apply($ticket, $leader, 'leader', ['priority' => TicketPrioritySettings::defaultKey(), 'priority_reason' => 'Classification review']);
    try { $sla->apply($ticket, $leader, 'leader', ['priority' => $used->key, 'priority_reason' => 'Must fail']); throw new RuntimeException('Archived classification accepted'); }
    catch (ValidationException $e) { echo 'PASS: assigning archived priority blocked'.PHP_EOL; }
    $controller->restore($request($leader), $used->fresh());
    $check(!$used->fresh()->archived_at && isset(TicketPrioritySettings::labels(true)[$used->key]), 'Archived priority restored with original key');
    $controller->destroy($request($leader), $used->fresh());
    $check((bool) $used->fresh()->archived_at, 'Historical priority-change reference prevents permanent deletion');
    // Even Low can be archived: blank imports fall back to another active priority.
    TicketPriority::where('key', 'low')->update(['archived_at' => now()]);
    $check(TicketPrioritySettings::defaultKey() !== 'low' && isset(TicketPrioritySettings::labels(true)[TicketPrioritySettings::defaultKey()]), 'Default chooses an active priority when Low is archived');
    $last = TicketPriority::whereNull('archived_at')->firstOrFail();
    TicketPriority::where('id', '!=', $last->id)->update(['archived_at' => now()]);
    try { $controller->destroy($request($leader), $last); throw new RuntimeException('Last active priority removed'); }
    catch (ValidationException $e) { $check(isset($e->errors()['removal']) && !$last->fresh()->archived_at, 'Last active priority cannot be removed'); }
} finally { DB::rollBack(); }
