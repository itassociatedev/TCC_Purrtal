<?php
// Route matching only: does not authenticate, write data or dispatch controllers.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\{NotFoundHttpException, MethodNotAllowedHttpException};
$routes = Route::getRoutes();
foreach (['/ticket/hello', '/tickets/hello', '/tickets/r', '/tickets/admin/hello', '/tickets/admin/priorities/r', '/tickets/revisions/r', '/tickets/locations/r', '/tickets/hello/nested'] as $path) {
    try { $routes->match(Request::create($path, 'GET')); throw new RuntimeException('Invalid page matched: '.$path); }
    catch (NotFoundHttpException $e) { echo 'PASS: GET '.$path.' returns 404'.PHP_EOL; }
}
foreach ([['GET','/tickets/dashboard','tickets.dashboard'], ['GET','/tickets/admin/sla','tickets.admin.sla'],
    ['PATCH','/tickets/123','tickets.update'], ['PATCH','/tickets/123/handover-assignment','tickets.handover.assign'],
    ['PATCH','/tickets/revisions/123','tickets.revisions.update'], ['DELETE','/tickets/locations/123','tickets.locations.destroy'],
    ['PATCH','/tickets/admin/priorities/123','tickets.priorities.update'], ['DELETE','/tickets/admin/priorities/123','tickets.priorities.destroy'],
    ['POST','/tickets/admin/priorities/123/restore','tickets.priorities.restore']] as [$method,$path,$name]) {
    $route=$routes->match(Request::create($path,$method));
    if ($route->getName() !== $name) throw new RuntimeException('Wrong route '.$path);
    echo 'PASS: '.$method.' '.$path.' retains '.$name.PHP_EOL;
}
try { $routes->match(Request::create('/tickets/123', 'GET')); throw new RuntimeException('Wrong method accepted on numeric update endpoint'); }
catch (MethodNotAllowedHttpException $e) { echo 'PASS: genuine wrong-method requests retain 405'.PHP_EOL; }
