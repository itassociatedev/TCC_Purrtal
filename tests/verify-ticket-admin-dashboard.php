<?php
// Read-only page/authorization checks; no controllers that mutate data are dispatched.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\User;
use App\Services\TicketAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\HttpException;
$users = User::with('role')->get();
$controller = app(App\Http\Controllers\TicketController::class);
foreach (['leader','member','employee'] as $role) {
    $actor = $users->first(fn ($u) => TicketAccess::role($u) === $role);
    if (!$actor) throw new RuntimeException('Missing role fixture');
    foreach (['tickets.admin'=>'admin','tickets.admin.locations'=>'locations','tickets.admin.handover'=>'handover','tickets.admin.sla'=>'sla_settings'] as $name=>$view) {
        $route = Route::getRoutes()->getByName($name);
        $r = Request::create('/'.$route->uri(), 'GET');
        $r->headers->set('X-Inertia','true');
        $r->setUserResolver(fn () => $actor); $r->setLaravelSession($app['session']->driver());
        $r->setRouteResolver(fn () => $route);
        try {
            $response=$controller->index($r);
            if ($role !== 'leader') throw new RuntimeException('Unauthorized admin access');
            $props=$response->toResponse($r)->getData(true)['props'];
            if ($props['filters']['view'] !== $view) throw new RuntimeException('Wrong admin page');
            echo 'PASS: supervisor can open '.$name.' as '.$view.PHP_EOL;
        } catch (HttpException $e) {
            if ($role === 'leader' || $e->getStatusCode() !== 403) throw $e;
            echo 'PASS: '.$role.' denied '.$name.PHP_EOL;
        }
    }
}
$r=Request::create('/tickets/locations','GET');
$r->setUserResolver(fn () => $users->first(fn ($u) => TicketAccess::role($u) === 'leader'));
$r->setLaravelSession($app['session']->driver());
$r->setRouteResolver(fn () => Route::getRoutes()->getByName('tickets.locations'));
if ($controller->index($r)->getTargetUrl() !== route('tickets.admin.locations')) throw new RuntimeException('Legacy location bookmark does not redirect');
echo 'PASS: legacy location bookmark redirects to dedicated locations page'.PHP_EOL;
