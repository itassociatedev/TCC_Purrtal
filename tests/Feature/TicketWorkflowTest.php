<?php

use App\Models\{Branch, Role, Ticket, User};
use App\Notifications\TicketNotification;
use Illuminate\Support\Facades\Notification;

// Shared fixtures keep each scenario focused on permissions and workflow behavior.
function ticketUser(string $role): User
{
    return User::factory()->create(['role_id' => Role::firstOrCreate(['name' => $role])->id,
        'branch_id' => Branch::firstOrCreate(['name' => 'Test Clinic'])->id]);
}

function ticketIntakeFields(): array
{
    return ['reporting_channel' => 'portal', 'employee_department' => 'Operations', 'priority' => 'medium',
        'affected_asset' => 'Workstation',
        'operational_impact' => 'Work is delayed'];
}

function sampleTicket(User $creator, array $extra = []): Ticket
{
    return Ticket::create(array_merge(['creator_id' => $creator->id, 'employee_name' => $creator->name,
        'branch_id' => $creator->branch_id, 'subject' => 'Network problem', 'description' => 'Cannot connect',
        'category' => 'Network'], $extra));
}

test('preview is restricted to IT leaders and registered test users', function () {
    $this->seed(\Database\Seeders\TicketPreviewSeeder::class);
    $employee = ticketUser('Employee');
    $this->actingAs($employee)->get(route('tickets.preview.index'))->assertForbidden();
    $this->actingAs(ticketUser('IT Member'))->get(route('tickets.preview.index'))->assertForbidden();
    $this->actingAs(ticketUser('IT TL'))->get(route('tickets.preview.index', ['preview_user' => $employee->id]))
        ->assertSessionHasErrors('preview_user');
});

// Check both server-derived test identity and rejection of cross-environment writes.
test('preview submissions and updates stay separate from live tickets', function () {
    Notification::fake();
    $this->seed(\Database\Seeders\TicketPreviewSeeder::class);
    $testEmployee = User::whereIn('id', \Illuminate\Support\Facades\DB::table('ticket_preview_users')->select('user_id'))
        ->get()->first(fn ($user) => \App\Services\TicketAccess::role($user) === 'employee');
    $leader = ticketUser('IT TL');
    $this->actingAs($leader)->post(route('tickets.preview.store', ['preview_user' => $testEmployee->id]), [
        'subject' => 'Preview submission', 'description' => 'A test', 'category' => 'Hardware', ...ticketIntakeFields(), 'branch_id' => $testEmployee->branch_id,
    ])->assertSessionHasNoErrors();
    $ticket = Ticket::where('subject', 'Preview submission')->firstOrFail();
    expect($ticket->is_preview)->toBeTrue();
    expect($ticket->creator_id)->toBe($testEmployee->id);
    Notification::assertNothingSent();
    $this->patch(route('tickets.update', $ticket), ['status' => 'closed'])->assertNotFound();
    $live = sampleTicket(ticketUser('Employee'));
    $this->patch(route('tickets.preview.update', ['ticket' => $live->id, 'preview_user' => $testEmployee->id]), ['status' => 'closed'])->assertNotFound();
});

test('employees submit authenticated identity and notify only IT staff', function () {
    Notification::fake();
    $employee = ticketUser('Employee');
    $leader = ticketUser('IT TL');
    $member = ticketUser('IT Member');
    $admin = ticketUser('Admin');
    $this->actingAs($employee)->post(route('tickets.store'), [
        'branch_id' => $employee->branch_id, 'subject' => 'Help', 'description' => 'Broken laptop',
        'category' => 'Hardware', ...ticketIntakeFields(), 'creator_id' => $admin->id, 'priority' => 'critical', 'status' => 'closed',
    ])->assertRedirect(route('tickets.dashboard'));
    $this->assertDatabaseHas('tickets', ['creator_id' => $employee->id, 'status' => 'not_started', 'priority' => 'critical']);
    Notification::assertSentTo([$leader, $member], TicketNotification::class);
    Notification::assertNotSentTo($admin, TicketNotification::class);
});

