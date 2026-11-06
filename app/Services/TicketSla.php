<?php

namespace App\Services;

use App\Models\{Ticket, User};
use App\Notifications\TicketNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

class TicketSla
{
    private function stamp(): string { return now()->utc()->toIso8601String(); }
    private function need(array $data, string $key): string
    {
        $value = trim($data[$key] ?? '');
        if ($value === '') throw ValidationException::withMessages([$key => 'This information is required for this action.']);
        return $value;
    }

    public function activity(Ticket $ticket, ?User $actor, string $type, string $message, array $details = []): void
    {
        $ticket->activities()->create(['actor_id' => $actor?->id, 'type' => $type,
            'message' => $message, 'details' => $details, 'created_at' => now()]);
    }

    public function notify(Ticket $ticket, string $message, bool $team = false): void
    {
        // Preview exercises the same clocks and event history but never notifies live accounts.
        if ($ticket->is_preview) return;
        $recipients = $team
            ? User::with('role')->whereNotIn('id', \Illuminate\Support\Facades\DB::table('ticket_preview_users')->select('user_id'))
                ->get()->filter(fn ($u) => TicketAccess::role($u) === 'leader' || $u->id === $ticket->assigned_to)
            : collect([$ticket->creator]);
        Notification::send($recipients->filter()->unique('id'), new TicketNotification($ticket->id, "Ticket #{$ticket->ticket_code}: {$message}"));
    }

    public function enroll(Ticket $ticket, User $actor, $received): void
    {
        $ticket->sla_policy = config('ticket-sla');
        $ticket->sla_received_at = $received;
        $ticket->sla_state = ['elapsed' => 0, 'running_since' => CarbonImmutable::parse($received)->utc()->toIso8601String(),
            'acknowledged_at' => null, 'resolved_at' => null, 'paused_at' => null, 'reopen_count' => 0,
            'last_update_at' => $this->stamp(), 'alerts' => []];
        $ticket->save();
        $this->activity($ticket, $actor, 'received', 'Ticket received; SLA support time starts at receipt.',
            ['received_at' => $ticket->sla_received_at->toIso8601String(), 'channel' => $ticket->reporting_channel]);
    }

    public function snapshot(Ticket $ticket, $at = null): array
    {
        if (!$ticket->sla_policy) return ['enabled' => false, 'label' => 'Legacy ticket — SLA excluded'];
        $state = $ticket->sla_state;
        $at = CarbonImmutable::parse($at ?? now());
        $clock = new SupportClock($ticket->sla_policy);
        $target = $ticket->sla_policy['targets'][$ticket->priority ?? ''] ?? null;
        $elapsed = (int) ($state['elapsed'] ?? 0);
        if (!empty($state['running_since'])) $elapsed += $clock->seconds($state['running_since'], $at);
        // Preserve the response milestone against its target at completion.
        // A later downgrade must not turn a late acknowledgment into an on-time one.
        $responseElapsed = $state['response_result']['elapsed'] ?? $clock->seconds($ticket->sla_received_at, $state['acknowledged_at'] ?? $at);
        $responseTarget = $state['response_result']['target'] ?? ($target['response'] ?? null);
        // Resolution allowance always follows the newest priority, including paused
        // and completed tickets. Elapsed support time and historical results are retained.
        $resolutionTarget = $target['resolution'] ?? null;
        $remaining = $resolutionTarget !== null ? $resolutionTarget - $elapsed : null;
        $responseRemaining = $responseTarget !== null ? $responseTarget - $responseElapsed : null;
        $stopped = !empty($state['resolved_at']) || !empty($state['workaround_accepted_at']);
        $resolutionStatus = !$target ? 'Not Set' : ($remaining < 0 ? 'Breached' : ($stopped ? 'Completed'
            : (!empty($state['paused_at']) ? 'Paused' : ($remaining <= $target['resolution'] * $ticket->sla_policy['warning_remaining'] ? 'At risk' : 'On track'))));
        return [
            'enabled' => true, 'policy_version' => $ticket->sla_policy['version'],
            'label' => $target['label'] ?? 'Not Set', 'timezone' => $ticket->sla_policy['timezone'],
            'resolution_status' => $resolutionStatus, 'resolution_elapsed' => $elapsed,
            'resolution_remaining' => $remaining, 'resolution_target' => $resolutionTarget,
            'resolution_deadline' => $target && !empty($state['running_since'])
                ? $clock->deadline($state['running_since'], max(0, $target['resolution'] - $state['elapsed'])) : null,
            'response_remaining' => $responseRemaining,
            'response_elapsed' => $responseElapsed,
            'response_deadline' => $responseTarget !== null ? $clock->deadline($ticket->sla_received_at, $responseTarget) : null,
            'response_status' => !$target ? 'Not Set' : ($responseRemaining < 0 ? 'Breached' : (!empty($state['acknowledged_at']) ? 'Completed' : 'On track')),
            'response_complete' => !empty($state['acknowledged_at']), 'resolution_complete' => $stopped,
            'response_ever_breached' => (bool) ($state['response_ever_breached'] ?? false),
            'resolution_ever_breached' => (bool) ($state['resolution_ever_breached'] ?? false),
            'paused' => !empty($state['paused_at']), 'pause_reason' => $state['pause_reason'] ?? null,
            'reopen_count' => $state['reopen_count'] ?? 0,
        ];
    }

