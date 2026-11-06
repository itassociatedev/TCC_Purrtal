<?php

use App\Models\Ticket;
use App\Services\{SupportClock, TicketSla};
use Carbon\CarbonImmutable;

uses(Tests\TestCase::class);

test('support time excludes nights but includes weekends and holidays', function () {
    $clock = new SupportClock(config('ticket-sla'));
    expect($clock->seconds('2026-10-23T18:30:00+08:00', '2026-10-24T08:00:00+08:00'))->toBe(3600);
    expect($clock->seconds('2026-12-25T07:30:00+08:00', '2026-12-25T19:00:00+08:00'))->toBe(41400);
    expect($clock->seconds('2026-10-25T07:30:00+08:00', '2026-10-25T19:00:00+08:00'))->toBe(41400);
});

test('after hours deadlines start at the next opening and honor daily boundaries', function () {
    $clock = new SupportClock(config('ticket-sla'));
    expect($clock->deadline('2026-10-23T20:00:00+08:00', 900))->toBe('2026-10-23T23:45:00+00:00');
    expect($clock->deadline('2026-10-23T18:00:00+08:00', 14400))->toBe('2026-10-24T02:30:00+00:00');
    expect($clock->deadline('2026-10-23T07:30:00+08:00', 3 * 41400))->toBe('2026-10-25T11:00:00+00:00');
});

test('Not Set accumulates support time without inventing targets and legacy tickets stay excluded', function () {
    $sla = new TicketSla;
    expect($sla->snapshot(new Ticket)['enabled'])->toBeFalse();
    $ticket = new Ticket(['sla_policy' => config('ticket-sla'), 'sla_received_at' => '2026-10-27T00:00:00Z',
        'sla_state' => ['elapsed' => 0, 'running_since' => '2026-10-27T00:00:00Z'], 'priority' => null]);
    $view = $sla->snapshot($ticket, CarbonImmutable::parse('2026-10-27T01:00:00Z'));
    expect($view['resolution_elapsed'])->toBe(3600);
    expect($view['resolution_remaining'])->toBeNull();
    $ticket->priority = 'critical';
    expect($sla->snapshot($ticket, '2026-10-27T01:00:00Z')['resolution_remaining'])->toBe(10800);
    $ticket->priority = 'high';
    expect($sla->snapshot($ticket, '2026-10-27T01:00:00Z')['resolution_remaining'])->toBe(25200);
});

test('paused and resolved timers stop while response timing continues through pauses', function () {
    $ticket = new Ticket(['sla_policy' => config('ticket-sla'), 'sla_received_at' => '2026-10-27T00:00:00Z',
        'priority' => 'critical', 'sla_state' => ['elapsed' => 3600, 'running_since' => null,
            'paused_at' => '2026-10-27T01:00:00Z']]);
    $view = (new TicketSla)->snapshot($ticket, '2026-10-27T02:00:00Z');
    expect($view['resolution_elapsed'])->toBe(3600);
    expect($view['response_elapsed'])->toBe(7200);
    expect($view['resolution_status'])->toBe('Paused');
    expect($view['resolution_deadline'])->toBeNull();
});

test('a deadline at closing time does not drift to the next morning', function () {
    $ticket = new Ticket(['sla_policy' => config('ticket-sla'), 'sla_received_at' => '2026-10-27T07:00:00Z',
        'priority' => 'critical', 'sla_state' => ['elapsed' => 0, 'running_since' => '2026-10-27T07:00:00Z']]);
    $view = (new TicketSla)->snapshot($ticket, '2026-10-27T12:00:00Z');
    expect($view['resolution_remaining'])->toBe(0);
    expect($view['resolution_deadline'])->toBe('2026-10-27T11:00:00+00:00');
});