test('employees can choose assigned branches only and cannot change tickets', function () {
    Notification::fake();
    $employee = ticketUser('Employee');
    $branch = Branch::create(['name' => 'Other clinic']);
    $ticket = sampleTicket($employee);
    $this->actingAs($employee)->post(route('tickets.store'), ['branch_id' => $branch->id,
        'subject' => 'Help', 'description' => 'Issue', 'category' => 'Hardware', ...ticketIntakeFields()])->assertSessionHasErrors('branch_id');
    $employee->branches()->attach($branch->id);
    $this->post(route('tickets.store'), ['branch_id' => $branch->id,
        'subject' => 'Help', 'description' => 'Issue', 'category' => 'Hardware', ...ticketIntakeFields()])->assertSessionHasNoErrors();
    $this->post(route('tickets.store'), ['branch_id' => Branch::max('id') + 1,
        'subject' => 'Invalid branch', 'description' => 'Issue', 'category' => 'Hardware', ...ticketIntakeFields()])->assertSessionHasErrors('branch_id');
    $this->patch(route('tickets.update', $ticket), ['status' => 'closed'])->assertForbidden();
    $this->actingAs(ticketUser('Admin'))->patch(route('tickets.update', $ticket), ['priority' => 'critical'])->assertForbidden();
});

test('leaders assign only IT members and members update only their assignments', function () {
    Notification::fake();
    $employee = ticketUser('Employee');
    $leader = ticketUser('IT TL');
    $member = ticketUser('IT Member');
    $other = ticketUser('IT Staff');
    $ticket = sampleTicket($employee);
    $this->actingAs($leader)->patch(route('tickets.update', $ticket), ['assigned_to' => $employee->id])->assertSessionHasErrors('assigned_to');
    $this->patch(route('tickets.update', $ticket), ['assigned_to' => $member->id, 'priority' => 'high', 'priority_reason' => 'Operational disruption'])->assertSessionHasNoErrors();
    Notification::assertSentTo($member, TicketNotification::class);
    $this->actingAs($other)->patch(route('tickets.update', $ticket), ['status' => 'resolved'])->assertForbidden();
    $this->actingAs($member)->patch(route('tickets.update', $ticket), ['priority' => 'critical'])->assertSessionHasErrors('priority');
    $this->patch(route('tickets.update', $ticket), ['status' => 'resolved'])->assertSessionHasNoErrors();
    Notification::assertSentTo($employee, TicketNotification::class);
    $this->patch(route('tickets.update', $ticket), ['status' => 'closed'])->assertForbidden();
    $this->actingAs($leader)->patch(route('tickets.update', $ticket), ['status' => 'closed', 'note' => 'Confirmed with requester'])->assertSessionHasNoErrors();
    expect($ticket->fresh()->closed_at)->not->toBeNull();
    $this->actingAs($employee)->patch(route('tickets.update', $ticket), ['status' => 'in_progress'])->assertForbidden();
    $this->actingAs($other)->patch(route('tickets.update', $ticket), ['status' => 'in_progress'])->assertForbidden();
    $this->actingAs($member)->patch(route('tickets.update', $ticket), ['status' => 'in_progress'])->assertSessionHasNoErrors();
    expect($ticket->fresh()->status)->toBe('in_progress');
    expect($ticket->fresh()->closed_at)->toBeNull();
    expect($ticket->fresh()->assigned_to)->toBe($member->id);
});

test('ticket views isolate employee data and leader reports', function () {
    $this->withoutVite();
    $employee = ticketUser('Employee');
    $other = ticketUser('Employee');
    sampleTicket($employee);
    sampleTicket($other);
    $this->actingAs($employee)->get(route('tickets.index'))->assertOk()->assertInertia(fn ($page) => $page
        ->component('Tickets/Index')->has('tickets.data', 1)->where('reports', null));
    $this->get(route('tickets.index', ['view' => 'reports']))->assertForbidden();
    $this->actingAs(ticketUser('IT Member'))->get(route('tickets.index', ['view' => 'reports']))->assertForbidden();
    $this->actingAs(ticketUser('IT TL'))->get(route('tickets.index', ['view' => 'reports']))->assertOk()
        ->assertInertia(fn ($page) => $page->where('reports.Not started', 2));
});
