<?php

namespace App\Services;

use App\Models\{Ticket, User};
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class TicketDemoFactory
{
    // Move backwards through the approved support windows so at-risk and breach
    // samples remain meaningful whenever the local reset command is run.
    private function earlier(CarbonImmutable $end, int $seconds): CarbonImmutable
    {
        $cursor = $end->setTimezone('Asia/Manila');
        while (true) {
            $open = $cursor->setTime(7, 30);
            $close = $cursor->setTime(19, 0);
            if ($cursor > $close) $cursor = $close;
            if ($cursor <= $open) {
                $cursor = $cursor->subDay()->setTime(19, 0);
                continue;
            }
            $available = $cursor->timestamp - $open->timestamp;
            if ($seconds <= $available) return $cursor->subSeconds($seconds);
            $seconds -= $available;
            $cursor = $cursor->subDay()->setTime(19, 0);
        }
    }

    private function freeze($at): void
    {
        Carbon::setTestNow($at);
        CarbonImmutable::setTestNow($at);
    }

    public function make(User $creator, ?User $owner, ?User $leader, string $scenario, bool $preview = true): Ticket
    {
        $actual = CarbonImmutable::now();
        $oldCarbon = Carbon::getTestNow();
        $oldImmutable = CarbonImmutable::getTestNow();
        $sla = app(TicketSla::class);
        $age = match ($scenario) { 'at_risk' => 12240, 'breached' => 18000, 'reopened' => 14400, default => 10800 };
        $received = $scenario === 'new' ? $actual : $this->earlier($actual, $age);
        $clock = new SupportClock(config('ticket-sla'));
        $at = fn ($seconds) => CarbonImmutable::parse($clock->deadline($received, $seconds));
        $titles = [
            'new' => 'New request — workstation setup', 'active' => 'Application access disruption',
            'resolved' => 'Reception printer restored', 'closed' => 'Approved account access completed',
            'paused' => 'Diagnostic workstation — waiting for vendor', 'at_risk' => 'Branch network outage — nearing SLA target',
            'breached' => 'Essential service interruption — SLA exceeded', 'workaround' => 'Backup internet accepted — permanent repair pending',
            'reopened' => 'Intermittent connectivity returned after closure',
        ];
        try {
            $this->freeze($received);
            $branches = TicketAccess::branches($creator)->orderBy('name')->get();
            $branch = $branches->firstWhere('id', $creator->branch_id) ?? $branches->first();
            if (!$branch) throw new \RuntimeException("No permitted branch for {$creator->name}.");
            $it = TicketAccess::role($creator) !== 'employee';
            $ticket = Ticket::create([
                'creator_id' => $creator->id, 'employee_name' => $creator->name,
                'employee_department' => $creator->department?->name ?: ($it ? 'Information Technology' : 'Clinic Operations'),
                'branch_id' => $branch->id, 'subject' => '[Demo] '.$titles[$scenario],
                'description' => "SLA demonstration: {$titles[$scenario]}. Reported at {$branch->name}. This ticket is sample data for testing.",
                'category' => in_array($scenario, ['at_risk', 'breached', 'workaround', 'reopened']) ? 'Network' : 'Hardware',
                'affected_asset' => in_array($scenario, ['at_risk', 'breached', 'workaround', 'reopened']) ? 'Branch network and operational applications' : 'Reception workstation / printer',
                'operational_impact' => 'Sample operational impact: access or printing delays affecting clinic workflows.',
                'supporting_links' => [],
                'assigned_to' => $scenario === 'new' && !$it ? null : $owner?->id,
                'reporting_channel' => $it ? 'viber' : 'portal',
                'emergency_reason' => $it ? 'Sample emergency: the portal could not be reached when IT was notified.' : null,
                'is_preview' => $preview,
            ]);
            $sla->enroll($ticket, $creator, $received);
            if ($scenario !== 'new') {
                if (!$owner || !$leader) throw new \RuntimeException('Demo workflow requires an IT member and team leader.');
                $priority = match ($scenario) { 'at_risk', 'breached', 'workaround' => 'critical', 'active', 'reopened' => 'high', 'closed' => 'low', default => 'medium' };
                $sla->apply($ticket, $leader, 'leader', ['priority' => $priority, 'priority_reason' => 'Sample classification based on operational impact.']);
                $this->freeze($at(300));
                $sla->apply($ticket, $owner, 'member', ['action' => 'acknowledge', 'assessment' => 'Issue assessed; affected operations identified.', 'next_steps' => 'Investigate connectivity, test the device and communicate findings.']);
                $docs = ['status' => 'resolved', 'findings' => 'Sample configuration issue identified.',
                    'troubleshooting_performed' => 'Verified settings and tested the affected service.',
                    'corrective_actions' => 'Applied corrected settings and verified connectivity.',
                    'resolution_details' => 'Service restored and verified with the requester.'];
                if (in_array($scenario, ['resolved', 'closed', 'reopened'])) {
                    $this->freeze($at(3600));
                    $sla->apply($ticket, $owner, 'member', $docs);
                    if ($scenario !== 'resolved') {
                        $this->freeze($at(3900));
                        $sla->apply($ticket, $leader, 'leader', ['status' => 'closed', 'note' => 'Requester confirmation documented; closed by the IT leader.']);
                    }
                    if ($scenario === 'reopened') {
                        $this->freeze($at(10800));
                        $sla->apply($ticket, $owner, 'member', ['action' => 'reopen', 'note' => 'Issue returned; continuing the original SLA allowance.']);
                    }
                }
                if ($scenario === 'paused') {
                    $this->freeze($at(3600));
                    $sla->apply($ticket, $owner, 'member', ['action' => 'pause', 'pause_reason' => 'vendor', 'note' => 'Awaiting the vendor technical assessment; requester informed.']);
                }
                if ($scenario === 'workaround') {
                    $this->freeze($at(3600));
                    $sla->apply($ticket, $leader, 'leader', ['action' => 'approve_workaround', 'workaround' => 'Backup connectivity restored essential operations.', 'recovery_plan' => 'Coordinate the primary connection repair and test the permanent fix.']);
                }
                $this->freeze($actual);
                $sla->check($ticket);
            }
            return $ticket->fresh();
        } finally {
            Carbon::setTestNow($oldCarbon);
            CarbonImmutable::setTestNow($oldImmutable);
        }
    }

    public function seedPreview(): int
    {
        $users = User::whereIn('id', DB::table('ticket_preview_users')->select('user_id'))->orderBy('id')->get();
        $members = $users->filter(fn ($u) => TicketAccess::role($u) === 'member')->values();
        $leader = $users->first(fn ($u) => TicketAccess::role($u) === 'leader');
        if ($members->isEmpty() || !$leader) throw new \RuntimeException('Create preview IT leader/member accounts first.');
        $count = 0;
        $employees = $users->filter(fn ($u) => TicketAccess::role($u) === 'employee')->values();
        foreach ($employees as $index => $employee) {
            if (Ticket::where('creator_id', $employee->id)->where('is_preview', true)->whereNotNull('sla_policy')->exists()) continue;
            foreach (['new', 'active', 'resolved', 'closed'] as $offset => $scenario) {
                $this->make($employee, $members[($index + $offset) % $members->count()], $leader, $scenario);
                $count++;
            }
        }
        if ($employees->isNotEmpty() && $count > 0) {
            foreach (['paused', 'at_risk', 'breached', 'workaround', 'reopened'] as $index => $scenario) {
                $this->make($employees->first(), $members[$index % $members->count()], $leader, $scenario);
                $count++;
            }
        }
        foreach ($users->filter(fn ($u) => TicketAccess::role($u) !== 'employee') as $it) {
            if (Ticket::where('creator_id', $it->id)->where('is_preview', true)->whereNotNull('sla_policy')->exists()) continue;
            $this->make($it, $it, $leader, 'new');
            $count++;
        }
        return $count;
    }
}
