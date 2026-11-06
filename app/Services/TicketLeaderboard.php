<?php

namespace App\Services;

use App\Models\Ticket;

class TicketLeaderboard
{
    public function summary(bool $preview, string $period = 'all', ?int $memberId = null, ?string $detail = null, int $page = 1): array
    {
        if (!in_array($period, ['day', 'week', 'month', 'year', 'all'], true)) throw new \InvalidArgumentException('Invalid leaderboard period.');
        $end = \Carbon\CarbonImmutable::now('Asia/Manila');
        $start = match ($period) {
            'day' => $end->startOfDay(), 'week' => $end->startOfWeek(),
            'month' => $end->startOfMonth(), 'year' => $end->startOfYear(), default => null,
        };
        // Resolution instants in SLA JSON are UTC; Eloquent activity/creation dates
        // carry the application timezone. Compare actual instants in Manila.
        $within = fn ($date) => !$start || ($date && \Carbon\CarbonImmutable::parse($date)->betweenIncluded($start, $end));
        // Start from the roster so members with zero resolutions still appear.
        $members = TicketAccess::members($preview)->with(['role', 'branches', 'branch'])->get()->filter(fn ($u) => TicketAccess::role($u) === 'member');
        $rows = $members->mapWithKeys(fn ($u) => [$u->id => ['id' => $u->id, 'name' => $u->name, 'role' => $u->role?->name, 'branches' => $u->branches->pluck('name')->push($u->branch?->name)->filter()->unique()->sort()->implode(', '), 'resolved' => 0, 'overdue' => 0, 'rating_count' => 0, 'rating_average' => null]])->all();
        abort_if($memberId !== null && !isset($rows[$memberId]), 404);
        $detailMember = $memberId !== null ? $rows[$memberId] : null;
        $entries = [];
        $tickets = Ticket::where('is_preview', $preview)->with(['activities' => fn ($q) => $q->where('type', 'resolved')])->get();
        $sla = app(TicketSla::class);
        foreach ($tickets as $ticket) {
            if (in_array($ticket->status, ['resolved', 'closed'])) {
                // Actual resolver gets credit, even when assignment later changes.
                // Count each currently completed ticket once; reopened work is excluded.
                $resolver = $ticket->sla_state['resolved_by'] ?? $ticket->activities->first()?->actor_id;
                $resolvedAt = $ticket->sla_state['resolved_at'] ?? $ticket->activities->first()?->created_at;
                if (isset($rows[$resolver]) && $within($resolvedAt)) {
                    $rows[$resolver]['resolved']++;
                    if ($detail === 'resolved' && (int) $resolver === $memberId) $entries[] = ['ticket' => $ticket, 'at' => $resolvedAt];
                }
            } elseif (isset($rows[$ticket->assigned_to]) && $within($ticket->created_at)) {
                $snapshot = $sla->snapshot($ticket);
                if (($snapshot['enabled'] ?? false) && !$snapshot['resolution_complete'] && $snapshot['resolution_status'] === 'Breached') {
                    $rows[$ticket->assigned_to]['overdue']++;
                    if ($detail === 'overdue' && (int) $ticket->assigned_to === $memberId) $entries[] = ['ticket' => $ticket, 'at' => $ticket->created_at];
                }
            }
        }
        // Same attribution as dashboard ratings: latest feedback per ticket,
        // frozen resolver or preceding resolution actor; never current assignee.
        $feedback = \App\Models\TicketActivity::whereIn('ticket_id', Ticket::where('is_preview', $preview)->select('id'))
            ->where('type', 'feedback')->latest('id')->get()->unique('ticket_id')->filter(fn ($event) => $within($event->created_at));
        $ratingTotals = [];
        $ticketSubjects = $detail === 'ratings' ? $tickets->pluck('subject', 'id') : collect();
        $ticketCodes = $detail === 'ratings' ? $tickets->pluck('ticket_code', 'id') : collect();
        foreach ($feedback as $event) {
            $resolver = $event->details['resolved_by'] ?? \App\Models\TicketActivity::where('ticket_id', $event->ticket_id)
                ->where('type', 'resolved')->where('id', '<', $event->id)->latest('id')->value('actor_id');
            $rating = $event->details['rating'] ?? null;
            if (!isset($rows[$resolver]) || !is_numeric($rating) || $rating < 0.5 || $rating > 5) continue;
            $ratingTotals[$resolver] = ($ratingTotals[$resolver] ?? 0) + (float) $rating;
            $rows[$resolver]['rating_count']++;
            if ($detail === 'ratings' && (int) $resolver === $memberId) {
                // Blank comments are stored as a generated activity message in older rows.
                $comment = preg_match('/^Requester submitted a support rating of [0-9.]+\/5\.$/', $event->message) ? null : $event->message;
                $entries[] = ['id' => $event->id, 'ticket_id' => $event->ticket_id, 'ticket_code' => $ticketCodes->get($event->ticket_id), 'subject' => $ticketSubjects->get($event->ticket_id),
                    'rating' => (float) $rating, 'comment' => $comment, 'at' => $event->created_at];
            }
        }
        foreach ($ratingTotals as $resolver => $sum) $rows[$resolver]['rating_average'] = round($sum / $rows[$resolver]['rating_count'], 1);
        $total = array_sum(array_column($rows, 'resolved'));
        $rows = array_values($rows);
        usort($rows, fn ($a, $b) => ($b['resolved'] <=> $a['resolved']) ?: strcasecmp($a['name'], $b['name']) ?: ($a['id'] <=> $b['id']));
        $rank = 0; $last = null;
        foreach ($rows as $index => &$row) {
            if ($last !== $row['resolved']) $rank = $index + 1;
            $last = $row['resolved'];
            $row['rank'] = $rank;
            $row['percentage'] = $total ? round($row['resolved'] / $total * 100, 2) : 0;
        }
        unset($row);
        return ['members' => $rows, 'total_resolved' => $total, 'period' => $period, 'from' => $start?->toIso8601String(), 'to' => $end->toIso8601String(),
            'detail' => $detailMember && $detail ? $this->detailPage($detailMember, $detail, $entries, $page, $sla) : null];
    }

