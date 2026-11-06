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
// Build controller requests with a route name, actor, and session without logging
// in through the UI. This checks backend responses, not browser rendering.
$request = function ($name, $actor, $input = []) use ($app) {
    if (str_ends_with($name, '.store')) {
        $input = array_merge([
            'reporting_channel' => 'portal',
            'employee_department' => 'Operations',
            'affected_asset' => 'Reception printer',
            'operational_impact' => 'Printing is delayed', 'supporting_links' => ['https://example.com/screenshot'],
        ], $input);
    }
    $route = Route::getRoutes()->getByName($name);
    $request = Request::create('/tickets', 'GET', $input);
    $request->setRouteResolver(fn () => $route);
    $request->setUserResolver(fn () => $actor);
    $request->setLaravelSession($app['session']->driver());
    $request->headers->set('X-Inertia', 'true');
    return $request;
};

// Exercise the installed local schema without running unrelated fresh migrations.
// The finally block rolls back the sample submission even when a check throws.
DB::beginTransaction();
try {
    // This branch is not assigned to any account and is rolled back after the checks.
    $unassignedBranch = Branch::create(['name' => 'Transactional branch selection check']);
    $users = User::whereIn('id', DB::table('ticket_preview_users')->select('user_id'))->get();
    $check($users->pluck('role_id')->unique()->count() === DB::table('roles')->count(), 'At least one test employee exists for each role');
    $leader = User::all()->first(fn ($user) => TicketAccess::canPreview($user) && !$users->contains('id', $user->id));
    if (!$leader) throw new RuntimeException('A real IT leader account is required.');
    Auth::setUser($leader);
    $controller = app(TicketController::class);
    foreach (['employee', 'leader', 'member'] as $role) {
        $actor = $users->first(fn ($user) => TicketAccess::role($user) === $role);
        $req = $request('tickets.preview.index', $leader, ['preview_user' => $actor->id]);
        $props = $controller->index($req)->toResponse($req)->getData(true)['props'];
        $check($props['ticketRole'] === $role && $props['ticketUser']['id'] === $actor->id, "Preview renders {$role} identity and permissions");
        if ($role === 'leader') {
            // Report totals must use the preview environment and distinguish
            // resolved work from closure and outstanding action queues.
            $reportTickets = Ticket::where('is_preview', true);
            $check($props['reports']['Total tickets'] === (clone $reportTickets)->count(), 'Report total matches the selected environment');
            foreach (['Not started' => 'not_started', 'In progress' => 'in_progress', 'Resolved' => 'resolved', 'Closed' => 'closed'] as $label => $status) {
                $check($props['reports'][$label] === (clone $reportTickets)->where('status', $status)->count(), "Report {$label} matches current status");
            }
            $activeTickets = (clone $reportTickets)->whereIn('status', ['not_started', 'in_progress']);
            $check($props['reports']['Unassigned active'] === (clone $activeTickets)->whereNull('assigned_to')->count()
                && $props['reports']['Priority not set'] === (clone $activeTickets)->whereNull('priority')->count(),
                'Report action queues exclude resolved and closed tickets');
            $expectedMembers = TicketAccess::members(true)->get();
            $check(count($props['memberWorkloads']) === $expectedMembers->count(), 'Leader workload panel includes every preview IT member');
            foreach ($props['memberWorkloads'] as $member) {
                $assigned = Ticket::where('is_preview', true)->where('assigned_to', $member['id']);
                $check($member['assigned_count'] === (clone $assigned)->count()
                    && $member['resolved_count'] === (clone $assigned)->whereIn('status', ['resolved', 'closed'])->count(),
                    'Member workload totals match preview assignments and completions');
            }
        } else {
            $check($props['memberWorkloads'] === [], 'Member workload data is restricted to the leader view');
        }
        if ($role === 'employee') {
            $check(collect($props['branches'])->pluck('id')->sort()->values()->all()
                === TicketAccess::branches($actor)->pluck('id')->sort()->values()->all(), 'Employee dropdown matches allowed branch scope');
            $check(collect($props['tickets']['data'])->every(fn ($t) => $t['creator_id'] === $actor->id && $t['is_preview']), 'Employee preview exposes only their test tickets');
        }
    }
    $employee = $users->first(fn ($user) => strtolower(trim($user->role?->name ?? '')) === 'employee');
    $check(!TicketAccess::branches($employee)->whereKey($unassignedBranch->id)->exists(), 'Ordinary employees cannot select unassigned branches');
    // Check exceptions without changing real account roles or granting management rights.
    foreach (['Executive Vice President', 'Executive Assistant', 'IT', 'IT TL', 'IT Member', 'IT Staff', 'IT Admin'] as $roleName) {
        $identity = clone $employee;
        $identity->setRelation('role', new \App\Models\Role(['name' => $roleName]));
        $check(TicketAccess::branches($identity)->whereKey($unassignedBranch->id)->exists(), "{$roleName} may select any branch");
    }
    try {
        $controller->store($request('tickets.preview.store', $leader, ['preview_user' => $employee->id,
            'subject' => 'Rejected branch', 'description' => 'Test', 'category' => 'Hardware', 'branch_id' => $unassignedBranch->id]));
        throw new RuntimeException('Unassigned branch submission was accepted');
    } catch (\Illuminate\Validation\ValidationException $e) {
        $check(isset($e->errors()['branch_id']), 'Server rejects unassigned branch submissions');
    }
    try {
        $controller->index($request('tickets.preview.index', $employee));
        throw new RuntimeException('Unauthorized preview was allowed');
    } catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
        $check($e->getStatusCode() === 403, 'Employee cannot access preview');
    }
    $ticket = Ticket::where('is_preview', true)->firstOrFail();
    try {
        $controller->update($request('tickets.update', $leader, ['status' => 'closed']), $ticket);
        throw new RuntimeException('Live endpoint accepted preview ticket');
    } catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
        $check($e->getStatusCode() === 404, 'Live updates reject preview tickets');
    }
    $before = Ticket::where('is_preview', true)->count();
    foreach ([['supporting_links' => ['javascript:alert(1)']], ['operational_impact' => '']] as $invalid) {
        try {
            $controller->store($request('tickets.preview.store', $leader, array_merge([
                'preview_user' => $employee->id, 'subject' => 'Invalid intake check',
                'description' => 'Test', 'category' => 'Hardware', 'branch_id' => $employee->branch_id,
            ], $invalid)));
            throw new RuntimeException('Invalid intake was accepted');
        } catch (\Illuminate\Validation\ValidationException $e) {
            $key = array_key_first($invalid);
            $check(isset($e->errors()[$key]) || isset($e->errors()[$key.'.0']), "Intake rejects invalid {$key}");
        }
    }
    $controller->store($request('tickets.preview.store', $leader, ['preview_user' => $employee->id,
        'priority' => 'high', 'subject' => 'Transactional preview check', 'description' => 'Rolled back after verification',
        'category' => 'Hardware', 'branch_id' => $employee->branch_id]));
    $check(Ticket::where('is_preview', true)->count() === $before + 1, 'Preview submission creates a test ticket');
    $check(Ticket::where('is_preview', true)->where('subject', 'Transactional preview check')
        ->where('branch_id', $employee->branch_id)->exists(), 'Submission accepts the employee primary branch');
    $intake = Ticket::where('is_preview', true)->where('subject', 'Transactional preview check')->firstOrFail();
    $check($intake->affected_asset === 'Reception printer'
        && $intake->supporting_links === ['https://example.com/screenshot']
        && $intake->employee_department === ($employee->department?->name ?: 'Operations'), 'Current intake fields persist correctly');
    // Feedback is for the actual resolver and only after resolution.
    $resolver = $users->first(fn ($user) => TicketAccess::role($user) === 'leader');
    $intake->update(['status' => 'closed', 'sla_state' => array_merge($intake->sla_state, ['resolved_by' => $resolver->id])]);
    $check($intake->priority === 'high' && app(\App\Services\TicketSla::class)->snapshot($intake)['label'] === 'P2 High', 'Requester priority sets initial SLA target');
    $check(TicketAccess::members(true)->whereKey($resolver->id)->exists(), 'Team leaders are valid assignees');
    $notificationCount = DB::table('notifications')->count();
    $controller->update($request('tickets.preview.update', $leader, ['preview_user' => $employee->id,
        'action' => 'feedback', 'rating' => 5]), $intake);
    $feedback = $intake->activities()->where('type', 'feedback')->firstOrFail();
    $check($feedback->details['resolved_by'] === $resolver->id && $feedback->details['rating'] === 5 && $feedback->actor_id === $employee->id,
        'Preview feedback saves a rating without requiring a comment');
    $check(DB::table('notifications')->count() === $notificationCount, 'Preview feedback never sends live notifications');
    // Exercise reopen authorization and closure timestamp handling under rollback.
    $closed = Ticket::where('is_preview', true)->where('status', 'closed')->firstOrFail();
    $member = $users->first(fn ($user) => TicketAccess::role($user) === 'member');
    $closed->update(['assigned_to' => $member->id]);
    foreach ([$employee, $users->first(fn ($user) => TicketAccess::role($user) === 'member' && $user->id !== $member->id)] as $denied) {
        if (!$denied) continue;
        try {
            $controller->update($request('tickets.preview.update', $leader, ['preview_user' => $denied->id, 'status' => 'in_progress']), $closed);
            throw new RuntimeException('Unauthorized reopen was allowed');
        } catch (Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $check($e->getStatusCode() === 403, 'Employees and unassigned members cannot reopen tickets');
        }
    }
    $controller->update($request('tickets.preview.update', $leader, ['preview_user' => $member->id, 'status' => 'in_progress', 'note' => 'Verification: issue returned']), $closed);
    $closed->refresh();
    $check($closed->status === 'in_progress' && $closed->closed_at === null && $closed->assigned_to === $member->id,
        'Assigned IT member can reopen without losing assignment');
    $closed->update(['status' => 'closed', 'closed_at' => now(), 'assigned_to' => null]);
    $testLeader = $users->first(fn ($user) => TicketAccess::role($user) === 'leader');
    $controller->update($request('tickets.preview.update', $leader, ['preview_user' => $testLeader->id, 'status' => 'in_progress', 'note' => 'Verification: additional work required']), $closed);
    $check($closed->fresh()->status === 'in_progress' && $closed->fresh()->closed_at === null, 'IT leader can reopen an unassigned closed ticket');
    $openCount = Ticket::where('is_preview', true)->where('status', '!=', 'closed')->count();
    foreach (['5', '10', '15', 'all'] as $size) {
        $req = $request('tickets.preview.index', $leader, ['preview_user' => $testLeader->id,
            'view' => 'open', 'per_page' => $size, 'page' => $size === 'all' ? 999 : 1]);
        $props = $controller->index($req)->toResponse($req)->getData(true)['props'];
        $check(count($props['tickets']['data']) === ($size === 'all' ? $openCount : min((int) $size, $openCount))
            && $props['filters']['per_page'] === $size && $props['tickets']['current_page'] === 1,
            "Table size {$size} returns the expected authorized rows");
    }
    $req = $request('tickets.preview.index', $leader, ['preview_user' => $employee->id, 'per_page' => 'all']);
    $props = $controller->index($req)->toResponse($req)->getData(true)['props'];
    $check(collect($props['tickets']['data'])->every(fn ($t) => $t['creator_id'] === $employee->id), 'All option preserves employee ticket isolation');
    try {
        $controller->index($request('tickets.preview.index', $leader, ['preview_user' => $testLeader->id, 'per_page' => '100']));
        throw new RuntimeException('Invalid table size was accepted');
    } catch (\Illuminate\Validation\ValidationException $e) {
        $check(isset($e->errors()['per_page']), 'Invalid table sizes are rejected');
    }
    // Sorting must span all pages, and employee tabs must keep creator isolation.
    foreach (['open', 'closed'] as $tab) {
        $req = $request('tickets.preview.index', $leader, ['preview_user' => $employee->id, 'view' => $tab, 'per_page' => 'all']);
        $rows = $controller->index($req)->toResponse($req)->getData(true)['props']['tickets']['data'];
        $check(collect($rows)->every(fn ($t) => $t['creator_id'] === $employee->id && (($t['status'] === 'closed') === ($tab === 'closed'))), "Employee {$tab} tab is correctly scoped");
    }
    foreach (['subject', 'description', 'category', 'status', 'created_at', 'priority', 'branch', 'creator', 'assignee'] as $column) {
        $req = $request('tickets.preview.index', $leader, ['preview_user' => $resolver->id, 'sort' => $column, 'direction' => 'asc']);
        $props = $controller->index($req)->toResponse($req)->getData(true)['props'];
        $check($props['filters']['sort'] === $column, "Server accepts safe {$column} sorting");
    }
    $intake->update(['assigned_to' => $users->first(fn ($u) => TicketAccess::role($u) === 'member')->id]);
    $req = $request('tickets.preview.index', $leader, ['preview_user' => $resolver->id, 'view' => 'assigned']);
    $props = $controller->index($req)->toResponse($req)->getData(true)['props'];
    $workload = collect($props['memberWorkloads'])->firstWhere('id', $resolver->id);
    $check($workload['rating_count'] >= 1, 'Resolver keeps ticket rating after reassignment');
    $check(collect($props['tickets']['data'])->every(fn ($t) => $t['assigned_to'] === $resolver->id), 'Leader assigned view exposes own assignments');
    echo "All preview checks passed. Verification writes rolled back.\n";
} finally {
    DB::rollBack();
}
