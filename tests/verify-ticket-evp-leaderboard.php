<?php
// Installed-schema permission regression. Fixtures roll back; no live messages are sent.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\{User, Role, Ticket};
use App\Services\TicketAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Notification, Route};
use Symfony\Component\HttpKernel\Exception\HttpException;
Notification::fake(); DB::beginTransaction();
try {
    $role = Role::where('name', 'Executive Vice President')->firstOrFail();
    $evp = User::firstOrFail()->replicate(); $evp->role_id = $role->id;
    $evp->position_id = null;
    $evp->email = 'evp-check-'.bin2hex(random_bytes(8)).'@example.invalid'; $evp->status = 'Active'; $evp->save();
    $evp->load('role');
    $controller = app(App\Http\Controllers\TicketController::class);
    $request = function ($actor, $route, $data = []) use ($app) {
        $r = Request::create('/tickets', 'GET', $data); $r->headers->set('X-Inertia', 'true');
        $r->setUserResolver(fn () => $actor); $r->setLaravelSession($app['session']->driver());
        $r->setRouteResolver(fn () => Route::getRoutes()->getByName($route)); return $r;
    };
    $page = function ($actor, $route, $data = []) use ($controller, $request) {
        $r = $request($actor, $route, $data); return $controller->index($r)->toResponse($r)->getData(true)['props'];
    };
    $check = function ($ok, $message) { if (!$ok) throw new RuntimeException($message); echo 'PASS: '.$message.PHP_EOL; };
    $check(TicketAccess::role($evp) === 'employee' && TicketAccess::canViewLeaderboard($evp), 'EVP gains leaderboard visibility without IT role elevation');
    foreach (['all', 'week'] as $period) {
        $props = $page($evp, 'tickets.leaderboard', ['leaderboard_period' => $period]);
        $check($props['canViewLeaderboard'] && $props['leaderboard']['period'] === $period, 'EVP can view leaderboard period '.$period);
    }
    $member = TicketAccess::members(false)->firstOrFail();
    foreach (['resolved', 'overdue', 'ratings'] as $detail) {
        $props = $page($evp, 'tickets.leaderboard', ['leaderboard_member' => $member->id, 'leaderboard_detail' => $detail]);
        $check($props['leaderboard']['detail']['type'] === $detail, 'EVP can view '.$detail.' drill-down');
    }
    $props = $page($evp, 'tickets.all');
    $check(count($props['tickets']['data']) === 0, 'EVP normal ticket list remains creator-scoped');
    foreach (['tickets.admin', 'tickets.assigned', 'tickets.export'] as $route) {
        try { $page($evp, $route, ['view' => 'leaderboard']); throw new RuntimeException('Forbidden route allowed: '.$route); }
        catch (HttpException $e) { $check($e->getStatusCode() === 403, 'EVP denied '.$route); }
    }
    $ticket = Ticket::where('is_preview', false)->firstOrFail();
    try { $controller->update($request($evp, 'tickets.update', ['action' => 'save']), $ticket); throw new RuntimeException('Management allowed'); }
    catch (HttpException $e) { $check($e->getStatusCode() === 403, 'EVP cannot manage tickets'); }
    $employee = User::with('role')->get()->first(fn ($u) => TicketAccess::role($u) === 'employee' && !TicketAccess::canViewLeaderboard($u));
    if (!$employee) throw new RuntimeException('Ordinary employee fixture missing');
    foreach ([$employee, $member] as $actor) {
        if (TicketAccess::role($actor) === 'leader') continue;
        try { $page($actor, 'tickets.leaderboard'); throw new RuntimeException('Unprivileged leaderboard access'); }
        catch (HttpException $e) { $check($e->getStatusCode() === 403, 'Other non-supervisor roles remain denied'); }
    }
} finally { DB::rollBack(); }