    private function detailPage(array $member, string $type, array $entries, int $page, TicketSla $sla): array
    {
        // Collect drill-down rows in the same branches as the totals so the
        // selected date range, resolver attribution and overdue logic cannot drift.
        $timestamp = fn ($entry) => $entry['at'] ? \Carbon\CarbonImmutable::parse($entry['at'])->timestamp : 0;
        usort($entries, fn ($a, $b) => ($timestamp($b) <=> $timestamp($a)) ?: (($b['id'] ?? $b['ticket']->id) <=> ($a['id'] ?? $a['ticket']->id)));
        $total = count($entries);
        $lastPage = max(1, (int) ceil($total / 15));
        $page = min(max(1, $page), $lastPage);
        $entries = array_slice($entries, ($page - 1) * 15, 15);
        if ($type !== 'ratings') {
            // Load full history only for the visible rows so the existing editor can open them.
            (new \Illuminate\Database\Eloquent\Collection(array_column($entries, 'ticket')))->load(['branch:id,name', 'assignee:id,name', 'activities.actor:id,name']);
            foreach ($entries as &$entry) $entry['ticket']->setAttribute('sla', $sla->snapshot($entry['ticket']));
            unset($entry);
        }
        foreach ($entries as &$entry) $entry['at'] = $entry['at'] ? \Carbon\CarbonImmutable::parse($entry['at'])->toIso8601String() : null;
        unset($entry);
        return ['member' => ['id' => $member['id'], 'name' => $member['name']], 'type' => $type,
            'entries' => $entries, 'total' => $total, 'page' => $page, 'last_page' => $lastPage];
    }

    public function export(array $data, bool $preview)
    {
        $rows = [['Rank', 'Employee', 'Role', 'Branches', 'Resolved tickets', 'Contribution (%)', 'Average rating / 5', 'Rated tickets', 'Overdue tickets']];
        foreach ($data['members'] as $member) $rows[] = [$member['rank'], $member['name'], $member['role'], $member['branches'], $member['resolved'], number_format($member['percentage'], 2, '.', ''), $member['rating_average'] ?? 'Not rated yet', $member['rating_count'], $member['overdue']];
        return app(TicketWorkbook::class)->download([
            'Leaderboard' => $rows,
            'Scope' => [['Setting', 'Value'], ['Period', $data['period']], ['From', $data['from'] ?? 'All time'], ['As of', $data['to']], ['Environment', $preview ? 'Preview' : 'Live'],
                ['Resolved date', 'Latest resolution date; currently resolved/closed tickets only'], ['Ratings date', 'Feedback submission date; latest feedback per ticket'], ['Overdue date', 'Ticket creation date; currently open overdue assignments'], ['Total resolved', $data['total_resolved']], ['Other table filters', 'Do not apply to leaderboard']],
        ], 'tcc-it-leaderboard-'.$data['period'].'-'.now('Asia/Manila')->format('Ymd-His').'.xlsx');
    }

}
