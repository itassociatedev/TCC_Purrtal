<?php

namespace App\Services;

use App\Models\Ticket;

class TicketLeaderboard
{
    public function summary(bool $preview, string $period = 'all', ?int $memberId = null, ?string $detail = null, int $page = 1, bool $exporting = false): array
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
        // Start from the roster so IT staff with zero resolutions still appear.
        $members = TicketAccess::members($preview)->with(['role', 'branches', 'branch'])->get();
        $rows = $members->mapWithKeys(fn ($u) => [$u->id => ['id' => $u->id, 'name' => $u->name, 'role' => $u->role?->name, 'branches' => $u->branches->pluck('name')->push($u->branch?->name)->filter()->unique()->sort()->implode(', '), 'resolved' => 0, 'overdue' => 0, 'rating_count' => 0, 'rating_average' => null, 'sla_response_average' => null, 'sla_resolution_average' => null, 'sla_response_count' => 0, 'sla_resolution_count' => 0]])->all();
        abort_if($memberId !== null && !isset($rows[$memberId]), 404);
        $detailMember = $memberId !== null ? $rows[$memberId] : null;
        $entries = [];
        $eligibleTickets = Ticket::where('is_preview', $preview)->whereNotIn('status', Ticket::REVIEW_HOLD_STATUSES);
        $tickets = (clone $eligibleTickets)->with(['activities' => fn ($q) => $q->where('type', 'resolved')])->get();
        $sla = app(TicketSla::class);
        $slaTotals = [];
        foreach ($tickets as $ticket) {
            if (in_array($ticket->status, ['resolved', 'closed'])) {
                // Actual resolver gets credit, even when assignment later changes.
                // Count each currently completed ticket once; reopened work is excluded.
                $resolver = $ticket->sla_state['resolved_by'] ?? $ticket->activities->first()?->actor_id;
                $resolvedAt = $ticket->sla_state['resolved_at'] ?? $ticket->activities->first()?->created_at;
                if (isset($rows[$resolver]) && $within($resolvedAt)) {
                    $rows[$resolver]['resolved']++;
                    // Use the same completed-ticket cohort and recorded resolver as the ranking.
                    // Missing milestones are excluded, not counted as zero-second results.
                    $snapshot = $sla->snapshot($ticket);
                    foreach (['response', 'resolution'] as $metric) {
                        if (!($snapshot['enabled'] ?? false) || !($snapshot[$metric.'_complete'] ?? false)) continue;
                        $seconds = $snapshot[$metric.'_elapsed'] ?? null;
                        if (!is_numeric($seconds) || $seconds < 0) continue;
                        $slaTotals[$resolver][$metric] = ($slaTotals[$resolver][$metric] ?? 0) + $seconds;
                        $rows[$resolver]['sla_'.$metric.'_count']++;
                    }
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
        $feedback = \App\Models\TicketActivity::whereIn('ticket_id', (clone $eligibleTickets)->select('id'))
            ->where('type', 'feedback')->latest('id')->get()->unique('ticket_id')->filter(fn ($event) => $within($event->created_at));
        $ratingTotals = [];
        $ticketSubjects = $detail === 'ratings' ? $tickets->pluck('subject', 'id') : collect();
        $ticketCodes = $detail === 'ratings' ? $tickets->pluck('ticket_code', 'id') : collect();
        $ratingTickets = $detail === 'ratings' && !$exporting ? $tickets->keyBy('id') : collect();
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
                if (!$exporting) $entries[array_key_last($entries)]['ticket'] = $ratingTickets->get($event->ticket_id);
            }
        }
        foreach ($ratingTotals as $resolver => $sum) $rows[$resolver]['rating_average'] = round($sum / $rows[$resolver]['rating_count'], 1);
        foreach ($rows as $resolver => &$row) {
            foreach (['response', 'resolution'] as $metric) {
                $count = $row['sla_'.$metric.'_count'];
                $row['sla_'.$metric.'_average'] = $count ? round($slaTotals[$resolver][$metric] / $count, 2) : null;
            }
        }
        unset($row);
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
            'detail' => $detailMember && $detail ? $this->detailPage($detailMember, $detail, $entries, $page, $sla, $exporting) : null];
    }

    private function detailPage(array $member, string $type, array $entries, int $page, TicketSla $sla, bool $exporting): array
    {
        // Collect drill-down rows in the same branches as the totals so the
        // selected date range, resolver attribution and overdue logic cannot drift.
        $timestamp = fn ($entry) => $entry['at'] ? \Carbon\CarbonImmutable::parse($entry['at'])->timestamp : 0;
        usort($entries, fn ($a, $b) => ($timestamp($b) <=> $timestamp($a)) ?: (($b['id'] ?? $b['ticket']->id) <=> ($a['id'] ?? $a['ticket']->id)));
        $total = count($entries);
        $lastPage = max(1, (int) ceil($total / 15));
        $page = min(max(1, $page), $lastPage);
        if (!$exporting) $entries = array_slice($entries, ($page - 1) * 15, 15);
        if ($type !== 'ratings' || !$exporting) {
            $relations = ['branch:id,name', 'ticketLocation:id,name', 'assignee:id,name'];
            // The editor needs ticket history, while the workbook only needs row data.
            if (!$exporting) $relations = array_merge($relations, ['activities.actor:id,name', 'creator:id,name,role_id']);
            (new \Illuminate\Database\Eloquent\Collection(array_filter(array_column($entries, 'ticket'))))->load($relations);
            if (!$exporting) {
                foreach ($entries as $entry) {
                    if (!$entry['ticket']) continue;
                    $entry['ticket']->setAttribute('sla', $sla->snapshot($entry['ticket']));
                    $entry['ticket']->setAttribute('member_submission', $entry['ticket']->isMemberSubmission());
                }
            }
        }
        foreach ($entries as &$entry) $entry['at'] = $entry['at'] ? \Carbon\CarbonImmutable::parse($entry['at'])->toIso8601String() : null;
        unset($entry);
        return ['member' => ['id' => $member['id'], 'name' => $member['name']], 'type' => $type,
            'entries' => $entries, 'total' => $total, 'page' => $page, 'last_page' => $lastPage];
    }

    public function export(array $data, bool $preview)
    {
        if (!empty($data['detail'])) return $this->exportDetail($data);

        $rows = [['Rank', 'Employee', 'Role', 'Branches', 'Resolved tickets', 'Contribution (%)', 'Average rating / 5', 'Rated tickets', 'Overdue tickets', 'Average response (support minutes)', 'Average resolution (support minutes)', 'Response samples', 'Resolution samples']];
        foreach ($data['members'] as $member) $rows[] = [$member['rank'], $member['name'], $member['role'], $member['branches'], $member['resolved'], number_format($member['percentage'], 2, '.', ''), $member['rating_average'] ?? 'Not rated yet', $member['rating_count'], $member['overdue'], isset($member['sla_response_average']) ? round($member['sla_response_average'] / 60, 2) : 'N/A', isset($member['sla_resolution_average']) ? round($member['sla_resolution_average'] / 60, 2) : 'N/A', $member['sla_response_count'], $member['sla_resolution_count']];
        return app(TicketWorkbook::class)->download([
            'Leaderboard' => $rows,
            'Scope' => [['Setting', 'Value'], ['Period', $data['period']], ['From', $data['from'] ?? 'All time'], ['As of', $data['to']], ['Environment', $preview ? 'Preview' : 'Live'],
                ['Resolved date', 'Latest resolution date; currently resolved/closed tickets only'], ['Ratings date', 'Feedback submission date; latest feedback per ticket'], ['Overdue date', 'Ticket creation date; currently open overdue assignments'], ['Total resolved', $data['total_resolved']], ['SLA averages', 'Support time on currently resolved/closed tickets resolved in the selected period; credited to resolver; missing milestones excluded'], ['Other table filters', 'Do not apply to leaderboard']],
        ], 'tcc-it-leaderboard-'.$data['period'].'-'.now('Asia/Manila')->format('Ymd-His').'.xlsx');
    }

    private function exportDetail(array $data)
    {
        $detail = $data['detail'];
        $type = $detail['type'];
        $title = match ($type) {
            'ratings' => 'Ratings and comments',
            'resolved' => 'Resolved tickets',
            'overdue' => 'Overdue tickets',
        };
        $rows = $type === 'ratings'
            ? [['Ticket ID', 'Subject', 'Rating / 5', 'Comment', 'Submitted']]
            : [['Ticket ID', 'Subject', 'Status', 'Location', 'Assigned to', $type === 'resolved' ? 'Resolved' : 'Created']];

        foreach ($detail['entries'] as $entry) {
            if ($type === 'ratings') {
                $rows[] = [$entry['ticket_code'], $entry['subject'], $entry['rating'], $entry['comment'], $entry['at']];
            } else {
                $ticket = $entry['ticket'];
                $rows[] = [$ticket->ticket_code, $ticket->subject, ucfirst(str_replace('_', ' ', $ticket->status)),
                    $ticket->affectedLocationName(), $ticket->assignee?->name, $entry['at']];
            }
        }

        return app(TicketWorkbook::class)->download([
            $title => $rows,
            'Scope' => [['Setting', 'Value'], ['Employee', $detail['member']['name']], ['View', $title],
                ['Period', $data['period']], ['From', $data['from'] ?? 'All time'], ['As of', $data['to']], ['Matches', $detail['total']]],
        ], 'tcc-it-leaderboard-'.$detail['member']['id'].'-'.$type.'-'.$data['period'].'-'.now('Asia/Manila')->format('Ymd-His').'.xlsx');
    }

}
