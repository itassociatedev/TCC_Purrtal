<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Models\{User, Role, Position, Ticket};
use App\Services\TicketAccess;
use Illuminate\Support\Facades\{DB, Notification, Route};
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;
Notification::fake(); DB::beginTransaction();
try {
    $check = function ($ok, $message) { if (!$ok) throw new RuntimeException($message); echo 'PASS: '.$message.PHP_EOL; };
    $check(!Role::whereIn('name', ['IT TL', 'IT Member', 'IT Intern'])->exists(), 'Obsolete IT roles removed');
    foreach (['it-tl' => ['IT Team Leader','leader'], 'it-member' => ['IT Associate','member'], 'it-intern' => ['IT Intern','member']] as $slug => [$title, $workflow]) {
        $user = User::with(['role','position'])->where('email', $slug.'@tcc.local')->firstOrFail();
        $check(strtolower($user->role->name) === 'employee' && $user->position->name === $title && TicketAccess::role($user) === $workflow, $slug.' uses employee role plus '.$title.' position');
    }
    // Database role and department alone must never confer IT permissions.
    $probe = User::firstOrFail()->replicate();
    $probe->setRelation('position', null);
    $probe->setRelation('role', new Role(['name' => 'IT TL']));
    $check(TicketAccess::role($probe) === 'employee', 'Legacy role name without IT position grants no ticket management');
    foreach (['IT Team Leader' => 'leader', 'IT Associate' => 'member', 'IT Intern' => 'member', 'IT Admin' => 'member', 'IT Analyst' => 'member', 'Audit Team Leader' => 'employee', 'Security' => 'employee'] as $title => $workflow) {
        $probe->setRelation('position', new Position(['name' => $title]));
        $check(TicketAccess::role($probe) === $workflow && TicketAccess::notificationRole($probe) === $workflow, $title.' classifies consistently');
    }
    $realLeader = User::where('email', 'cm.markjay@gmail.com')->firstOrFail();
    $realMember = User::where('email', 'luigimaloles@gmail.com')->firstOrFail();
    $check(TicketAccess::role($realLeader) === 'leader' && TicketAccess::role($realMember) === 'member', 'Actual IT supervisor and intern now have correct views');
    $roster = TicketAccess::members()->pluck('id');
    $check($roster->contains($realLeader->id) && $roster->contains($realMember->id), 'Workload/leaderboard roster includes real IT accounts');
    $check(!TicketAccess::members(false, true)->whereKey($realLeader->id)->exists(), 'Handover member roster excludes supervisor positions');
    $check(TicketAccess::members(false, true)->whereKey($realMember->id)->exists(), 'Handover member roster includes actual intern');
    $r = Request::create('/tickets/dashboard', 'GET'); $r->headers->set('X-Inertia', 'true');
    $r->setUserResolver(fn () => $realLeader); $r->setLaravelSession($app['session']->driver());
    $r->setRouteResolver(fn () => Route::getRoutes()->getByName('tickets.dashboard'));
    $props = app(App\Http\Controllers\TicketController::class)->index($r)->toResponse($r)->getData(true)['props'];
    $check($props['ticketRole'] === 'leader' && collect($props['memberWorkloads'])->contains('id', $realMember->id), 'Actual supervisor receives staff workload containing real intern');
    $ticketCount = Ticket::count();
    DB::table('users')->where('id', $realMember->id)->update(['status' => 'Disabled']);
    $withoutDisabled = app(App\Http\Controllers\TicketController::class)->index($r)->toResponse($r)->getData(true)['props'];
    $check(!collect($withoutDisabled['memberWorkloads'])->contains('id', $realMember->id), 'Disabled staff excluded from workload panels');
    $check(Ticket::count() === $ticketCount && TicketAccess::members()->whereKey($realMember->id)->exists(), 'Workload exclusion retains tickets and historical roster membership');
    DB::table('users')->where('id', $realMember->id)->update(['status' => $realMember->status]);
    $sample = Ticket::where('is_preview', false)->firstOrFail()->replicate();
    $sample->creator_id = $realMember->id; $sample->assigned_to = $realMember->id;
    $sample->status = 'in_progress'; $sample->save();
    $all = Request::create('/tickets/all', 'GET', ['search' => $sample->ticket_code]);
    $all->headers->set('X-Inertia', 'true'); $all->setUserResolver(fn () => $realLeader);
    $all->setLaravelSession($app['session']->driver()); $all->setRouteResolver(fn () => Route::getRoutes()->getByName('tickets.all'));
    $table = app(App\Http\Controllers\TicketController::class)->index($all)->toResponse($all)->getData(true)['props'];
    $row = collect($table['tickets']['data'])->firstWhere('id', $sample->id);
    $check($row && $row['member_submission'], 'Ticket list retains position-based member-submission review controls');
    $r->setUserResolver(fn () => $realMember); $r->setRouteResolver(fn () => Route::getRoutes()->getByName('tickets.admin'));
    try { app(App\Http\Controllers\TicketController::class)->index($r); throw new RuntimeException('Member gained admin access'); }
    catch (HttpException $e) { $check($e->getStatusCode() === 403, 'IT intern cannot administer ticketing'); }
    $check(Ticket::count() > 0, 'Existing tickets remain');
} finally { DB::rollBack(); }
