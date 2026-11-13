<?php

namespace App\Http\Controllers;

use App\Models\{Branch, Ticket, TicketAssignmentHandover, TicketLocation, User};
use App\Notifications\TicketNotification;
use App\Services\TicketAccess;
use App\Services\TicketSla;
use App\Services\TicketPrioritySettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Notification};
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class TicketController extends Controller
{
    // The ticket module uses the authenticated account. Keep legacy preview data isolated.
    private function context(Request $request): array
    {
        return [$request->user(), false];
    }

    private function feedbackResolverId(Ticket $ticket): ?int
    {
        // Attribute feedback to the recorded resolver, never the current assignee.
        $id = $ticket->sla_state['resolved_by'] ?? ($ticket->relationLoaded('activities')
            ? $ticket->activities->firstWhere('type', 'resolved')?->actor_id
            : $ticket->activities()->where('type', 'resolved')->value('actor_id'));
        return $id ? (int) $id : null;
    }

    public function index(Request $request)
    {
        [$actor, $preview] = $this->context($request);
        $role = TicketAccess::role($actor);
        // Export is an IT workflow permission, including when using a preview identity.
        abort_if($role === 'employee' && $request->routeIs('tickets.export'), 403, 'Only IT members and leaders may export tickets.');
        // Older bookmarks still select Critical.
        if ($request->input('priority_filter') === 'urgent') $request->merge(['priority_filter' => 'critical']);
        if ($request->input('priority_filter') === 'not_set') $request->merge(['priority_filter' => 'low']);
        if ($request->input('status_filter') === 'priority_not_set') {
            $request->merge(['status_filter' => 'open', 'priority_filter' => 'low']);
        }
        $filters = $request->validate([
            'view' => ['nullable', Rule::in(['leaderboard', 'dashboard', 'open', 'closed', 'all', 'assigned', 'reports', 'revisions'])],
            'location_filter' => ['nullable', 'integer', Rule::exists('ticket_locations', 'id')],
            'branch_filter' => ['nullable', 'integer', Rule::exists('branches', 'id')],
            'assignee_filter' => ['nullable', 'integer', 'min:1', Rule::prohibitedIf($role === 'employee')],
            'priority_filter' => ['nullable', Rule::in(array_merge(['all'], array_keys(TicketPrioritySettings::targets())))],
            'status_filter' => ['nullable', Rule::in(['all', 'open', 'closed', 'not_started', 'in_progress', 'resolved', 'unassigned', 'revision_requested', 'rejected'])],
            'closed_period' => ['nullable', Rule::in(['day', 'week', 'month', 'year'])],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d', ...($request->filled('date_from') ? ['after_or_equal:date_from'] : [])],
            'search' => ['nullable', 'string', 'max:180'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', Rule::in(['5', '10', '15', 'all'])],
            'sort' => ['nullable', Rule::in(['subject', 'description', 'category', 'status', 'created_at', 'priority', 'branch', 'creator', 'assignee'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'leaderboard_member' => ['nullable', 'required_with:leaderboard_detail', 'integer', 'min:1'],
            'leaderboard_detail' => ['nullable', 'required_with:leaderboard_member', Rule::in(['resolved', 'overdue', 'ratings'])],
            'leaderboard_page' => ['nullable', 'integer', 'min:1'],
            'leaderboard_period' => ['nullable', Rule::in(['all', 'day', 'week', 'month', 'year'])],
            'report_period' => ['nullable', Rule::in(['all', 'day', 'week', 'month', 'quarter'])],
        ]);
        // Enforce role-specific views on the server; hiding React tabs alone is insufficient.
        // Employees and members land on their dashboard; explicit ticket views take precedence.
        $view = $request->route()?->defaults['ticket_view'] ?? $filters['view'] ?? match ($role) {
            'leader' => 'dashboard',
            'member' => 'dashboard',
            default => 'dashboard',
        };
        abort_if($role === 'employee' && !in_array($view, ['dashboard', 'all', 'open', 'closed']), 403);
        abort_if($role === 'member' && !in_array($view, ['dashboard', 'all', 'assigned', 'revisions']), 403);
        abort_if($view === 'revisions' && $role !== 'member', 403);
        abort_if(in_array($view, ['admin', 'locations', 'handover', 'sla_settings'], true) && $role !== 'leader', 403);
        if ($request->routeIs('tickets.locations')) return redirect()->route('tickets.admin');
        if ($request->routeIs('tickets.handover')) return redirect()->route('tickets.admin.handover');
        abort_if($view === 'leaderboard' && $role !== 'leader', 403);
        // Leaders can also view their own assignments.
        // Old report bookmarks now show the persistent statistics panel and open table.
        // Normalize only after authorization so other roles cannot access leader views.
        if ($role === 'leader' && $view === 'reports') $view = 'open';
        // Keep old screen paths as bookmarks, but show status in the list filter.
        $legacyStatusView = in_array($view, ['open', 'closed'], true);
        if ($legacyStatusView && $request->routeIs('tickets.open', 'tickets.closed')) {
            $parameters = $filters;
            unset($parameters['view']);
            $parameters['status_filter'] = $view;
            return redirect()->route('tickets.all', $parameters);
        }
        // Remember the chosen size across views and refreshes. All still uses
        // the authorized, searched query rather than exposing other tickets.
        $perPage = (string) ($filters['per_page'] ?? $request->session()->get('tickets.per_page', '10'));
        $request->session()->put('tickets.per_page', $perPage);
        // Scope every list to live or preview data before applying other filters.
        // Eager loading prevents separate relationship queries for every table row.
        $query = Ticket::where('is_preview', $preview)->with(['creator:id,name,role_id', 'branch:id,name', 'ticketLocation:id,name', 'assignee:id,name', 'activities.actor:id,name']);
        if ($role === 'employee') $query->where('creator_id', $actor->id);
        // Employee summary ignores table filters, but always enforces identity and
        // live/preview isolation. Open includes resolved tickets awaiting closure.
        $employeeSummary = null;
        $memberSummary = null;
        $leaderSummary = null;
        if (in_array($role, ['employee', 'member', 'leader'])) {
            // Member dashboards count current assignments, not the team-wide ticket list.
            $summaryQuery = Ticket::where('is_preview', $preview);
            // Leaders oversee all tickets; employees and members retain personal scopes.
            if ($role !== 'leader') $summaryQuery->where($role === 'employee' ? 'creator_id' : 'assigned_to', $actor->id);
            $statusCounts = (clone $summaryQuery)->select('status')->selectRaw('COUNT(*) AS total')->groupBy('status')->pluck('total', 'status');
            $total = (int) $statusCounts->sum();
            $closed = (int) ($statusCounts['closed'] ?? 0);
            $summary = [
                'total' => $total, 'open' => $total - $closed - (int) ($statusCounts['rejected'] ?? 0), 'closed' => $closed,
                'not_started' => (int) ($statusCounts['not_started'] ?? 0),
                'in_progress' => (int) ($statusCounts['in_progress'] ?? 0),
                'resolved' => (int) ($statusCounts['resolved'] ?? 0),
            ];
        }
        // Priority dashboard counts use the same personal/team scope as status counts.
        $prioritySummary = null;
        if (in_array($role, ['member', 'leader'])) {
            $priorityCounts = (clone $summaryQuery)->select('priority')->selectRaw('COUNT(*) AS total')->groupBy('priority')->pluck('total', 'priority');
            $prioritySummary = [];
            foreach (array_keys(TicketPrioritySettings::targets()) as $priority) {
                $prioritySummary[$priority] = (int) ($priorityCounts[$priority] ?? 0);
            }
        }
        if ($role === 'employee') $employeeSummary = $summary;
        if ($role === 'member') $memberSummary = $summary;
        if ($role === 'leader') $leaderSummary = $summary;
        if ($role === 'member' && $view === 'dashboard') $query->where('assigned_to', $actor->id);
        if ($view === 'open') $query->whereNotIn('status', ['closed', 'rejected']);
        if ($view === 'closed') $query->where('status', 'closed');
        if ($view === 'revisions') $query->where('creator_id', $actor->id)->where('status', 'revision_requested');
        if ($view === 'assigned') $query->where('assigned_to', $actor->id);
        $canFilterByAssignee = $role !== 'employee' && $view === 'all';
        $assigneeFilter = $canFilterByAssignee ? ($filters['assignee_filter'] ?? null) : null;
        if ($assigneeFilter !== null) {
            $query->where('assigned_to', $assigneeFilter);
        } else {
            unset($filters['assignee_filter']);
        }
        // Narrow the authorized ticket query without changing creation permissions.
        $locationFilter = $filters['location_filter'] ?? null;
        if ($locationFilter !== null) $query->where('tickets.ticket_location_id', $locationFilter);
        $branchFilter = $filters['branch_filter'] ?? null;
        if ($branchFilter !== null) {
            $query->where('tickets.branch_id', $branchFilter);
        }
        $priorityFilter = $filters['priority_filter'] ?? 'all';
        if ($priorityFilter !== 'all') $query->where('priority', $priorityFilter);
        // Status is an additional filter on the authorized view, never a replacement
        // for creator, assignment, or preview restrictions.
        $statusFilter = $filters['status_filter'] ?? 'all';
        if ($legacyStatusView && $statusFilter === 'all') $statusFilter = $view;
        if ($statusFilter === 'open') $query->whereNotIn('status', ['closed', 'rejected']);
        elseif ($statusFilter === 'unassigned') {
            $query->whereIn('status', ['not_started', 'in_progress'])->whereNull('assigned_to');
        }
        elseif ($statusFilter !== 'all') $query->where('status', $statusFilter);
        // Closure drill-downs use closed_at, matching Ticket reports exactly.
        if (!empty($filters['closed_period'])) {
            $now = now('Asia/Manila');
            $start = match ($filters['closed_period']) {
                'day' => $now->copy()->startOfDay(), 'week' => $now->copy()->startOfWeek(),
                'month' => $now->copy()->startOfMonth(), 'year' => $now->copy()->startOfYear(),
            };
            $query->where('status', 'closed')->whereBetween('closed_at', [$start, $now]);
        }
        // created_at uses Laravel's application timezone (Asia/Manila).
        // Half-open boundaries include the whole end date and retain index use.
        if (!empty($filters['date_from'])) $query->where('created_at', '>=', \Illuminate\Support\Carbon::parse($filters['date_from'], config('app.timezone'))->startOfDay());
        if (!empty($filters['date_to'])) $query->where('created_at', '<', \Illuminate\Support\Carbon::parse($filters['date_to'], config('app.timezone'))->addDay()->startOfDay());
        if (!empty($filters['search'])) {
            // Group the OR search so it cannot bypass the role or preview filters.
            $query->where(fn ($q) => $q->where('subject', 'like', '%'.$filters['search'].'%')
                ->orWhere('description', 'like', '%'.$filters['search'].'%')
                ->orWhere('ticket_code', 'like', '%'.strtoupper($filters['search']).'%'));
        }
        // Reports cover the selected environment independently of table search.
        $reports = null;
        $memberWorkloads = [];
        $memberRating = null;
        $ratings = collect();
        if (in_array($role, ['leader', 'member'])) {
            // Attribute each latest ticket rating to its recorded resolver, never its current assignee.
            $ratings = \App\Models\TicketActivity::whereIn('ticket_id', Ticket::where('is_preview', $preview)->select('id'))
                ->where('type', 'feedback')->latest('id')->get()->unique('ticket_id')
                ->map(function ($event) {
                    $details = $event->details;
                    // Older feedback can be attributed only through a preceding
                    // resolution event. Never infer ownership from assignment.
                    $details['resolved_by'] ??= \App\Models\TicketActivity::where('ticket_id', $event->ticket_id)
                        ->where('type', 'resolved')->where('id', '<', $event->id)->latest('id')->value('actor_id');
                    $event->details = $details;
                    return $event;
                })->filter(fn ($event) => !empty($event->details['resolved_by']))->groupBy(fn ($event) => $event->details['resolved_by']);
            if ($role === 'member') {
                // Send only this member's aggregate, never other staff ratings.
                $ownRatings = $ratings->get($actor->id, collect());
                $memberRating = ['count' => $ownRatings->count(), 'average' => $ownRatings->avg(fn ($event) => $event->details['rating'])];
            }
        }
        if ($role === 'leader') {
            // Aggregate once for all members, including completed assignments.
            // Closed tickets retain resolution credit in this assignment-based summary.
            $counts = Ticket::where('is_preview', $preview)->whereNotNull('assigned_to')
                ->select('assigned_to')->selectRaw('COUNT(*) AS assigned_count')
                ->selectRaw("SUM(CASE WHEN status IN ('resolved', 'closed') THEN 1 ELSE 0 END) AS resolved_count")
                ->groupBy('assigned_to')->get()->keyBy('assigned_to');
            // Start from the member roster so members with no tickets still appear.
            $memberWorkloads = TicketAccess::members($preview)->orderBy('name')->get(['id', 'name'])
                ->map(fn ($member) => [
                    'rating_count' => $ratings->get($member->id, collect())->count(),
                    'rating_average' => $ratings->get($member->id, collect())->avg(fn ($event) => $event->details['rating']),
                    'id' => $member->id, 'name' => $member->name,
                    'assigned_count' => (int) ($counts->get($member->id)?->assigned_count ?? 0),
                    'resolved_count' => (int) ($counts->get($member->id)?->resolved_count ?? 0),
                ]);
            $now = now('Asia/Manila');
            // Aggregate current statuses once. Resolved remains distinct from manual
            // closure; action queues include only tickets still requiring IT work.
            $reportTickets = Ticket::where('is_preview', $preview);
            $statusCounts = (clone $reportTickets)->select('status')->selectRaw('COUNT(*) AS total')
                ->groupBy('status')->pluck('total', 'status');
            $activeTickets = (clone $reportTickets)->whereIn('status', ['not_started', 'in_progress']);
            $reports = [
                'Total tickets' => (int) $statusCounts->sum(),
                'Not started' => (int) ($statusCounts['not_started'] ?? 0),
                'In progress' => (int) ($statusCounts['in_progress'] ?? 0),
                'Resolved' => (int) ($statusCounts['resolved'] ?? 0),
                'Closed' => (int) ($statusCounts['closed'] ?? 0),
                'Unassigned active' => (clone $activeTickets)->whereNull('assigned_to')->count(),
            ];
            // Count closures by closed_at. Copies keep the shared current time unchanged.
            foreach (['Today' => $now->copy()->startOfDay(), 'This week' => $now->copy()->startOfWeek(),
                'This month' => $now->copy()->startOfMonth(), 'This year' => $now->copy()->startOfYear()] as $label => $start) {
                $reports['Closed · '.$label] = Ticket::where('is_preview', $preview)->where('status', 'closed')->whereBetween('closed_at', [$start, $now])->count();
            }
        }
        $sla = app(TicketSla::class);
        $slaReport = null;
        if ($role === 'leader') {
            $reportPeriod = $filters['report_period'] ?? 'all';
            $periodStart = match ($reportPeriod) {
                'day' => now('Asia/Manila')->startOfDay(),
                'week' => now('Asia/Manila')->startOfWeek(),
                'month' => now('Asia/Manila')->startOfMonth(),
                'quarter' => now('Asia/Manila')->startOfQuarter(),
                default => null,
            };
            $trackedQuery = Ticket::where('is_preview', $preview)->whereNotIn('status', Ticket::REVIEW_HOLD_STATUSES)->whereNotNull('sla_policy');
            if ($periodStart) $trackedQuery->where('sla_received_at', '>=', $periodStart->utc());
            $tracked = $trackedQuery->with(['branch:id,name', 'ticketLocation:id,name'])->get();
            $snapshots = $tracked->map(fn ($t) => $sla->snapshot($t));
            $responseEligible = $snapshots->filter(fn ($s) => $s['label'] !== 'Not Set' && ($s['response_complete'] || $s['response_status'] === 'Breached' || $s['response_ever_breached']));
            $resolutionEligible = $snapshots->filter(fn ($s) => $s['label'] !== 'Not Set' && ($s['resolution_complete'] || $s['resolution_status'] === 'Breached' || $s['resolution_ever_breached']));
            $slaReport = [
                'Tracked tickets' => $tracked->count(),
                'At risk' => $snapshots->where('resolution_status', 'At risk')->count(),
                'Overdue open' => $tracked->filter(function ($t) use ($sla) {
                    $s = $sla->snapshot($t);
                    return !in_array($t->status, ['closed', 'resolved']) && !$s['resolution_complete'] && $s['resolution_status'] === 'Breached';
                })->count(),
                // A later priority change must not remove recorded breaches from compliance.
                'Response compliance' => $responseEligible->isEmpty() ? 'N/A' : number_format($responseEligible->filter(fn ($s) => $s['response_status'] === 'Completed' && !$s['response_ever_breached'])->count() / $responseEligible->count() * 100, 2, '.', '').'%',
                'Resolution compliance' => $resolutionEligible->isEmpty() ? 'N/A' : number_format($resolutionEligible->filter(fn ($s) => $s['resolution_status'] === 'Completed' && !$s['resolution_ever_breached'])->count() / $resolutionEligible->count() * 100, 2, '.', '').'%',
                'Average response (support min)' => round($responseEligible->where('response_complete', true)->avg('response_elapsed') / 60, 1),
                'Average resolution (support min)' => round($resolutionEligible->where('resolution_complete', true)->avg('resolution_elapsed') / 60, 1),
                'Reopened tickets' => $snapshots->filter(fn ($s) => $s['reopen_count'] > 0)->count(),
                'Reopened (%)' => $tracked->isEmpty() ? 'N/A' : number_format($snapshots->filter(fn ($s) => $s['reopen_count'] > 0)->count() / $tracked->count() * 100, 2, '.', '').'%',
            ];
            foreach (TicketPrioritySettings::targets() as $priority => $policy) {
                $group = $tracked->where('priority', $priority)->map(fn ($t) => $sla->snapshot($t));
                $breaches = $group->filter(fn ($s) => $s['response_status'] === 'Breached' || $s['resolution_status'] === 'Breached'
                    || $s['response_ever_breached'] || $s['resolution_ever_breached'])->count();
                $slaReport[$policy['label'].' breaches'] = $breaches.' / '.$group->count();
            }
            $slaReport['Linked follow-up tickets'] = \App\Models\TicketActivity::whereIn('ticket_id', $tracked->pluck('id'))
                ->whereNotNull('details->linked_ticket_id')->distinct()->count('ticket_id');
            foreach ($tracked->whereNotIn('status', ['resolved', 'closed'])->groupBy(fn (Ticket $ticket) => $ticket->affectedLocationName() ?? 'Unknown location') as $locationName => $backlog) {
                $slaReport[$locationName.' open backlog'] = $backlog->count();
            }
        }
        // Validate the sort key above and use explicit columns/subqueries: no raw user SQL.
        $sort = $filters['sort'] ?? 'created_at';
        $direction = $filters['direction'] ?? 'desc';
        $sortColumn = match ($sort) {
            'branch' => DB::raw('COALESCE((SELECT name FROM ticket_locations WHERE id = tickets.ticket_location_id), (SELECT name FROM branches WHERE id = tickets.branch_id))'),
            'assignee' => User::select('name')->whereColumn('users.id', 'tickets.assigned_to')->limit(1),
            'creator' => 'employee_name',
            default => $sort,
        };
        if ($sort === 'priority') {
            $keys = array_keys(TicketPrioritySettings::targets());
            $cases = implode(' ', array_map(fn ($index) => 'WHEN ? THEN '.($index + 1), array_keys($keys)));
            $query->orderByRaw('CASE priority '.$cases.' ELSE 10001 END '.$direction, $keys);
        } else $query->orderBy($sortColumn, $direction);
        $query->orderBy('id', $direction); // Stable pagination when column values match.
        $exporting = $request->routeIs('tickets.export');
        $leaderboardData = $role === 'leader' && $view === 'leaderboard'
            ? app(\App\Services\TicketLeaderboard::class)->summary($preview, $filters['leaderboard_period'] ?? 'all',
                isset($filters['leaderboard_member']) ? (int) $filters['leaderboard_member'] : null,
                $filters['leaderboard_detail'] ?? null, (int) ($filters['leaderboard_page'] ?? 1), $exporting) : null;
        if ($leaderboardData && $exporting) {
            return app(\App\Services\TicketLeaderboard::class)->export($leaderboardData, $preview);
        }
        if ($request->routeIs('tickets.export')) {
            return app(\App\Services\TicketWorkbook::class)->export(clone $query, $reports ?? [], $slaReport ?? [], $memberWorkloads,
                ($leaderSummary ?? $memberSummary ?? $employeeSummary ?? []) + ($role === 'member' ? ['resolver_rating' => $memberRating['average'] ?? 'Not rated', 'rated_tickets' => $memberRating['count'] ?? 0] : []), $filters + ['view' => $view, 'status_filter' => $statusFilter], $role);
        }
        $pageSize = $perPage === 'all' ? max(1, (clone $query)->count()) : (int) $perPage;
        // Queue is independent of table pagination/filters and belongs only to the requester.
        $feedbackCandidates = Ticket::where('is_preview', $preview)->where('creator_id', $actor->id)->where('status', 'closed')
            ->whereDoesntHave('activities', fn ($q) => $q->whereIn('type', ['feedback', 'feedback_dismissed']))
            ->with(['activities' => fn ($q) => $q->where('type', 'resolved')])->orderBy('closed_at')->orderBy('id')->get();
        $resolverIds = $feedbackCandidates->map(fn ($ticket) => $this->feedbackResolverId($ticket))->filter()->unique();
        $resolvers = User::with('role')->whereKey($resolverIds->all())->get()->keyBy('id');
        $pendingFeedback = $feedbackCandidates->filter(function ($ticket) use ($actor, $resolvers) {
            $resolver = $resolvers->get($this->feedbackResolverId($ticket));
            return $resolver && TicketAccess::canRateResolver($actor, $resolver);
        })
            ->map(fn ($ticket) => ['id' => $ticket->id, 'subject' => $ticket->subject])->values();
        $canAssignDuringHandover = $role === 'member' && $actor->status === 'Active'
            && TicketAssignmentHandover::active()->where('member_id', $actor->id)->exists();
        return Inertia::render('Tickets/Index', [
            // One-time receipt after a successful non-IT submission; not an SLA acknowledgement.
            'submissionAcknowledgement' => $role === 'employee' ? $request->session()->pull('tickets.submission_acknowledgement') : null,
            'canAssignDuringHandover' => $canAssignDuringHandover,
            'handoverMembers' => ($view === 'handover' || $canAssignDuringHandover)
                ? TicketAccess::members(false, true)->where('status', 'Active')->orderBy('name')->get(['id', 'name'])
                : [],
            'handovers' => $view === 'handover'
                ? TicketAssignmentHandover::with('member:id,name,role_id')->latest('id')->get()
                : [],
            'handoverToday' => $view === 'handover' ? TicketAssignmentHandover::today() : null,
            'pendingFeedback' => $pendingFeedback,
            'leaderboard' => $leaderboardData,
            'pendingImport' => $role === 'leader' ? $request->session()->get('tickets.import.'.(int) $preview.'.'.$actor->id) : null,
            'prioritySummary' => $prioritySummary,
            'leaderSummary' => $leaderSummary,
            'memberRating' => $memberRating,
            'memberSummary' => $memberSummary,
            'employeeSummary' => $employeeSummary,
            'creationPage' => $request->routeIs('tickets.create'),
            'ticketRole' => $role, 'tickets' => $query->paginate($pageSize, ['*'], 'page', $perPage === 'all' ? 1 : null)->withQueryString()->through(function ($ticket) use ($sla, $role) {
                $ticket->setAttribute('member_submission', $role === 'leader' && $ticket->isMemberSubmission());
                $ticket->setAttribute('sla', $sla->snapshot($ticket));
                return $ticket;
            }),
            'filters' => ['location_filter' => $locationFilter, 'branch_filter' => $branchFilter, 'assignee_filter' => $assigneeFilter, 'leaderboard_period' => $filters['leaderboard_period'] ?? 'all', 'priority_filter' => $priorityFilter, 'closed_period' => $filters['closed_period'] ?? '', 'date_from' => $filters['date_from'] ?? '', 'date_to' => $filters['date_to'] ?? '', 'status_filter' => $statusFilter, 'sort' => $sort, 'direction' => $direction, 'view' => $legacyStatusView ? 'all' : $view, 'search' => $filters['search'] ?? '', 'report_period' => $filters['report_period'] ?? 'all', 'per_page' => $perPage],
            'categories' => config('ticketing.categories'),
            // The shared role/department exceptions may choose any affected branch.
            'departments' => \App\Models\Department::orderBy('name')->get(['id', 'name']),
            'ticketLocations' => TicketLocation::query()
                ->withTrashed($view !== 'admin' && !$request->routeIs('tickets.create'))
                ->orderBy('name')->get(['id', 'name', 'code', 'deleted_at']),
            'branchCodes' => $view === 'admin' ? TicketLocation::BRANCH_CODES : [],
            'filterBranches' => Branch::orderBy('name')->get(['id', 'name']),
            'branches' => TicketAccess::branches($actor)->orderBy('name')->get(['id', 'name']),
            'members' => ($role === 'leader' || $canFilterByAssignee) ? TicketAccess::members($preview)->orderBy('name')->get(['id', 'name']) : [],
            'reports' => $reports,
            'memberWorkloads' => $memberWorkloads,
            'slaReport' => $slaReport,
            'slaPolicy' => TicketPrioritySettings::policy(),
            'priorityLabels' => TicketPrioritySettings::labels(),
            'prioritySettings' => $view === 'sla_settings' ? \App\Models\TicketPriority::orderBy('sort_order')->orderBy('id')->get() : [],
            // The module uses this identity while the surrounding layout keeps auth.user.
            'ticketUser' => $actor->only(['id', 'name', 'branch_id']) + ['department' => $actor->department?->name],
        ]);
    }

    public function workbookTemplate(Request $request)
    {
        [$actor, $preview] = $this->context($request);
        abort_unless(TicketAccess::role($actor) === 'leader', 403);
        return app(\App\Services\TicketWorkbook::class)->download([
            'New tickets' => [\App\Services\TicketWorkbook::HEADERS],
            'Instructions' => [['Field', 'Instructions'], ['Import', 'Creates new tickets only; no ticket IDs, updates, statuses or historical timestamps. Maximum 100 rows.'],
                ['employee_id', 'Use an employee ID from the Employees sheet.'], ['branch_affected', 'Exact branch name; employee branch permissions apply.'],
                ['priority', implode(', ', TicketPrioritySettings::labels()).' (blank defaults to '.(TicketPrioritySettings::labels()['low'] ?? 'Low').')'], ['category', implode(', ', config('ticketing.categories'))],
                ['supporting_links', 'Optional HTTP/HTTPS links, one per line, maximum 10.'], ['Required', 'All other columns are required. Creation and SLA receipt use import time.'],
                ['Notifications', $preview ? 'Preview imports send no live notifications.' : 'Confirming sends website notifications to the IT team.']],
            'Employees' => [['Employee ID', 'Name', 'Allowed branches'], ...User::whereIn('id', $preview ? DB::table('ticket_preview_users')->select('user_id') : User::select('id')->whereNotIn('id', DB::table('ticket_preview_users')->select('user_id')))->orderBy('name')->get()->map(fn ($u) => [$u->id, $u->name, TicketAccess::branches($u)->pluck('name')->implode(', ')])->all()],
        ], 'tcc-ticket-import-template.xlsx');
    }

    public function workbookImport(Request $request)
    {
        [$actor, $preview] = $this->context($request);
        abort_unless(TicketAccess::role($actor) === 'leader', 403);
        $request->validate(['mode' => 'required|in:preview,confirm,cancel']);
        $key = 'tickets.import.'.(int) $preview.'.'.$actor->id;
        $workbook = app(\App\Services\TicketWorkbook::class);
        if ($request->input('mode') === 'cancel') {
            $request->session()->forget($key);
            return back();
        }
        if ($request->input('mode') === 'preview') {
            $request->session()->forget($key);
            $request->validate(['file' => 'required|file|mimes:xlsx|max:5120']);
            $rows = $workbook->read($request->file('file')->getRealPath());
            $data = $workbook->validateRows($rows, $preview);
            $request->session()->put($key, ['token' => (string) \Illuminate\Support\Str::uuid(), 'expires' => now()->addMinutes(30)->timestamp, 'rows' => $rows,
                'tickets' => collect($data)->map(fn ($row) => ['employee' => $row['employee_name'], 'subject' => $row['subject'], 'branch' => Branch::find($row['branch_id'])->name])->all()]);
            return back()->with('success', 'Workbook validated. Review the new tickets, then confirm import.');
        }
        $pending = $request->session()->get($key);
        abort_unless($pending && $pending['expires'] >= now()->timestamp && hash_equals($pending['token'], (string) $request->input('token')), 422, 'Import preview expired. Upload the workbook again.');
        // Revalidate permissions and employee/branch data at confirmation time.
        $data = $workbook->validateRows($pending['rows'], $preview);
        DB::transaction(function () use ($data, $actor, $preview) {
            $team = $preview ? collect() : User::whereNotIn('id', DB::table('ticket_preview_users')->select('user_id'))->with('role')->get()->filter(fn ($user) => TicketAccess::role($user) !== 'employee');
            foreach ($data as $row) {
                $received = now()->utc();
                $ticket = Ticket::create($row + ['is_preview' => $preview, 'reporting_channel' => 'portal']);
                app(TicketSla::class)->enroll($ticket, $actor, $received);
                app(TicketSla::class)->activity($ticket, $actor, 'imported', 'Created from a validated XLSX workbook by IT leadership.');
                if (!$preview) Notification::send($team, new TicketNotification($ticket->id, "New imported ticket #{$ticket->ticket_code}: {$ticket->subject}"));
            }
        }, 3);
        $request->session()->forget($key);
        return back()->with('success', count($data).' new tickets imported.');
    }

    public function storeHandover(Request $request)
    {
        abort_unless(TicketAccess::role($request->user()) === 'leader', 403);
        $data = $request->validate([
            'member_id' => ['required', 'integer', Rule::in(TicketAccess::members(false, true)->where('status', 'Active')->pluck('id')->all())],
            'starts_on' => ['required', 'date_format:Y-m-d'],
            'ends_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:starts_on', 'after_or_equal:'.TicketAssignmentHandover::today()],
        ]);
        TicketAssignmentHandover::create($data + ['granted_by' => $request->user()->id]);

        return back()->with('success', 'Assignment access scheduled.');
    }

    public function revokeHandover(Request $request, TicketAssignmentHandover $handover)
    {
        abort_unless(TicketAccess::role($request->user()) === 'leader', 403);
        TicketAssignmentHandover::whereKey($handover->id)->whereNull('revoked_at')->update(['revoked_at' => now()]);

        return back()->with('success', 'Assignment access revoked.');
    }

    public function assignDuringHandover(Request $request, Ticket $ticket)
    {
        [$actor, $preview] = $this->context($request);
        abort_unless($ticket->is_preview === $preview, 404);
        abort_unless(TicketAccess::role($actor) === 'member' && $actor->status === 'Active', 403);

        DB::transaction(function () use ($request, $ticket, $actor, $preview) {
            // Recheck the grant on every write and lock it against concurrent revocation.
            $handover = TicketAssignmentHandover::active()->where('member_id', $actor->id)
                ->orderBy('id')->lockForUpdate()->first();
            abort_unless($handover, 403, 'Your ticket assignment handover is not active.');

            $data = $request->validate([
                'assigned_to' => ['sometimes', 'required', 'integer', Rule::in(TicketAccess::members($preview, true)->where('status', 'Active')->pluck('id')->all())],
                'priority' => ['sometimes', 'required', Rule::in(array_keys(TicketPrioritySettings::targets()))],
                'priority_reason' => ['nullable', 'string', 'max:5000'],
                // Resolution documentation and closure use their existing dedicated workflows.
                'status' => ['sometimes', 'required', Rule::in(['in_progress'])],
                'note' => ['nullable', 'string', 'max:10000'],
                'action' => ['prohibited'],
            ]);
            $locked = Ticket::whereKey($ticket->id)->lockForUpdate()->firstOrFail();
            if (in_array($locked->status, ['closed', ...Ticket::REVIEW_HOLD_STATUSES], true)) {
                throw \Illuminate\Validation\ValidationException::withMessages(['assigned_to' => 'This ticket is not available for assignment.']);
            }

            // Use the normal SLA/history pipeline without granting supervisor-only actions.
            $sla = app(TicketSla::class);
            $sla->check($locked);
            if (isset($data['assigned_to'])) $data['assigned_to'] = (int) $data['assigned_to'];
            $sla->apply($locked, $actor, 'member', $data);
        });

        return back()->with('success', 'Ticket assignment / priority / status saved.');
    }

    public function storeLocation(Request $request)
    {
        abort_unless(TicketAccess::role($request->user()) === 'leader', 403);

        $code = $request->input('code');
        if (is_string($code)) {
            $request->merge(['code' => strtoupper(trim($code))]);
        }
        $location = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('ticket_locations'), Rule::unique('branches')],
            'code' => ['required', 'string', 'size:3', 'alpha_num:ascii', Rule::unique('ticket_locations'), Rule::notIn(array_values(TicketLocation::BRANCH_CODES))],
        ]);
        TicketLocation::create($location);

        return redirect()->route('tickets.admin')->with('success', 'Ticket location added.');
    }

    public function destroyLocation(Request $request, TicketLocation $ticketLocation)
    {
        abort_unless(TicketAccess::role($request->user()) === 'leader', 403);

        $ticketLocation->delete();

        return redirect()->route('tickets.admin')->with('success', 'Ticket location removed.');
    }

    public function store(Request $request)
    {
        [$actor, $preview] = $this->context($request);
        $it = TicketAccess::role($actor) !== 'employee';
        // Department is account-owned data, including for the selected preview employee.
        // Never trust an editable client value or silently substitute another department.
        $department = $actor->department?->name;
        if (!$department) throw \Illuminate\Validation\ValidationException::withMessages(['employee_department' => 'Your account has no assigned department. Contact your administrator.']);
        $request->merge(['employee_department' => $department]);
        $data = $request->validate([
            // A crafted request must obey the same branch scope as the dropdown.
            'branch_id' => ['nullable', 'required_without:ticket_location_id', 'prohibits:ticket_location_id', 'integer', Rule::in(TicketAccess::branches($actor)->pluck('id')->all())],
            'ticket_location_id' => ['nullable', 'required_without:branch_id', 'integer', Rule::exists('ticket_locations', 'id')->whereNull('deleted_at')],
            'subject' => ['required', 'string', 'max:180'],
            'description' => ['required', 'string', 'max:10000'],
            'category' => ['required', Rule::in(config('ticketing.categories'))],
            // Requesters classify the initial urgency; IT leadership may revise it later.
            'priority' => ['required', Rule::in(array_keys(TicketPrioritySettings::targets()))],
            'employee_department' => ['required', 'string', 'max:255', Rule::exists('departments', 'name')],
            'affected_asset' => ['required', 'string', 'max:255'],
            'operational_impact' => ['required', 'string', 'max:5000'],
            // Store URLs only; no files are fetched or uploaded by the application.
            'supporting_links' => ['nullable', 'array', 'max:10'],
            'supporting_links.*' => ['required', 'string', 'max:2048', 'url:http,https'],
            'reporting_channel' => ['required', Rule::in($it ? ['email', 'viber', 'messaging_app'] : ['portal'])],
            'emergency_reason' => [$it ? 'required' : 'prohibited', 'string', 'max:5000'],
        ]);
        // Preserve the account department name as a historical ticket snapshot.
        // Creation and SLA receipt use the same server timestamp. User-supplied
        // issue/emergency times and removed intake fields are not accepted.
        $received = now()->utc();
        // Derive identity fields on the server. Commit ticket and database notifications together.
        $submittedTicket = DB::transaction(function () use ($actor, $preview, $data, $received, $it) {
            if (isset($data['ticket_location_id']) && !TicketLocation::lockForUpdate()->find($data['ticket_location_id'])) {
                throw \Illuminate\Validation\ValidationException::withMessages(['ticket_location_id' => 'That location was removed. Select another location.']);
            }
            $ticket = Ticket::create($data + ['creator_id' => $actor->id, 'employee_name' => $actor->name, 'is_preview' => $preview,
                'created_at' => $received, 'assigned_to' => $it ? $actor->id : null]);
            app(TicketSla::class)->enroll($ticket, $actor, $received);
            // Test tickets persist for testing but must not notify real staff.
            if ($preview) return $ticket;
            $team = User::whereNotIn('id', DB::table('ticket_preview_users')->select('user_id'))->with('role')->get()->filter(fn ($user) => TicketAccess::role($user) !== 'employee');
            Notification::send($team, new TicketNotification($ticket->id, "New ticket #{$ticket->ticket_code}: {$ticket->subject}"));
            return $ticket;
        });
        $response = redirect()->route('tickets.dashboard')
            ->with('success', $preview ? 'Test ticket submitted. Live notifications were not sent.' : 'Ticket submitted. The IT team has been notified.');
        // Flash only after the transaction commits, never for failed validation or IT submissions.
        if (!$it) $response->with('tickets.submission_acknowledgement', [
            'id' => $submittedTicket->id, 'code' => $submittedTicket->ticket_code, 'subject' => $submittedTicket->subject,
        ]);
        return $response;
    }

    private function reviewSubmission(Request $request, Ticket $ticket, User $actor, string $action)
    {
        abort_unless(TicketAccess::role($actor) === 'leader', 403);
        $sendBack = $action === 'send_back';
        $data = $request->validate(['note' => [$sendBack ? 'required' : 'nullable', 'string', 'max:10000']]);

        DB::transaction(function () use ($ticket, $actor, $sendBack, $data) {
            $locked = Ticket::whereKey($ticket->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->isMemberSubmission(), 403);
            $allowed = $sendBack ? ['not_started', 'in_progress', 'resolved']
                : ['not_started', 'in_progress', 'resolved', 'revision_requested'];
            if (!in_array($locked->status, $allowed, true)) {
                throw \Illuminate\Validation\ValidationException::withMessages(['action' => 'This ticket is no longer eligible for that review action.']);
            }

            $sla = app(TicketSla::class);
            $sla->holdForReview($locked);
            $locked->status = $sendBack ? 'revision_requested' : 'rejected';
            $locked->save();
            $note = $data['note'] ?? 'Ticket rejected by IT leadership.';
            $sla->activity($locked, $actor, $locked->status, $note);
            $message = $sendBack ? 'was returned for revision: '.$note : 'was rejected: '.$note;
            $locked->creator->notify(new TicketNotification($locked->id, "Ticket #{$locked->ticket_code} {$message}",
                $sendBack ? 'tickets.revisions' : 'tickets.dashboard'));
        });

        return back()->with('success', $sendBack ? 'Ticket returned to its creator for revision.' : 'Ticket rejected.');
    }

    public function resubmitRevision(Request $request, Ticket $ticket)
    {
        [$actor, $preview] = $this->context($request);
        abort_unless($ticket->is_preview === $preview, 404);
        abort_unless(TicketAccess::role($actor) === 'member' && (int) $ticket->creator_id === (int) $actor->id, 403);

        $data = $request->validate([
            'subject' => ['required', 'string', 'max:180'],
            'description' => ['required', 'string', 'max:10000'],
            'affected_asset' => ['required', 'string', 'max:255'],
            'operational_impact' => ['required', 'string', 'max:5000'],
            'supporting_links' => ['nullable', 'array', 'max:10'],
            'supporting_links.*' => ['required', 'string', 'max:2048', 'url:http,https'],
            'reporting_channel' => ['required', Rule::in(['portal', 'email', 'viber', 'messaging_app'])],
            'emergency_reason' => ['exclude_if:reporting_channel,portal', 'required', 'string', 'max:5000'],
        ]);
        $data['emergency_reason'] ??= null;

        DB::transaction(function () use ($actor, $ticket, $data) {
            $locked = Ticket::whereKey($ticket->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== 'revision_requested') {
                throw \Illuminate\Validation\ValidationException::withMessages(['action' => 'This ticket is no longer pending revision.']);
            }

            $sla = app(TicketSla::class);
            $sla->resumeAfterRevision($locked);
            $locked->fill($data);
            $locked->status = 'in_progress';
            $locked->save();
            $sla->activity($locked, $actor, 'revision_submitted', 'The creator revised and resubmitted this ticket.');
            $reviewer = User::find($locked->activities()->where('type', 'revision_requested')->value('actor_id'));
            if ($reviewer && TicketAccess::role($reviewer) === 'leader') {
                $reviewer->notify(new TicketNotification($locked->id, "Ticket #{$locked->ticket_code} was revised and resubmitted.", 'tickets.all'));
            }
        });

        return redirect()->route('tickets.revisions')->with('success', 'Ticket revised and resubmitted.');
    }

    public function update(Request $request, Ticket $ticket)
    {
        [$actor, $preview] = $this->context($request);
        abort_unless($ticket->is_preview === $preview, 404);
        $role = TicketAccess::role($actor);
        $action = $request->input('action', 'save');
        if (in_array($action, ['send_back', 'reject'], true)) {
            return $this->reviewSubmission($request, $ticket, $actor, $action);
        }
        $requesterAction = in_array($action, ['reply', 'confirm', 'feedback', 'dismiss_feedback']);
        if ($requesterAction) abort_unless($ticket->creator_id === $actor->id, 403);
        else abort_unless(in_array($role, ['leader', 'member']), 403);
        // Resolve the displayed code to the numeric key used in activity history.
        $linkedId = $request->input('linked_ticket_id');
        if (is_string($linkedId) && preg_match('/^[a-z]{2}[0-9]{4,20}$/iD', trim($linkedId))) {
            $related = Ticket::where('is_preview', $preview)->where('ticket_code', strtoupper(trim($linkedId)))->first();
            if (!$related) throw \Illuminate\Validation\ValidationException::withMessages(['linked_ticket_id' => 'Choose an existing related ticket ID.']);
            $request->merge(['linked_ticket_id' => $related->id]);
        }
        $data = $request->validate([
            'action' => ['sometimes', Rule::in(['save', 'reopen', 'acknowledge', 'resume', 'update', 'delay', 'restore', 'approve_workaround', 'reply', 'confirm', 'feedback', 'dismiss_feedback'])],
            'status' => $requesterAction || !in_array($action, ['save', 'reopen']) ? ['prohibited'] : ['sometimes', 'required', Rule::in(['in_progress', 'resolved', 'closed'])],
            'priority' => !$requesterAction && $role === 'leader' ? ['sometimes', 'required', Rule::in(array_keys(TicketPrioritySettings::targets()))] : ['prohibited'],
            'assigned_to' => !$requesterAction && $role === 'leader' ? ['sometimes', 'required', 'integer', Rule::exists('users', 'id')->whereIn('id', TicketAccess::members($preview)->pluck('id'))] : ['prohibited'],
            'priority_reason' => ['nullable', 'string', 'max:5000'],
            'note' => ['nullable', 'string', 'max:10000'],
            'assessment' => ['nullable', 'string', 'max:5000'],
            'next_steps' => ['nullable', 'string', 'max:5000'],
            'pause_reason' => ['prohibited'],
            'findings' => ['nullable', 'string', 'max:5000'],
            'troubleshooting_performed' => ['nullable', 'string', 'max:5000'],
            'corrective_actions' => ['nullable', 'string', 'max:5000'],
            'resolution_details' => ['nullable', 'string', 'max:5000'],
            'workaround' => ['nullable', 'string', 'max:5000'],
            'recovery_plan' => ['nullable', 'string', 'max:5000'],
            'vendor' => ['nullable', 'string', 'max:255'],
            'vendor_reference' => ['nullable', 'string', 'max:255'],
            'vendor_notified_at' => ['nullable', 'date', 'before_or_equal:now'],
            'next_update_at' => ['nullable', 'date'],
            'linked_ticket_id' => ['nullable', 'integer', Rule::exists('tickets', 'id')->where('is_preview', $preview), Rule::notIn([$ticket->id])],
            'rating' => ['nullable', 'numeric', 'between:0.5,5', 'multiple_of:0.5'],
            'delay_reason' => ['nullable', 'string', 'max:5000'],
            'actions_taken' => ['nullable', 'string', 'max:5000'],
            'assistance_required' => ['nullable', 'string', 'max:5000'],
        ]);
        if (!empty($data['linked_ticket_id'])) {
            $data['linked_ticket_code'] = Ticket::whereKey($data['linked_ticket_id'])->value('ticket_code');
        }
        DB::transaction(function () use ($actor, $ticket, $role, $data, $requesterAction, $action) {
            $locked = Ticket::whereKey($ticket->id)->lockForUpdate()->firstOrFail();
            if (in_array($locked->status, Ticket::REVIEW_HOLD_STATUSES, true)) {
                throw \Illuminate\Validation\ValidationException::withMessages(['action' => 'This ticket is awaiting revision or has been rejected.']);
            }
            $sla = app(TicketSla::class);
            if ($requesterAction) {
                $resolver = null;
                // Skipping is not a rating. A row lock makes rating/dismissal idempotent.
                if (in_array($action, ['feedback', 'dismiss_feedback'])) {
                    if ($locked->status !== 'closed') throw \Illuminate\Validation\ValidationException::withMessages(['action' => 'This ticket is no longer closed.']);
                    $resolver = $this->feedbackResolverId($locked);
                    $recipient = $resolver ? User::with('role')->find($resolver) : null;
                    if (!$recipient) throw \Illuminate\Validation\ValidationException::withMessages(['rating' => 'This ticket has no recorded IT resolver.']);
                    abort_unless(TicketAccess::canRateResolver($actor, $recipient), 403, 'Self-ratings and ratings between IT members are not allowed.');
                    if ($locked->activities()->whereIn('type', ['feedback', 'feedback_dismissed'])->exists()) return;
                    if ($action === 'dismiss_feedback') {
                        $sla->activity($locked, $actor, 'feedback_dismissed', 'Requester skipped the optional rating.');
                        return;
                    }
                }
                if ($action === 'confirm' && $locked->status !== 'resolved') {
                    throw \Illuminate\Validation\ValidationException::withMessages(['action' => 'Confirm a resolved ticket only.']);
                }
                if ($action === 'feedback' && empty($data['rating'])) {
                    throw \Illuminate\Validation\ValidationException::withMessages(['rating' => 'Choose a rating from 0.5 to 5 in half-star steps.']);
                }
                $note = trim($data['note'] ?? '');
                // A rating is sufficient feedback. Requiring a comment here and
                // in the browser made the submit button appear unresponsive.
                if ($note === '' && $action === 'reply') throw \Illuminate\Validation\ValidationException::withMessages(['note' => 'Enter your reply.']);
                $rating = isset($data['rating']) ? (float) $data['rating'] : null;
                $message = $note ?: ($action === 'feedback'
                    ? "Requester submitted a support rating of {$rating}/5."
                    : 'Requester confirmed service is working.');
                $sla->activity($locked, $actor, $action, $message, ['rating' => $rating, 'resolved_by' => $action === 'feedback' ? $resolver : null]);
                if ($action === 'confirm' && $locked->sla_state) {
                    $state = $locked->sla_state;
                    $state['confirmed_at'] = now()->utc()->toIso8601String();
                    $locked->sla_state = $state;
                    $locked->save();
                }
                $sla->notify($locked, 'Requester '.$action.($action === 'feedback' ? " ({$rating}/5)" : '').': '.$message, true);
            } else {
                abort_if($role === 'member' && $locked->assigned_to !== $actor->id, 403);
                // Detect elapsed breaches before any priority change can hide them.
                $sla->check($locked);
                $sla->apply($locked, $actor, $role, $data);
            }
        });
        if ($action === 'dismiss_feedback') return back();
        return back()->with('success', $action === 'feedback'
            ? ($preview ? 'Feedback submitted in preview. No live notifications were sent.' : 'Feedback submitted. Thank you.')
            : 'Ticket changes saved.');
    }
}