    private function stop(array &$state, SupportClock $clock): void
    {
        if (!empty($state['running_since'])) {
            $state['elapsed'] += $clock->seconds($state['running_since'], now());
            $state['running_since'] = null;
        }
    }

    // Called inside the controller's row-lock transaction. The elapsed accumulator
    // survives reassignment, priority changes, pauses, and resolution/reopen cycles.
    public function apply(Ticket $ticket, User $actor, string $role, array $data): void
    {
        $action = $data['action'] ?? 'save';
        $oldStatus = $ticket->status;
        $oldPriority = $ticket->priority;
        $oldAssignee = $ticket->assigned_to;
        $state = $ticket->sla_state;
        $clock = $ticket->sla_policy ? new SupportClock($ticket->sla_policy) : null;
        $desired = $data['status'] ?? $ticket->status;
        if ($action === 'reopen') $desired = 'in_progress';
        if ($action === 'acknowledge' && $oldStatus === 'not_started') $desired = 'in_progress';
        $closing = $action === 'close' || $desired === 'closed';
        if ($closing) {
            abort_unless($role === 'leader', 403, 'Only the IT Team Leader may close tickets.');
            if ($ticket->status !== 'resolved') throw ValidationException::withMessages(['status' => 'Resolve the ticket before closing it.']);
            $desired = 'closed';
        }
        if ($oldStatus === 'closed' && $desired !== 'in_progress') {
            throw ValidationException::withMessages(['status' => 'Reopen the closed ticket as In progress first.']);
        }
        if (array_key_exists('priority', $data) && $data['priority'] !== $oldPriority) {
            $reason = $this->need($data, 'priority_reason');
            $this->activity($ticket, $actor, 'priority_changed', $reason, ['from' => $oldPriority, 'to' => $data['priority']]);
            $ticket->priority = $data['priority'];
            $this->notify($ticket, 'Priority and service targets updated: '.$reason);
        }
        if (isset($data['assigned_to'])) $ticket->assigned_to = $data['assigned_to'];
        // An IT worker taking substantive action becomes the responsible owner
        // if allocation has not happened yet. Pure priority review may remain unassigned.
        if (!$ticket->assigned_to && ($desired === 'resolved' || in_array($action, ['acknowledge', 'restore', 'approve_workaround', 'pause', 'update']))) {
            $ticket->assigned_to = $actor->id;
        }
        if ($oldAssignee !== $ticket->assigned_to) {
            $this->activity($ticket, $actor, 'assigned', $data['note'] ?? 'Ticket ownership assigned.', ['from' => $oldAssignee, 'to' => $ticket->assigned_to]);
            if (!$ticket->is_preview && $ticket->assigned_to) $ticket->assignee()->first()?->notify(new TicketNotification($ticket->id, "Ticket #{$ticket->ticket_code} has been assigned to you."));
        }
        if ($clock) {
            if ($action === 'acknowledge') {
                if (!empty($state['acknowledged_at'])) throw ValidationException::withMessages(['action' => 'This ticket is already acknowledged.']);
                $assessment = $this->need($data, 'assessment');
                $steps = $this->need($data, 'next_steps');
                $state['acknowledged_at'] = $this->stamp();
                $state['acknowledged_by'] = $actor->id;
                $this->activity($ticket, $actor, 'acknowledged', $assessment, ['next_steps' => $steps]);
                $this->notify($ticket, "Acknowledged: {$assessment}. Next steps: {$steps}");
            }
            if ($action === 'pause') {
                if (!empty($state['paused_at']) || !empty($state['resolved_at']) || !empty($state['workaround_accepted_at'])) {
                    throw ValidationException::withMessages(['action' => 'Only an active resolution timer may be paused.']);
                }
                $reason = $this->need($data, 'pause_reason');
                if (!in_array($reason, $ticket->sla_policy['pause_reasons'], true)) throw ValidationException::withMessages(['pause_reason' => 'Choose an approved pause reason.']);
                $note = $this->need($data, 'note');
                $this->stop($state, $clock);
                $state['paused_at'] = $this->stamp();
                $state['pause_reason'] = $reason;
                $this->activity($ticket, $actor, 'paused', $note, ['reason' => $reason, 'started_at' => $state['paused_at']]);
                $this->notify($ticket, 'Resolution timer paused: '.$note);
            }
            if ($action === 'resume') {
                if (empty($state['paused_at'])) throw ValidationException::withMessages(['action' => 'The ticket is not paused.']);
                $note = $this->need($data, 'note');
                $this->activity($ticket, $actor, 'resumed', $note, ['pause_started_at' => $state['paused_at'], 'resumed_at' => $this->stamp()]);
                $state['paused_at'] = null;
                $state['pause_reason'] = null;
                $state['running_since'] = $this->stamp();
                $this->notify($ticket, 'Resolution timer resumed: '.$note);
            }
            if (in_array($action, ['restore', 'approve_workaround'])) {
                $workaround = $this->need($data, 'workaround');
                $plan = $action === 'approve_workaround' ? $this->need($data, 'recovery_plan') : trim($data['recovery_plan'] ?? '');
                if (in_array($ticket->status, ['resolved', 'closed'])) throw ValidationException::withMessages(['action' => 'Record restoration while corrective work is still open.']);
                if ($action === 'approve_workaround') {
                    abort_unless($role === 'leader', 403);
                    if (empty($state['acknowledged_at'])) throw ValidationException::withMessages(['action' => 'Acknowledge the ticket before accepting its workaround.']);
                    if ($ticket->priority !== 'critical') throw ValidationException::withMessages(['priority' => 'Workaround acceptance satisfies the SLA only for P1 Critical.']);
                    $this->stop($state, $clock);
                    $state['workaround_accepted_at'] = $this->stamp();
                    $state['workaround_accepted_by'] = $actor->id;
                    $state['paused_at'] = null;
                    $state['pause_reason'] = null;
                }
                $state['restored_at'] = $this->stamp();
                $state['workaround'] = $workaround;
                $state['recovery_plan'] = $plan;
                $this->activity($ticket, $actor, $action, $workaround, ['recovery_plan' => $plan]);
                $this->notify($ticket, 'Service restoration update: '.$workaround.($plan !== '' ? '. Next steps: '.$plan : ''));
            }
            if ($desired === 'resolved' && $oldStatus !== 'resolved') {
                $documentation = [];
                // Require the issue and a single fix/verification summary. Keep older
                // detailed submissions compatible without requiring duplicate explanations.
                foreach (['findings', 'resolution_details'] as $key) $documentation[$key] = $this->need($data, $key);
                foreach (['troubleshooting_performed', 'corrective_actions'] as $key) {
                    if (!empty($data[$key])) $documentation[$key] = $data[$key];
                }
                if (empty($state['acknowledged_at'])) throw ValidationException::withMessages(['action' => 'Acknowledge the concern before marking it resolved.']);
                $this->stop($state, $clock);
                $state['resolved_at'] = $this->stamp();
                $state['resolved_by'] = $actor->id;
                $state['resolution_documentation'] = $documentation;
                $state['paused_at'] = null;
                $state['pause_reason'] = null;
                $this->activity($ticket, $actor, 'resolved', $documentation['resolution_details'], $documentation);
                $this->notify($ticket, 'Resolved. Please verify service and reply with confirmation or any continuing issue.');
            }
            if ($closing) {
                if (empty($state['resolution_documentation'])) throw ValidationException::withMessages(['status' => 'Resolution documentation is required before closure.']);
                $this->need($data, 'note');
            }
            if ((in_array($oldStatus, ['closed', 'resolved']) && $desired === 'in_progress')
                || ($action === 'reopen' && !empty($state['workaround_accepted_at']))) {
                $reason = $this->need($data, 'note');
                $this->activity($ticket, $actor, 'reopened', $reason, ['previous_resolution_at' => $state['resolved_at'] ?? null]);
                $state['reopen_count']++;
                $state['resolved_at'] = null;
                $state['workaround_accepted_at'] = null;
                $state['confirmed_at'] = null;
                unset($state['resolution_result']);
                $state['paused_at'] = null;
                $state['pause_reason'] = null;
                $state['running_since'] = $this->stamp();
                $this->notify($ticket, 'Reopened: '.$reason);
            }
            if ($action === 'update') {
                $this->activity($ticket, $actor, 'progress', $this->need($data, 'note'), array_filter([
                    'vendor' => $data['vendor'] ?? null, 'vendor_reference' => $data['vendor_reference'] ?? null,
                    'vendor_notified_at' => $data['vendor_notified_at'] ?? null, 'next_update_at' => $data['next_update_at'] ?? null,
                    'linked_ticket_id' => $data['linked_ticket_id'] ?? null,
                    'linked_ticket_code' => $data['linked_ticket_code'] ?? null,
                ]));
                $this->notify($ticket, 'Progress update: '.$data['note']);
            }
            if ($action === 'delay') {
                $details = [];
                foreach (['delay_reason', 'actions_taken', 'assistance_required', 'next_update_at'] as $key) $details[$key] = $this->need($data, $key);
                $note = $this->need($data, 'note');
                $this->activity($ticket, $actor, 'delay', $note, $details);
                $this->notify($ticket, 'Delay / revised estimate: '.$note.'. Reason: '.$details['delay_reason'].'. Next update: '.$details['next_update_at']);
            }
            if ($action === 'reopen' && !in_array($oldStatus, ['closed', 'resolved']) && empty($ticket->sla_state['workaround_accepted_at'])) {
                throw ValidationException::withMessages(['action' => 'Only resolved, closed or accepted-workaround tickets can be reopened.']);
            }
            if (in_array($action, ['acknowledge', 'update', 'delay', 'restore', 'approve_workaround'])) {
                $state['last_update_at'] = $this->stamp();
                unset($state['alerts']['progress']);
            }
            $currentTarget = $ticket->sla_policy['targets'][$ticket->priority ?? ''] ?? null;
            if ($currentTarget && !empty($state['acknowledged_at']) && empty($state['response_result'])) {
                $state['response_result'] = ['target' => $currentTarget['response'],
                    'elapsed' => $clock->seconds($ticket->sla_received_at, $state['acknowledged_at'])];
            }
            if ($currentTarget && (!empty($state['resolved_at']) || !empty($state['workaround_accepted_at'])) && empty($state['resolution_result'])) {
                $state['resolution_result'] = ['target' => $currentTarget['resolution'], 'elapsed' => $state['elapsed']];
            }
            $ticket->sla_state = $state;
        } elseif (!in_array($action, ['save', 'update', 'reopen'])) {
            throw ValidationException::withMessages(['action' => 'Existing tickets are excluded from SLA tracking.']);
        }
        if ($desired !== $oldStatus) {
            $this->activity($ticket, $actor, 'status_changed', $data['note'] ?? 'Status updated.', ['from' => $oldStatus, 'to' => $desired]);
            if (!$clock) $this->notify($ticket, 'Status changed to '.str_replace('_', ' ', $desired));
        }
        $ticket->status = $desired;
        if ($desired === 'closed') $ticket->closed_at = now();
        elseif ($oldStatus === 'closed') $ticket->closed_at = null;
        $ticket->save();
        // P1/P2 escalation is independent of the resolution warning threshold.
        if ($oldPriority !== $ticket->priority && in_array($ticket->priority, ['critical', 'high'])) {
            $this->activity($ticket, $actor, 'escalated', 'Supervisor notified of '.$ticket->priority.' priority.');
            $this->notify($ticket, 'Priority escalation: '.($ticket->sla_policy['targets'][$ticket->priority ?? '']['label'] ?? $ticket->priority), true);
        }
    }

