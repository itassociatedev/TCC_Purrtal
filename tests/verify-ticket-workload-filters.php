<?php
// Real query/controller coverage with rolled-back fixtures and suppressed notifications.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\Ticket;
use App\Services\TicketAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Notification, Route};
use Illuminate\Validation\ValidationException;
Notification::fake(); DB::beginTransaction();
try {
    $roster = TicketAccess::members(false)->with('role')->get();
    $leader = $roster->first(fn ($u) => TicketAccess::role($u) === 'leader');
    $member = $roster->first(fn ($u) => TicketAccess::role($u) === 'member');
    if (!$leader || !$member) throw new RuntimeException('Supervisor/member fixtures required');
    $tag = 'workload-filter-'.bin2hex(random_bytes(6));
    $source = Ticket::where('is_preview', false)->firstOrFail();
    $make = function ($status, $owner, $resolver) use ($source, $tag) {
        $ticket = $source->replicate(); $ticket->subject = $tag; $ticket->status = $status;
        $ticket->assigned_to = $owner; $ticket->sla_state = ['resolved_by' => $resolver]; $ticket->save(); return $ticket;
    };
    $assigned = $make('in_progress', $member->id, null);
    $resolved = $make('resolved', $leader->id, $member->id);
    $closed = $make('closed', $leader->id, $member->id);
    $make('resolved', $member->id, $leader->id);
    // Legacy records may store an explicit JSON null and multiple resolution cycles.
    $legacy = $make('resolved', $leader->id, null);
    foreach ([$leader->id, $member->id] as $resolver) {
        $legacy->activities()->create(['actor_id' => $resolver, 'type' => 'resolved', 'message' => 'Legacy resolution', 'created_at' => now()]);
    }
    $props = function ($actor, array $filters) use ($app, $tag) {
        $r = Request::create('/tickets/all', 'GET', ['search' => $tag, 'per_page' => 'all', ...$filters]);
        $r->headers->set('X-Inertia', 'true'); $r->setUserResolver(fn () => $actor);
        $r->setLaravelSession($app['session']->driver());
        $r->setRouteResolver(fn () => Route::getRoutes()->getByName('tickets.all'));
        return app(App\Http\Controllers\TicketController::class)->index($r)->toResponse($r)->getData(true)['props'];
    };
    $check = function ($ok, $message) { if (!$ok) throw new RuntimeException($message); echo 'PASS: '.$message.PHP_EOL; };
    $default = $props($leader, ['sort' => '', 'direction' => '']);
    $check($default['filters']['sort'] === 'created_at' && $default['filters']['direction'] === 'desc' && !$default['filters']['sort_active'], 'Blank sort restores newest-first default with inactive header cycle');
    $explicit = $props($leader, ['sort' => 'subject', 'direction' => 'asc']);
    $check($explicit['filters']['sort_active'] && $explicit['filters']['sort'] === 'subject', 'Explicit sort is distinguished from default order');
    $result = $props($leader, ['resolver_filter' => $member->id]);
    $ids = array_column($result['tickets']['data'], 'id'); sort($ids); $expected = [$resolved->id, $closed->id, $legacy->id]; sort($expected);
    $check($ids === $expected, 'Resolver filter follows actual resolver after reassignment and includes closed tickets');
    $filtered = $props($leader, ['resolver_filter' => $member->id, 'status_filter' => 'closed']);
    $check(count($filtered['tickets']['data']) === 1, 'Closed-only filter excludes the resolved ticket, reproducing the reported mismatch');
    $check((int) $result['filters']['resolver_filter'] === $member->id, 'Resolver selection returned to UI');
    $result = $props($leader, ['assignee_filter' => $member->id]);
    $check(count($result['tickets']['data']) === 2, 'Assigned selection follows current owner');
    $result = $props($leader, ['resolver_filter' => $member->id, 'status_filter' => 'in_progress']);
    $check(count($result['tickets']['data']) === 0, 'Workload selection combines with existing status/search filters');
    $result = $props($leader, ['status_filter' => 'in_progress', 'selected_ticket' => $closed->id]);
    $check($result['selectedTicket']['id'] === $closed->id && isset($result['selectedTicket']['sla']), 'Notification detail opens independently of table filters with SLA and history');
    $employee = App\Models\User::with('role')->get()->first(fn ($u) => TicketAccess::role($u) === 'employee' && $u->id !== $closed->creator_id);
    if (!$employee) throw new RuntimeException('Unrelated employee fixture required');
    try { $props($employee, ['selected_ticket' => $closed->id]); throw new RuntimeException('Foreign ticket exposed'); }
    catch (Illuminate\Database\Eloquent\ModelNotFoundException $e) { $check(true, 'Employee cannot deep-link another employee ticket'); }
    try { $props($leader, ['selected_ticket' => 2147483647]); throw new RuntimeException('Missing ticket accepted'); }
    catch (Illuminate\Database\Eloquent\ModelNotFoundException $e) { $check(true, 'Missing notification ticket returns not found'); }
    $payload = (new App\Notifications\TicketNotification($closed->id, 'Closed'))->toArray($leader);
    $check($payload['action_url'] === route('tickets.all', ['selected_ticket' => $closed->id]), 'New notification URL selects the exact ticket');
    try { $props($member, ['resolver_filter' => $member->id]); throw new RuntimeException('Member resolver filter permitted'); }
    catch (ValidationException $e) { $check(isset($e->errors()['resolver_filter']), 'Supervisor-only resolver filter enforced'); }
} finally { DB::rollBack(); }
