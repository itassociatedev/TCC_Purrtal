<?php

namespace App\Http\Controllers;

use App\Models\{Branch, Ticket, User};
use App\Notifications\TicketNotification;
use App\Services\TicketAccess;
use App\Services\TicketSla;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Notification};
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class TicketController extends Controller
{
    // Resolve a ticket identity without replacing the signed-in account.
    // Preview-role routes use isolated data and an in-memory role identity.
    private function context(Request $request): array
    {
        $preview = $request->routeIs('tickets.preview.*');
        if (!$preview) return [$request->user(), false];
        abort_unless(TicketAccess::canPreview($request->user()), 403);
        $data = $request->validate([
            'preview_user' => ['nullable', 'integer', Rule::exists('ticket_preview_users', 'user_id')],
            'preview_role' => ['nullable', Rule::in(['employee', 'member', 'leader'])],
        ]);
        // Role-only UI previews use a temporary in-memory identity. Preview
        // tickets remain isolated; no extra login or seeded account is needed.
        if (!empty($data['preview_role'])) {
            return [$this->rolePreviewActor($request->user(), $data['preview_role']), true];
        }
        $id = $data['preview_user'] ?? null;
        $id ??= DB::table('ticket_preview_users')->orderBy('role_id')->value('user_id');
        abort_unless($id, 422, 'Run the TicketPreviewSeeder to create test employees.');
        return [User::findOrFail($id), true];
    }

    private function rolePreviewActor(User $signedInUser, string $ticketRole): User
    {
        $roleName = match ($ticketRole) {
            'leader' => config('ticketing.leader_roles.0', 'IT Team Leader'),
            'member' => config('ticketing.member_roles.0', 'IT Member'),
            default => 'Employee',
        };
        $role = new \App\Models\Role();
        $role->name = $roleName;
        $actor = clone $signedInUser;
        $actor->setRelation('role', $role);
        return $actor;
    }

    private function previewRouteParams(Request $request, User $actor): array
    {
        if ($request->filled('preview_role')) {
            return ['preview_role' => $request->input('preview_role')];
        }
        return ['preview_user' => $actor->id];
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
        abort_if($role === 'employee' && $request->routeIs('tickets.export', 'tickets.preview.export'), 403, 'Only IT members and leaders may export tickets.');
        // Older bookmarks still select Critical.
        if ($request->input('priority_filter') === 'urgent') $request->merge(['priority_filter' => 'critical']);
        $filters = $request->validate([
            'view' => ['nullable', Rule::in(['leaderboard', 'dashboard', 'open', 'closed', 'all', 'assigned', 'reports'])],
            'priority_filter' => ['nullable', Rule::in(['all', 'critical', 'high', 'medium', 'low', 'not_set'])],
            'status_filter' => ['nullable', Rule::in(['all', 'open', 'closed', 'not_started', 'in_progress', 'resolved', 'unassigned', 'priority_not_set'])],
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
        abort_if($role === 'member' && !in_array($view, ['dashboard', 'all', 'assigned']), 403);
        abort_if($view === 'leaderboard' && $role !== 'leader', 403);
        // Leaders can also view their own assignments.
        // Old report bookmarks now show the persistent statistics panel and open table.
        // Normalize only after authorization so other roles cannot access leader views.
        if ($role === 'leader' && $view === 'reports') $view = 'open';
        // Keep old screen paths as bookmarks, but show status in the list filter.
        $legacyStatusView = in_array($view, ['open', 'closed'], true);
        if ($legacyStatusView && $request->routeIs('tickets.open', 'tickets.closed', 'tickets.preview.open', 'tickets.preview.closed')) {
            $parameters = $filters;
            unset($parameters['view']);
            $parameters['status_filter'] = $view;
            if ($preview) $parameters = array_merge($parameters, $this->previewRouteParams($request, $actor));
            return redirect()->route($preview ? 'tickets.preview.all' : 'tickets.all', $parameters);
        }
        // Remember the chosen size across views and refreshes. All still uses
        // the authorized, searched query rather than exposing other tickets.
        $perPage = (string) ($filters['per_page'] ?? $request->session()->get('tickets.per_page', '10'));
        $request->session()->put('tickets.per_page', $perPage);
        // Scope every list to live or preview data before applying other filters.
        // Eager loading prevents separate relationship queries for every table row.
        $query = Ticket::where('is_preview', $preview)->with(['creator:id,name', 'branch:id,name', 'assignee:id,name', 'activities.actor:id,name']);
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
                'total' => $total, 'open' => $total - $closed, 'closed' => $closed,
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
            foreach (['critical', 'high', 'medium', 'low', 'not_set'] as $priority) {
                $prioritySummary[$priority] = (int) ($priorityCounts[$priority === 'not_set' ? '' : $priority] ?? 0);
            }
        }
        if ($role === 'employee') $employeeSummary = $summary;
        if ($role === 'member') $memberSummary = $summary;
        if ($role === 'leader') $leaderSummary = $summary;
        if ($role === 'member' && $view === 'dashboard') $query->where('assigned_to', $actor->id);
        if ($view === 'open') $query->where('status', '!=', 'closed');
        if ($view === 'closed') $query->where('status', 'closed');
        if ($view === 'assigned') $query->where('assigned_to', $actor->id);
        $priorityFilter = $filters['priority_filter'] ?? 'all';
        if ($priorityFilter === 'not_set') $query->whereNull('priority');
        elseif ($priorityFilter !== 'all') $query->where('priority', $priorityFilter);
        // Status is an additional filter on the authorized view, never a replacement
        // for creator, assignment, or preview restrictions.
        $statusFilter = $filters['status_filter'] ?? 'all';
        if ($legacyStatusView && $statusFilter === 'all') $statusFilter = $view;
        // Employee bookmarks for Resolved now use the Open filter.
        if ($role === 'employee' && $statusFilter === 'resolved') $statusFilter = 'open';
        if ($statusFilter === 'open') $query->where('status', '!=', 'closed');
        elseif (in_array($statusFilter, ['unassigned', 'priority_not_set'])) {
            $query->whereIn('status', ['not_started', 'in_progress'])->whereNull($statusFilter === 'unassigned' ? 'assigned_to' : 'priority');
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
                'Priority not set' => (clone $activeTickets)->whereNull('priority')->count(),
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
            $trackedQuery = Ticket::where('is_preview', $preview)->whereNotNull('sla_policy');
            if ($periodStart) $trackedQuery->where('sla_received_at', '>=', $periodStart->utc());
            $tracked = $trackedQuery->get();
            $snapshots = $tracked->map(fn ($t) => $sla->snapshot($t));
            $responseEligible = $snapshots->filter(fn ($s) => $s['label'] !== 'Not Set' && ($s['response_complete'] || $s['response_status'] === 'Breached' || $s['response_ever_breached']));
            $resolutionEligible = $snapshots->filter(fn ($s) => $s['label'] !== 'Not Set' && ($s['resolution_complete'] || $s['resolution_status'] === 'Breached' || $s['resolution_ever_breached']));
            $slaReport = [
                'Tracked tickets' => $tracked->count(),
                'Awaiting priority' => $tracked->whereNull('priority')->count(),
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
            foreach (config('ticket-sla.targets') as $priority => $policy) {
                $group = $tracked->where('priority', $priority)->map(fn ($t) => $sla->snapshot($t));
                $breaches = $group->filter(fn ($s) => $s['response_status'] === 'Breached' || $s['resolution_status'] === 'Breached'
                    || $s['response_ever_breached'] || $s['resolution_ever_breached'])->count();
                $slaReport[$policy['label'].' breaches'] = $breaches.' / '.$group->count();
            }
            $slaReport['Linked follow-up tickets'] = \App\Models\TicketActivity::whereIn('ticket_id', $tracked->pluck('id'))
                ->whereNotNull('details->linked_ticket_id')->distinct()->count('ticket_id');
            foreach ($tracked->whereNotIn('status', ['resolved', 'closed'])->groupBy('branch_id') as $branchId => $backlog) {
                $branchName = Branch::find($branchId)?->name ?? 'Unknown branch';
                $slaReport[$branchName.' open backlog'] = $backlog->count();
            }
        }
        // Validate the sort key above and use explicit columns/subqueries: no raw user SQL.
        $sort = $filters['sort'] ?? 'created_at';
        $direction = $filters['direction'] ?? 'desc';
        $sortColumn = match ($sort) {
            'branch' => Branch::select('name')->whereColumn('branches.id', 'tickets.branch_id')->limit(1),
            'assignee' => User::select('name')->whereColumn('users.id', 'tickets.assigned_to')->limit(1),
            'creator' => 'employee_name',
            default => $sort,
        };
        if ($sort === 'priority') {
            $query->orderByRaw("CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END ".$direction);
        } else $query->orderBy($sortColumn, $direction);
        $query->orderBy('id', $direction); // Stable pagination when column values match.
        $exporting = $request->routeIs('tickets.export', 'tickets.preview.export');
        $leaderboardData = $role === 'leader' && $view === 'leaderboard'
            ? app(\App\Services\TicketLeaderboard::class)->summary($preview, $filters['leaderboard_period'] ?? 'all',
                !$exporting && isset($filters['leaderboard_member']) ? (int) $filters['leaderboard_member'] : null,
                $exporting ? null : ($filters['leaderboard_detail'] ?? null), (int) ($filters['leaderboard_page'] ?? 1)) : null;
        if ($leaderboardData && $exporting) {
            return app(\App\Services\TicketLeaderboard::class)->export($leaderboardData, $preview);
        }
        if ($request->routeIs('tickets.export', 'tickets.preview.export')) {
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
        return Inertia::render('Tickets/Index', [
            'pendingFeedback' => $pendingFeedback,
            'leaderboard' => $leaderboardData,
            'pendingImport' => $role === 'leader' ? $request->session()->get('tickets.import.'.(int) $preview.'.'.$actor->id) : null,
            'prioritySummary' => $prioritySummary,
            'leaderSummary' => $leaderSummary,
            'memberRating' => $memberRating,
            'memberSummary' => $memberSummary,
            'employeeSummary' => $employeeSummary,
            'creationPage' => $request->routeIs('tickets.create', 'tickets.preview.create'),
            'ticketRole' => $role, 'tickets' => $query->paginate($pageSize, ['*'], 'page', $perPage === 'all' ? 1 : null)->withQueryString()->through(function ($ticket) use ($sla) {
                $ticket->setAttribute('sla', $sla->snapshot($ticket));
                return $ticket;
            }),
            'filters' => ['leaderboard_period' => $filters['leaderboard_period'] ?? 'all', 'priority_filter' => $priorityFilter, 'closed_period' => $filters['closed_period'] ?? '', 'date_from' => $filters['date_from'] ?? '', 'date_to' => $filters['date_to'] ?? '', 'status_filter' => $statusFilter, 'sort' => $sort, 'direction' => $direction, 'view' => $legacyStatusView ? 'all' : $view, 'search' => $filters['search'] ?? '', 'report_period' => $filters['report_period'] ?? 'all', 'per_page' => $perPage],
            'categories' => config('ticketing.categories'),
            // The shared role/department exceptions may choose any affected branch.
            'departments' => \App\Models\Department::orderBy('name')->get(['id', 'name']),
            'branches' => TicketAccess::branches($actor)->orderBy('name')->get(['id', 'name']),
            'members' => $role === 'leader' ? TicketAccess::members($preview)->orderBy('name')->get(['id', 'name']) : [],
            'reports' => $reports,
            'memberWorkloads' => $memberWorkloads,
            'slaReport' => $slaReport,
            'slaPolicy' => config('ticket-sla'),
            // The module uses this identity while the surrounding layout keeps auth.user.
            'ticketUser' => $actor->only(['id', 'name', 'branch_id']) + ['department' => $actor->department?->name],
            'preview' => $preview,
            'canPreview' => TicketAccess::canPreview($request->user()),
            'previewUsers' => $preview ? User::whereIn('id', DB::table('ticket_preview_users')->select('user_id'))
                ->orderBy('name')->get(['id', 'name', 'role_id'])->map(fn ($user) => [
                    'id' => $user->id, 'name' => $user->name, 'role' => $user->role?->name,
                    'ticket_role' => TicketAccess::role($user),
                ]) : [],
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
                ['priority', 'Critical, High, Medium, Low, Not Set or blank'], ['category', implode(', ', config('ticketing.categories'))],
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
            'branch_id' => ['required', 'integer', Rule::in(TicketAccess::branches($actor)->pluck('id')->all())],
            'subject' => ['required', 'string', 'max:180'],
            'description' => ['required', 'string', 'max:10000'],
            'category' => ['required', Rule::in(config('ticketing.categories'))],
            // Requesters classify the initial urgency; IT leadership may revise it later.
            'priority' => ['required', Rule::in(['low', 'medium', 'high', 'critical'])],
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
        DB::transaction(function () use ($actor, $preview, $data, $received, $it) {
            $ticket = Ticket::create($data + ['creator_id' => $actor->id, 'employee_name' => $actor->name, 'is_preview' => $preview,
                'created_at' => $received, 'assigned_to' => $it ? $actor->id : null]);
            app(TicketSla::class)->enroll($ticket, $actor, $received);
            // Test tickets persist for testing but must not notify real staff.
            if ($preview) return;
            $team = User::whereNotIn('id', DB::table('ticket_preview_users')->select('user_id'))->with('role')->get()->filter(fn ($user) => TicketAccess::role($user) !== 'employee');
            Notification::send($team, new TicketNotification($ticket->id, "New ticket #{$ticket->ticket_code}: {$ticket->subject}"));
        });
        return redirect()->route($preview ? 'tickets.preview.dashboard' : 'tickets.dashboard', $preview ? $this->previewRouteParams($request, $actor) : [])
            ->with('success', $preview ? 'Test ticket submitted. Live notifications were not sent.' : 'Ticket submitted. The IT team has been notified.');
    }

    public function update(Request $request, Ticket $ticket)
    {
        [$actor, $preview] = $this->context($request);
        abort_unless($ticket->is_preview === $preview, 404);
        $role = TicketAccess::role($actor);
        $action = $request->input('action', 'save');
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
            'action' => ['sometimes', Rule::in(['save', 'reopen', 'acknowledge', 'pause', 'resume', 'update', 'delay', 'restore', 'approve_workaround', 'reply', 'confirm', 'feedback', 'dismiss_feedback'])],
            'status' => $requesterAction || !in_array($action, ['save', 'reopen']) ? ['prohibited'] : ['sometimes', 'required', Rule::in(['in_progress', 'resolved', 'closed'])],
            'priority' => !$requesterAction && $role === 'leader' ? ['sometimes', 'required', Rule::in(['low', 'medium', 'high', 'critical'])] : ['prohibited'],
            'assigned_to' => !$requesterAction && $role === 'leader' ? ['sometimes', 'required', 'integer', Rule::exists('users', 'id')->whereIn('id', TicketAccess::members($preview)->pluck('id'))] : ['prohibited'],
            'priority_reason' => ['nullable', 'string', 'max:5000'],
            'note' => ['nullable', 'string', 'max:10000'],
            'assessment' => ['nullable', 'string', 'max:5000'],
            'next_steps' => ['nullable', 'string', 'max:5000'],
            'pause_reason' => ['nullable', Rule::in(config('ticket-sla.pause_reasons'))],
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