    public function check(Ticket $ticket): void
    {
        if (!$ticket->sla_policy) return;
        $view = $this->snapshot($ticket);
        $state = $ticket->sla_state;
        $originalState = $state;
        if (!$ticket->priority) return; // Accumulate time, but never invent a deadline for Not Set.
        $cycle = $ticket->priority.':'.($state['reopen_count'] ?? 0);
        $alerts = [];
        if (!$view['resolution_complete'] && $view['resolution_remaining'] <= $view['resolution_target'] * $ticket->sla_policy['warning_remaining']) {
            $alerts['warning:'.$cycle] = $view['resolution_remaining'] < 0 ? 'Resolution SLA is overdue.' : 'Only 20% or less of the resolution allowance remains.';
        }
        foreach (['response', 'resolution'] as $metric) {
            if ($view[$metric.'_status'] === 'Breached') {
                $state[$metric.'_ever_breached'] = true;
                $alerts[$metric.'_breach:'.$cycle] = ucfirst($metric).' SLA target breached.';
            }
        }
        $interval = $ticket->sla_policy['targets'][$ticket->priority ?? '']['update'];
        if ($interval && !in_array($ticket->status, ['resolved', 'closed'])
            && (new SupportClock($ticket->sla_policy))->seconds($state['last_update_at'], now()) >= $interval) {
            $alerts['progress'] = 'A requester progress update is due.';
        }
        foreach ($alerts as $key => $message) {
            // check() runs under a row lock; persisting alert markers in the same
            // transaction as database notifications prevents duplicate scheduler alerts.
            if (!empty($state['alerts'][$key])) continue;
            $state['alerts'][$key] = $this->stamp();
            $this->activity($ticket, null, 'sla_alert', $message, ['key' => $key]);
            $this->notify($ticket, $message, true);
        }
        if ($state !== $originalState) {
            $ticket->sla_state = $state;
            $ticket->save();
        }
    }
}
