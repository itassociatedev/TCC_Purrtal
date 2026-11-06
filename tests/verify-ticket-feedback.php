<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\{Ticket, User};
use App\Services\TicketAccess;
use App\Http\Controllers\TicketController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Auth, Route, Notification};
$check = function ($ok, $message) { if (!$ok) throw new RuntimeException($message); echo "PASS: {$message}\n"; };
$users = User::whereIn('id', DB::table('ticket_preview_users')->select('user_id'))->with('role')->get();
$employee = $users->first(fn ($u) => TicketAccess::role($u) === 'employee');
$member = $users->first(fn ($u) => TicketAccess::role($u) === 'member');
$admin = User::with('role')->get()->first(fn ($u) => TicketAccess::canPreview($u));
Auth::setUser($admin); Notification::fake();
$request = function ($name, $actor, $input = []) use ($app, $admin) {
    $r = Request::create('/tickets/preview', 'GET', ['preview_user' => $actor->id] + $input);
    $r->setRouteResolver(fn () => Route::getRoutes()->getByName($name));
    $r->setUserResolver(fn () => $admin); $r->setLaravelSession($app['session']->driver()); $r->headers->set('X-Inertia', 'true');
    return $r;
};
$controller = app(TicketController::class);
DB::beginTransaction();
try {
    $sample = Ticket::where('is_preview', true)->firstOrFail();
    $tickets = [];
    foreach ([2, 1] as $days) {
        $t = $sample->replicate(); $t->creator_id = $employee->id; $t->status = 'closed'; $t->closed_at = now()->subDays($days);
        $t->sla_state = array_merge($t->sla_state ?? [], ['resolved_by' => $member->id]); $t->save(); $tickets[] = $t;
    }
    $req = $request('tickets.preview.index', $employee, ['view' => 'all', 'search' => 'no-match-feedback-queue']);
    $props = $controller->index($req)->toResponse($req)->getData(true)['props'];
    $ids = collect($props['pendingFeedback'])->pluck('id')->all();
    $check(in_array($tickets[0]->id, $ids) && in_array($tickets[1]->id, $ids) && array_search($tickets[0]->id, $ids) < array_search($tickets[1]->id, $ids), 'Closed tickets queue oldest first independently of filters');
    $controller->update($request('tickets.preview.update', $employee, ['action' => 'dismiss_feedback']), $tickets[0]);
    $check($tickets[0]->activities()->where('type', 'feedback_dismissed')->count() === 1 && !$tickets[0]->activities()->where('type', 'feedback')->exists(), 'Skipping records no fabricated rating');
    $controller->update($request('tickets.preview.update', $employee, ['action' => 'feedback', 'rating' => 2.5]), $tickets[1]);
    $controller->update($request('tickets.preview.update', $employee, ['action' => 'feedback', 'rating' => 5]), $tickets[1]);
    $event = $tickets[1]->activities()->where('type', 'feedback')->firstOrFail();
    $check($event->details['rating'] === 2.5 && $event->details['resolved_by'] === $member->id && $tickets[1]->activities()->where('type', 'feedback')->count() === 1, 'Low rating accepts optional blank comments, credits resolver, and rejects duplication');
    $req = $request('tickets.preview.index', $employee);
    $props = $controller->index($req)->toResponse($req)->getData(true)['props'];
    $check(!collect($props['pendingFeedback'])->pluck('id')->intersect(collect($tickets)->pluck('id'))->count(), 'Rated and dismissed tickets leave the queue');
    $tickets[1]->activities()->where('type', 'feedback')->delete();
    try { $controller->update($request('tickets.preview.update', $member, ['action' => 'feedback', 'rating' => 4]), $tickets[1]); throw new RuntimeException('Wrong requester rated ticket'); }
    catch (Symfony\Component\HttpKernel\Exception\HttpException $e) { $check($e->getStatusCode() === 403, 'Only the requester can rate a ticket'); }
    foreach ([0, 0.25, 3.7, 5.5] as $invalid) {
        try { $controller->update($request('tickets.preview.update', $employee, ['action' => 'feedback', 'rating' => $invalid]), $tickets[1]); throw new RuntimeException('Invalid star step accepted'); }
        catch (Illuminate\Validation\ValidationException $e) { $check(isset($e->errors()['rating']), 'Invalid half-star step is rejected'); }
    }
    $peer = $users->first(fn ($u) => TicketAccess::role($u) === 'member' && $u->id !== $member->id);
    $leader = $users->first(fn ($u) => TicketAccess::role($u) === 'leader');
    foreach ([[$member, $member, false], [$member, $peer, false], [$leader, $member, true]] as [$requester, $resolver, $allowed]) {
        $fixture = $sample->replicate(); $fixture->creator_id = $requester->id; $fixture->status = 'closed'; $fixture->closed_at = now();
        $fixture->sla_state = array_merge($fixture->sla_state ?? [], ['resolved_by' => $resolver->id]); $fixture->save();
        $req = $request('tickets.preview.index', $requester);
        $props = $controller->index($req)->toResponse($req)->getData(true)['props'];
        $check(collect($props['pendingFeedback'])->contains('id', $fixture->id) === $allowed, 'Queue follows self/peer/leader rating rules');
        try {
            $controller->update($request('tickets.preview.update', $requester, ['action' => 'feedback', 'rating' => 4.5]), $fixture);
            $check($allowed && $fixture->activities()->where('type', 'feedback')->value('actor_id') === $requester->id, 'Leader can rate an IT member on own closed ticket');
        } catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $check(!$allowed && $e->getStatusCode() === 403 && !$fixture->activities()->where('type', 'feedback')->exists(), 'Backend rejects self/peer rating without recording feedback');
        }
    }
    Notification::assertNothingSent();
    echo "Feedback queue checks passed. All writes rolled back.\n";
} finally { DB::rollBack(); }
