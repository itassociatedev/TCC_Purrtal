<?php
// Permission regression: no permanent fixtures or outgoing notifications.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\{Ticket, User};
use App\Services\{TicketAccess, TicketSla};
use Illuminate\Support\Facades\{DB, Notification, Route};
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
Notification::fake(); DB::beginTransaction();
try {
    $users = User::with('role')->get(); $sla = app(TicketSla::class);
    $source = Ticket::where('is_preview', false)->firstOrFail();
    $ticket = $source->replicate(); $ticket->status = 'in_progress'; $ticket->save();
    $check = function ($ok, $message) { if (!$ok) throw new RuntimeException($message); echo 'PASS: '.$message.PHP_EOL; };
    foreach (['leader', 'member', 'employee'] as $role) {
        $actor = $users->first(fn ($u) => TicketAccess::role($u) === $role);
        if (!$actor) throw new RuntimeException('Role fixture missing');
        $ticket->assigned_to = $actor->id; $ticket->save(); $sla->enroll($ticket, $actor, now());
        $state = $ticket->sla_state; $count = $ticket->activities()->count();
        try { $sla->apply($ticket, $actor, $role, ['action' => 'pause', 'pause_reason' => 'vendor', 'note' => 'Must fail']); throw new RuntimeException('Service allowed pause'); }
        catch (ValidationException $e) { $check($ticket->fresh()->sla_state === $state && $ticket->activities()->count() === $count, $role.' service pause denied without state/history changes'); }
        $request = Request::create('/tickets/'.$ticket->id, 'PATCH', ['action' => 'pause', 'pause_reason' => 'vendor', 'note' => 'Must fail']);
        $request->setUserResolver(fn () => $actor); $request->setLaravelSession($app['session']->driver());
        $request->setRouteResolver(fn () => Route::getRoutes()->getByName('tickets.update'));
        try { app(App\Http\Controllers\TicketController::class)->update($request, $ticket); throw new RuntimeException('Controller allowed pause'); }
        catch (ValidationException $e) { echo 'PASS: '.$role.' HTTP pause rejected'.PHP_EOL; }
        catch (HttpException $e) { $check($e->getStatusCode() === 403, $role.' cannot manage timer'); }
    }
    $actor = $users->first(fn ($u) => TicketAccess::role($u) === 'member');
    $state = $ticket->sla_state; $state['elapsed'] = 300; $state['running_since'] = null; $state['paused_at'] = now()->subHour()->toIso8601String(); $state['pause_reason'] = 'vendor';
    $ticket->assigned_to = $actor->id; $ticket->sla_state = $state; $ticket->save();
    $sla->apply($ticket, $actor, 'member', ['action' => 'resume', 'note' => 'Resume historical pause']);
    $check(!$ticket->sla_state['paused_at'] && $ticket->sla_state['running_since'] && $ticket->sla_state['elapsed'] === 300, 'Existing paused ticket can resume without resetting elapsed time');
} finally { DB::rollBack(); }
