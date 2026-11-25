<?php
// Exercise soft deletion and page props without retaining fixtures or sending notices.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\{TicketLocation, Ticket, Branch};
use App\Services\TicketAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Notification, Route};
use Symfony\Component\HttpKernel\Exception\HttpException;
Notification::fake(); DB::beginTransaction();
try {
    $users = TicketAccess::members()->where('status', 'Active')->get();
    $leader = $users->first(fn ($u) => TicketAccess::role($u) === 'leader');
    $member = $users->first(fn ($u) => TicketAccess::role($u) === 'member');
    if (!$leader || !$member) throw new RuntimeException('Supervisor and member fixtures required');
    $request = function ($name, $actor, array $data = []) use ($app) {
        $r = Request::create('/tickets', 'GET', $data); $r->headers->set('X-Inertia', 'true');
        $r->setUserResolver(fn () => $actor); $r->setRouteResolver(fn () => Route::getRoutes()->getByName($name));
        $r->setLaravelSession($app['session']->driver()); return $r;
    };
    $controller = app(App\Http\Controllers\TicketController::class);
    $page = function ($name, array $data = []) use ($request, $leader, $controller) {
        $r = $request($name, $leader, $data); return $controller->index($r)->toResponse($r)->getData(true)['props'];
    };
    $check = function ($ok, $message) { if (!$ok) throw new RuntimeException($message); echo 'PASS: '.$message.PHP_EOL; };
    do { $code = strtoupper(substr(bin2hex(random_bytes(2)), 0, 3)); } while (TicketLocation::withTrashed()->where('code', $code)->exists());
    $location = TicketLocation::create(['name' => 'Location removal '.bin2hex(random_bytes(6)), 'code' => $code]);
    $ticket = Ticket::where('is_preview', false)->firstOrFail()->replicate();
    $ticket->ticket_location_id = $location->id; $ticket->branch_id = null; $ticket->save();
    $branchCount = Branch::count();
    $before = $page('tickets.admin.locations');
    $check(collect($before['ticketLocations'])->contains('id', $location->id), 'Active location appears in admin list');
    $check(($before['branchCodes']['makati'] ?? null) === 'MKT', 'Dedicated location page retains built-in branch codes');
    try { $controller->destroyLocation($request('tickets.locations.destroy', $member), $location); throw new RuntimeException('Member removal allowed'); }
    catch (HttpException $e) { $check($e->getStatusCode() === 403, 'IT member cannot remove locations'); }
    $response = $controller->destroyLocation($request('tickets.locations.destroy', $leader), $location);
    $check($response->getTargetUrl() === route('tickets.admin.locations'), 'Removal redirects to the dedicated location page');
    foreach (['tickets.admin.locations', 'tickets.admin', 'tickets.create'] as $route) {
        $props = $page($route);
        $check(!collect($props['ticketLocations'])->contains('id', $location->id), 'Retired location absent from '.$route);
    }
    $check(TicketLocation::withTrashed()->findOrFail($location->id)->trashed(), 'Location is retired rather than permanently deleted');
    $check($ticket->fresh()->ticketLocation->name === $location->name, 'Existing ticket retains its location name');
    $historical = $page('tickets.all', ['location_filter' => $location->id]);
    $check(collect($historical['ticketLocations'])->contains('id', $location->id) && collect($historical['tickets']['data'])->contains('id', $ticket->id), 'Historical location filter remains usable');
    $check(Branch::count() === $branchCount, 'Clinic branch directory unchanged');
} finally { DB::rollBack(); }
