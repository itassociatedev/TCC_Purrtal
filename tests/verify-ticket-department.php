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
$employee = $users->first(fn ($u) => strtolower(trim($u->role?->name ?? '')) === 'employee');
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
    $department = App\Models\Department::create(['name' => 'Transactional dropdown check']);
    $employee->update(['department_id' => $department->id]);
    $employee->unsetRelation('department');
    $req = $request('tickets.preview.create', $employee);
    $props = $controller->index($req)->toResponse($req)->getData(true)['props'];
    $check(collect($props['departments'])->contains('id', $department->id), 'Existing department remains available in creation data');
    $input = ['branch_id' => TicketAccess::branches($employee)->firstOrFail()->id, 'subject' => 'Department dropdown verification',
        'description' => 'Rolled back', 'category' => 'Hardware', 'employee_department' => $department->name,
        'affected_asset' => 'Printer', 'operational_impact' => 'Printing delayed', 'reporting_channel' => 'portal'];
    // Exercise a direct submission that bypasses the required browser dropdown.
    foreach ([[], ['priority' => ''], ['priority' => 'not_set']] as $priorityInput) {
        try {
            $controller->store($request('tickets.preview.store', $employee, $input + $priorityInput));
            throw new RuntimeException('Submission without a valid priority accepted');
        } catch (Illuminate\Validation\ValidationException $e) {
            $check(isset($e->errors()['priority']), 'Server rejects a missing, empty or invalid priority');
        }
    }
    $input['priority'] = 'medium';
    $controller->store($request('tickets.preview.store', $employee, $input));
    $ticket = Ticket::where('subject', $input['subject'])->latest('id')->firstOrFail();
    $check($ticket->priority === 'medium', 'Selected priority is saved');
    $check($ticket->employee_department === $department->name, 'Account department snapshot is saved');
    foreach (['', 'Forged department name'] as $forged) {
        $controller->store($request('tickets.preview.store', $employee, array_replace($input, ['employee_department' => $forged])));
        $saved = Ticket::where('subject', $input['subject'])->latest('id')->firstOrFail();
        $check($saved->employee_department === $department->name, 'Client department cannot override account department');
    }
    $employee->update(['department_id' => null]);
    try {
        $controller->store($request('tickets.preview.store', $employee, $input));
        throw new RuntimeException('Missing account department accepted');
    } catch (Illuminate\Validation\ValidationException $e) { $check(isset($e->errors()['employee_department']), 'Missing account department is rejected even if a department is submitted'); }
    $itDepartment = App\Models\Department::where('name', 'Information Technology')->firstOrFail();
    $unlinkedBranch = App\Models\Branch::create(['name' => 'Transactional IT branch access check']);
    $employee->update(['department_id' => $itDepartment->id]); $employee->unsetRelation('department');
    $check(TicketAccess::branches($employee)->whereKey($unlinkedBranch->id)->exists(), 'IT department employee may select an unlinked branch');
    $controller->store($request('tickets.preview.store', $employee, array_replace($input, ['branch_id' => $unlinkedBranch->id])));
    $check(Ticket::where('creator_id', $employee->id)->where('branch_id', $unlinkedBranch->id)->exists(), 'Backend accepts any affected branch for IT department staff');
    $check(TicketAccess::role($employee) === 'employee', 'IT department branch access does not grant management permissions');
    $employee->update(['department_id' => $department->id]); $employee->unsetRelation('department');
    $check(!TicketAccess::branches($employee)->whereKey($unlinkedBranch->id)->exists(), 'Non-IT employees retain linked branch restrictions');
    try {
        $controller->store($request('tickets.preview.store', $employee, array_replace($input, ['branch_id' => $unlinkedBranch->id])));
        throw new RuntimeException('Non-IT branch restriction bypassed');
    } catch (Illuminate\Validation\ValidationException $e) { $check(isset($e->errors()['branch_id']), 'Backend rejects unlinked branch for non-IT employees'); }
    Notification::assertNothingSent();
    echo "Department checks passed. All writes rolled back.\n";
} finally { DB::rollBack(); }
