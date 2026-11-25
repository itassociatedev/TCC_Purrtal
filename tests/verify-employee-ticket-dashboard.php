<?php

// Runs against the configured local database without persisting any test writes.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Http\Controllers\TicketController;
use App\Models\{Branch, Ticket, User};
use App\Services\TicketAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{Auth, DB, Route};

$check = function ($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
    echo "PASS: {$message}\n";
};
// Read-only checks: inspect real controller props without creating or changing tickets.
$request = function ($actor, $input) use ($app) {
    $req = Request::create('/tickets/preview', 'GET', $input);
    $req->setRouteResolver(fn () => Route::getRoutes()->getByName('tickets.preview.index'));
    $req->setUserResolver(fn () => $actor);
    $req->setLaravelSession($app['session']->driver());
    $req->headers->set('X-Inertia', 'true');
    return $req;
};
$admin = User::with('role')->get()->first(fn ($u) => TicketAccess::canPreview($u));
Auth::setUser($admin);
$users = User::whereIn('id', DB::table('ticket_preview_users')->select('user_id'))->with('role')->get();
foreach ($users->filter(fn ($u) => TicketAccess::role($u) === 'employee')->take(2) as $employee) {
    $req = $request($admin, ['preview_user' => $employee->id]);
    $props = app(TicketController::class)->index($req)->toResponse($req)->getData(true)['props'];
    $own = Ticket::where('is_preview', true)->where('creator_id', $employee->id);
    $summary = $props['employeeSummary'];
    $check($props['filters']['view'] === 'dashboard', 'Employee lands on dashboard');
    $check($summary['total'] === (clone $own)->count(), 'Summary includes only employee preview tickets');
    foreach (['closed', 'not_started', 'in_progress', 'resolved'] as $status) {
        $check($summary[$status] === (clone $own)->where('status', $status)->count(), "Correct {$status} count");
    }
    $check($summary['open'] === $summary['not_started'] + $summary['in_progress'] + $summary['resolved'], 'Open includes all tickets awaiting closure');
    $req = $request($admin, ['preview_user' => $employee->id, 'view' => 'closed', 'search' => 'no-matching-subject-dashboard-check']);
    $filtered = app(TicketController::class)->index($req)->toResponse($req)->getData(true)['props'];
    $check($filtered['employeeSummary'] === $summary, 'Table filters do not change summary totals');
}
$member = $users->first(fn ($u) => TicketAccess::role($u) === 'member');
$req = $request($admin, ['preview_user' => $member->id]);
$props = app(TicketController::class)->index($req)->toResponse($req)->getData(true)['props'];
$check($props['employeeSummary'] === null && $props['filters']['view'] === 'dashboard', 'IT member lands on own dashboard');
$assigned = Ticket::where('is_preview', true)->where('assigned_to', $member->id);
$check($props['memberSummary']['total'] === (clone $assigned)->count(), 'Member summary includes only current preview assignments');
foreach (['closed', 'not_started', 'in_progress', 'resolved'] as $status) {
    $check($props['memberSummary'][$status] === (clone $assigned)->where('status', $status)->count(), "Correct member {$status} count");
}
$check($props['memberSummary']['open'] === (clone $assigned)->where('status', '!=', 'closed')->count(), 'Member open count includes tickets awaiting closure');
foreach (['assigned', 'all'] as $view) {
    $req = $request($admin, ['preview_user' => $member->id, 'view' => $view]);
    $list = app(TicketController::class)->index($req)->toResponse($req)->getData(true)['props'];
    $check($list['memberSummary'] === $props['memberSummary'], "Member summary independent of {$view} table");
}

$leader = $users->first(fn ($u) => TicketAccess::role($u) === 'leader');
$req = $request($admin, ['preview_user' => $leader->id]);
$leaderProps = app(TicketController::class)->index($req)->toResponse($req)->getData(true)['props'];
$check($leaderProps['filters']['view'] === 'dashboard', 'Leader lands on team dashboard');
$check($leaderProps['leaderSummary']['total'] === Ticket::where('is_preview', true)->count(), 'Leader summary covers team preview tickets only');
$memberWorkload = collect($leaderProps['memberWorkloads'])->firstWhere('id', $member->id);
$check($props['memberRating']['count'] === $memberWorkload['rating_count'] && $props['memberRating']['average'] === $memberWorkload['rating_average'], 'Personal rating matches resolver rating in leadership report');
$check($leaderProps['memberRating'] === null && $leaderProps['employeeSummary'] === null, 'Leader response keeps role-specific data separate');
// Dashboard drill-down counts must match the summary, across the whole result set.
foreach (collect([$users->first(fn ($u) => TicketAccess::role($u) === 'employee'), $member, $leader]) as $actor) {
    $isMember = TicketAccess::role($actor) === 'member';
    $base = ['preview_user' => $actor->id, 'view' => $isMember ? 'assigned' : 'all', 'per_page' => 'all'];
    $req = $request($admin, $base);
    $data = app(TicketController::class)->index($req)->toResponse($req)->getData(true)['props'];
    $summary = $data[TicketAccess::role($actor) === 'leader' ? 'leaderSummary' : ($isMember ? 'memberSummary' : 'employeeSummary')];
    foreach (['all', 'open', 'closed', 'not_started', 'in_progress', 'resolved'] as $filter) {
        $req = $request($admin, $base + ['status_filter' => $filter]);
        $filtered = app(TicketController::class)->index($req)->toResponse($req)->getData(true)['props'];
        $expectedFilter = TicketAccess::role($actor) === 'employee' && $filter === 'resolved' ? 'open' : $filter;
        $check($filtered['filters']['status_filter'] === $expectedFilter && $filtered['tickets']['total'] === $summary[$expectedFilter === 'all' ? 'total' : $expectedFilter], "Dashboard {$filter} filter matches the available status and summary for {$actor->id}");
        $check(collect($filtered['tickets']['data'])->every(fn ($ticket) => $ticket['is_preview'] && (TicketAccess::role($actor) === 'leader' || $ticket[$isMember ? 'assigned_to' : 'creator_id'] === $actor->id)), 'Status filter preserves identity and preview scope');
    }
}
// Inclusive creation dates, either single bound, and the original role scope.
foreach ([$users->first(fn ($u) => TicketAccess::role($u) === 'employee'), $member, $leader] as $actor) {
    $role = TicketAccess::role($actor);
    $own = Ticket::where('is_preview', true);
    if ($role === 'employee') $own->where('creator_id', $actor->id);
    if ($role === 'member') $own->where('assigned_to', $actor->id);
    $sample = (clone $own)->first();
    $day = $sample ? $sample->created_at->format('Y-m-d') : '2026-10-29';
    foreach ([['date_from' => $day, 'date_to' => $day], ['date_from' => $day], ['date_to' => $day]] as $dates) {
        $expected = clone $own;
        if (isset($dates['date_from'])) $expected->whereDate('created_at', '>=', $day);
        if (isset($dates['date_to'])) $expected->whereDate('created_at', '<=', $day);
        $req = $request($admin, ['preview_user' => $actor->id, 'view' => $role === 'member' ? 'assigned' : 'all'] + $dates);
        $result = app(TicketController::class)->index($req)->toResponse($req)->getData(true)['props'];
        $check($result['tickets']['total'] === $expected->count(), "Date bounds match inclusive scoped count for {$role}");
    }
}
foreach ([['date_from' => 'not-a-date'], ['date_from' => '2026-10-29', 'date_to' => '2026-10-01']] as $dates) {
    try {
        $req = $request($admin, ['preview_user' => $leader->id, 'view' => 'all'] + $dates);
        app(TicketController::class)->index($req);
        throw new RuntimeException('Invalid date range was accepted');
    } catch (\Illuminate\Validation\ValidationException $e) {
        $check(isset($e->errors()['date_from']) || isset($e->errors()['date_to']), 'Invalid date range rejected');
    }
}
// Leader dashboard categories and closure periods must match Ticket reports.
foreach (['unassigned' => 'Unassigned active', 'priority_not_set' => 'Priority not set'] as $filter => $label) {
    $req = $request($admin, ['preview_user' => $leader->id, 'view' => 'all', 'status_filter' => $filter]);
    $result = app(TicketController::class)->index($req)->toResponse($req)->getData(true)['props'];
    $check($result['tickets']['total'] === $result['reports'][$label], "Leader {$label} filter matches Ticket reports");
}
foreach (['day' => 'Today', 'week' => 'This week', 'month' => 'This month', 'year' => 'This year'] as $period => $label) {
    $req = $request($admin, ['preview_user' => $leader->id, 'view' => 'all', 'status_filter' => 'closed', 'closed_period' => $period]);
    $result = app(TicketController::class)->index($req)->toResponse($req)->getData(true)['props'];
    $check($result['tickets']['total'] === $result['reports']['Closed · '.$label], "Leader {$label} closure filter matches Ticket reports");
}
foreach ([$member, $leader] as $actor) {
    foreach (['critical', 'high', 'medium', 'low', 'not_set'] as $priority) {
        $req = $request($admin, ['preview_user' => $actor->id, 'view' => TicketAccess::role($actor) === 'member' ? 'assigned' : 'all', 'priority_filter' => $priority]);
        $result = app(TicketController::class)->index($req)->toResponse($req)->getData(true)['props'];
        $check($result['tickets']['total'] === $result['prioritySummary'][$priority], "Priority {$priority} filter matches scoped dashboard for {$actor->id}");
        $check(collect($result['tickets']['data'])->every(fn ($ticket) => $ticket['priority'] === ($priority === 'not_set' ? null : $priority)), 'Priority filter returns only matching tickets');
    }
}
// Match real named GET routes so defaults and path-based authorization are exercised.
foreach ([[$leader, 'dashboard'], [$leader, 'all'], [$member, 'assigned'], [$leader, 'leaderboard']] as [$viewer, $screen]) {
    $req = Request::create('/tickets/preview/'.$screen, 'GET', ['preview_user' => $viewer->id, 'view' => 'all']);
    $matched = Route::getRoutes()->match($req);
    $req->setRouteResolver(fn () => $matched);
    $req->setUserResolver(fn () => $admin);
    $req->setLaravelSession($app['session']->driver());
    $req->headers->set('X-Inertia', 'true');
    $result = app(TicketController::class)->index($req)->toResponse($req)->getData(true)['props'];
    $check($matched->getName() === 'tickets.preview.'.$screen && $result['filters']['view'] === $screen, "Named {$screen} path takes precedence over legacy query view");
}
foreach (['open', 'closed'] as $status) {
    $req = Request::create('/tickets/preview/'.$status, 'GET', ['preview_user' => $leader->id, 'priority_filter' => 'critical']);
    $matched = Route::getRoutes()->match($req);
    $req->setRouteResolver(fn () => $matched); $req->setUserResolver(fn () => $admin); $req->setLaravelSession($app['session']->driver());
    $response = app(TicketController::class)->index($req);
    $target = parse_url($response->getTargetUrl()); parse_str($target['query'], $query);
    $check($target['path'] === '/tickets/preview/all' && $query['status_filter'] === $status && $query['priority_filter'] === 'critical' && (int) $query['preview_user'] === $leader->id, "Legacy {$status} path redirects to filtered All tickets");
}
$req = Request::create('/tickets/preview/leaderboard', 'GET', ['preview_user' => $member->id, 'view' => 'all']);
$matched = Route::getRoutes()->match($req);
$req->setRouteResolver(fn () => $matched); $req->setUserResolver(fn () => $admin); $req->setLaravelSession($app['session']->driver());
try { app(TicketController::class)->index($req); throw new RuntimeException('Member accessed leader-only path'); }
catch (Symfony\Component\HttpKernel\Exception\HttpException $e) { $check($e->getStatusCode() === 403, 'Named leaderboard path preserves leader-only authorization'); }
echo "Employee dashboard checks passed. No database writes performed.\n";
