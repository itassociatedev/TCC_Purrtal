import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useId, useRef, useState } from 'react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import TicketSubmissionAcknowledgement from '@/Components/TicketSubmissionAcknowledgement';
import TicketFeedbackQueue from '@/Components/TicketFeedbackQueue';
import TicketLeaderboard from '@/Components/TicketLeaderboard';
import TicketWorkbookControls from '@/Components/TicketWorkbookControls';
import TicketSlaPerformance from '@/Components/TicketSlaPerformance';
import TicketSlaSettings from '@/Components/TicketSlaSettings';
import ITWorkspaceSwitcher from '@/Components/ITWorkspaceSwitcher';
import '../../../css/ticketing.css';

const ticketColumns = [
    ['subject', 'Ticket Subject', 15], ['description', 'Ticket Description', 18],
    ['category', 'Ticket Category', 9], ['status', 'Status', 7], ['created_at', 'Timeline', 22],
    ['priority', 'Priority', 7], ['branch', 'Branch', 6], ['creator', 'Ticket Creator', 8], ['assignee', 'Assigned To', 8],
];

const labels = { not_started: 'Not started', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed', revision_requested: 'Pending revision', rejected: 'Denied' };

// Thin outline icons match the reference: muted blue normally, black when active.
// Inline SVG stays crisp at sidebar size and needs no image or icon dependency.
function TicketSidebarIcon({ kind, active }) {
    const paths = {
        admin: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
        handover: 'M3 8h16m-4-4 4 4-4 4M21 16H5m4-4-4 4 4 4',
        // Spiral notebook and pencil from the Pending revisions reference.
        revisions: 'M5.5 4.5H5A2 2 0 0 0 3 6.5v13A2 2 0 0 0 5 21.5h10a2 2 0 0 0 2-2V16m0-4.5v-5a2 2 0 0 0-2-2h-.5M6.5 4.5H8m1 0h2m1 0h1.5M5.5 5V3.5a.5.5 0 0 1 1 0V5a.5.5 0 0 1-1 0Zm2.5 0V3.5a.5.5 0 0 1 1 0V5a.5.5 0 0 1-1 0Zm3 0V3.5a.5.5 0 0 1 1 0V5a.5.5 0 0 1-1 0Zm2.5 0V3.5a.5.5 0 0 1 1 0V5a.5.5 0 0 1-1 0ZM5.8 8.5h8.4m-8.4 3h8.4m-8.4 3h6m-6 3h5m2.7.2.5-2.2 6-6a1 1 0 0 1 1.4 0l.4.4a1 1 0 0 1 0 1.4l-6 6-2.3.4Zm.5-2.2 1.8 1.8m3.3-6.8 1.8 1.8',
        locations: 'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
        leaderboard: 'M8 3h8v7a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v5m-4 2h8',
        dashboard: 'M3 10 12 3l9 7v11h-7v-7h-4v7H3V10Z',
        create: 'M12 5H5v16h14v-7M15 3l6 6M10 14l2-5 6-6 3 3-6 6-5 2Z',
        all: 'm3 6 1 1 2-3M9 6h12M3 12l1 1 2-3M9 12h12M3 18l1 1 2-3M9 18h12',
        open: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
        closed: 'M3 3h18v5H3V3Zm2 5v13h14V8M9 12h6',
        assigned: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    };
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ color: active ? '#111111' : '#5262a1', flexShrink: 0 }}><path d={paths[kind] || paths.all} /></svg>;
}

function TicketTile({ ticket, action, onOpen }) {
    const priorityLabels = usePage().props.priorityLabels || defaultPriorityLabels;
    const assignee = ticket.assignee?.name || 'Unassigned';
    const initials = assignee.split(/\s+/).slice(0, 2).map(part => part[0]).join('');
    const created = new Date(ticket.created_at).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });

    return <article className={`ticket-tile ticket-tile-${ticket.status}`} onClick={event => {
        if (!event.target.closest('button, a, input, select, summary')) onOpen();
    }}>
        <header className="ticket-tile-top">
            <span className="ticket-number">#{ticket.ticket_code}</span>
            <span className={`ticket-priority ${ticket.priority}`}>{priorityLabels[ticket.priority] || 'Low'}</span>
        </header>
        <button type="button" className="ticket-tile-title" onClick={onOpen}>{ticket.subject}</button>
        <p className="ticket-tile-description">{ticket.description}</p>
        <div className="ticket-tile-tags">
            <span>{ticket.category}</span>
            <span>{ticket.ticket_location?.name || ticket.branch?.name || '—'}</span>
        </div>
        <div className="ticket-tile-person">
            <span className="ticket-tile-avatar" aria-hidden="true">{initials}</span>
            <div><small>Assigned to</small><strong>{assignee}</strong></div>
        </div>
        <dl className="ticket-tile-timeline">
            <div><dt>Created by</dt><dd>{ticket.employee_name}</dd></div>
            <div><dt>Created</dt><dd><time dateTime={ticket.created_at}>{created}</time></dd></div>
            <div><dt>Responded Time</dt><dd>{ticket.sla?.enabled ? (ticket.sla.response_complete ? supportDuration(ticket.sla.response_elapsed) : 'Pending') : '—'}</dd></div>
            <div><dt>Resolution Time</dt><dd>{ticket.sla?.enabled ? (ticket.sla.resolution_complete ? supportDuration(ticket.sla.resolution_elapsed) : 'Pending') : '—'}</dd></div>
        </dl>
        <footer>
            <span className={`ticket-status ${ticket.status}`}>{labels[ticket.status]}</span>
            <button type="button" className="ticket-edit" aria-label={`${action} ticket: ${ticket.subject}`} onClick={onOpen}>{action}</button>
        </footer>
    </article>;
}

// datetime-local uses wall-clock time; convert to ISO only when submitting.
const localDateTime = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function TicketIntakeDetails({ ticket }) {
    const fields = [
        ['Department', ticket.employee_department],
        // The ticket creation timestamp is the single source for reporting time.
        ['Reported at', ticket.created_at ? new Date(ticket.created_at).toLocaleString() : null],
        ['Affected system / equipment / application / service', ticket.affected_asset],
        ['Business / clinical impact', ticket.operational_impact],
    ];
    return <dl className="ticket-intake-details">
        {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not provided'}</dd></div>)}
        <div><dt>Supporting links</dt><dd>{ticket.supporting_links?.length ? <ul>{ticket.supporting_links.map((url, index) =>
            <li key={index}>{/^https?:\/\//i.test(url) ? <a href={url} target="_blank" rel="noopener noreferrer">{url}</a> : 'Invalid link'}</li>
        )}</ul> : 'Not provided'}</dd></div>
    </dl>;
}

// Current status counts are separate from closure periods, which overlap.
// Keep colors and captions explicit so totals are understandable without color alone.
const reportCards = [
    ['Total tickets', 'indigo', 'All current statuses'],
    ['Not started', 'amber', 'Awaiting action'],
    ['In progress', 'blue', 'Currently being handled'],
    ['Resolved', 'green', 'Awaiting closure'],
    ['Closed', 'teal', 'Closed by IT leadership'],
    ['Unassigned active', 'pink', 'Not started or in progress'],
];

// Share filter keys between the dashboard and ticket report drill-downs.
const reportStatusFilters = { 'Total tickets': 'all', 'Not started': 'not_started', 'In progress': 'in_progress', Resolved: 'resolved', Closed: 'closed', 'Unassigned active': 'unassigned' };

function TicketReports({ reports, ticketRoute, filters }) {
    return <section className="ticket-card ticket-report-panel" aria-labelledby="ticket-report-heading">
        <div className="ticket-card-heading"><div><h2 id="ticket-report-heading">Ticket reports</h2><p>Live status totals for this environment, independent of table search and the SLA period filter.</p></div></div>
        <div className="ticket-report-grid">
            {/* Report totals ignore table filters, so drill-down starts from all tickets. */}
            {reportCards.map(([label, color, caption]) => <Link key={label} className={`ticket-stat ticket-stat-${color}`} href={ticketRoute('index', { view: 'all', branch_filter: '', location_filter: '', assignee_filter: '', status_filter: reportStatusFilters[label], closed_period: '', date_from: '', date_to: '' })} aria-current={!filters.closed_period && filters.status_filter === reportStatusFilters[label] ? 'true' : undefined} preserveScroll>
                <span className="ticket-stat-label">{label}</span>
                <strong>{reports?.[label] ?? 0}</strong>
                <span className="ticket-stat-caption">{caption}</span>
            </Link>)}
        </div>
        <div className="ticket-closure-summary">
            <div><h3>Closed by period</h3><p>Overlapping periods; do not add together.</p></div>
            <dl>{Object.entries({ day: 'Today', week: 'This week', month: 'This month', year: 'This year' }).map(([period, label]) =>
                <div key={period}><dt>{label}</dt><dd><Link href={ticketRoute('index', { view: 'all', assignee_filter: '', status_filter: 'closed', priority_filter: 'all', closed_period: period, date_from: '', date_to: '' })} aria-current={filters.closed_period === period ? 'true' : undefined} preserveScroll>{reports?.[`Closed · ${label}`] ?? 0}</Link></dd></div>
            )}</dl>
        </div>
    </section>;
}

function MemberWorkloads({ members }) {
    return <section className="ticket-card ticket-member-panel" aria-labelledby="ticket-member-heading">
        <div className="ticket-card-heading"><div><h2 id="ticket-member-heading">IT staff workload</h2><p>Includes IT members, interns and leaders. Assignment counts follow the current owner; ratings belong to the recorded resolver. Resolved includes closed tickets.</p></div></div>
        <div className="ticket-member-grid">
            {members.map(member => <article className="ticket-member-card" key={member.id}>
                <div className="ticket-member-name"><span className="ticket-member-avatar" aria-hidden="true">{member.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('')}</span><h3>{member.name}</h3></div>
                <dl className="ticket-member-counts">
                    <div className="ticket-member-assigned"><dt>Assigned tickets</dt><dd>{member.assigned_count}</dd></div>
                    <div className="ticket-member-resolved"><dt>Resolved tickets</dt><dd>{member.resolved_count}</dd></div>
                    {/* Use the same resolved total (including closed tickets), and
                        avoid dividing by zero for members without assignments. */}
                    <div className="ticket-member-rate"><dt>Tickets resolved (%)</dt><dd>{(member.assigned_count > 0
                        ? member.resolved_count / member.assigned_count * 100
                        : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</dd></div>
                    <div className="ticket-member-rate"><dt>Resolver rating ({member.rating_count || 0} tickets)</dt><dd>{member.rating_count ? `${Number(member.rating_average).toFixed(1)} / 5` : 'Not rated'}</dd></div>
                </dl>
            </article>)}
            {!members.length && <p className="ticket-member-empty">No IT staff are available in this environment yet.</p>}
        </div>
    </section>;
}

// Examples are presentation labels; stored category values remain compatible with existing tickets.
const categoryExamples = { Hardware: 'computers, printers', Software: 'applications, installation', Network: 'Wi-Fi, internet connectivity', 'Account & Access': 'login, permissions', Other: 'other IT support requests' };
const defaultPriorityLabels = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const supportDuration = seconds => {
    if (seconds == null) return 'Awaiting priority';
    const minutes = Math.ceil(Math.abs(seconds) / 60);
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m${seconds < 0 ? ' overdue' : ''}`;
};

function TicketSlaSummary({ ticket }) {
    const sla = ticket.sla;
    if (!sla?.enabled) return <p className="ticket-sla-legacy">{sla?.label || 'Existing ticket — excluded from SLA tracking'}</p>;
    return <div className="ticket-sla-summary">
        <div><strong>Response · {sla.response_status}</strong><p>{sla.response_complete ? `Responded in ${supportDuration(sla.response_elapsed)}` : supportDuration(sla.response_remaining)}</p>
            {sla.response_deadline && <small>Due {new Date(sla.response_deadline).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} PHT</small>}</div>
        <div className={`ticket-sla-state ${sla.resolution_status.toLowerCase().replaceAll(' ', '-')}`}><strong>Resolution · {sla.resolution_status}</strong><p>{sla.resolution_complete ? `Completed in ${supportDuration(sla.resolution_elapsed)}` : sla.resolution_remaining == null ? 'Awaiting priority classification' : `${supportDuration(sla.resolution_remaining)}${sla.resolution_remaining >= 0 ? ' support time left' : ''}`}</p>
            {sla.resolution_deadline && <small>Due {new Date(sla.resolution_deadline).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} PHT</small>}
            {sla.paused && <small>Waiting: {sla.pause_reason?.replaceAll('_', ' ')}</small>}</div>
        {(sla.response_ever_breached || sla.resolution_ever_breached) && <small>A previous SLA breach is recorded in the history.</small>}
    </div>;
}

export function TicketEditor({ ticket, role, members, onClose, ticketRoute, actor, canAssignDuringHandover, handoverMembers = [] }) {
    const priorityLabels = usePage().props.priorityLabels || defaultPriorityLabels;
    const onReviewHold = ['revision_requested', 'rejected'].includes(ticket.status);
    const canManage = !onReviewHold && (role === 'leader' || (role === 'member' && ticket.assigned_to === actor.id));
    const requester = ticket.creator_id === actor.id;
    // Sort a copy for chronological display; keep backend latest-event lookups unchanged.
    const history = [...(ticket.activities || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || a.id - b.id);
    const tracked = ticket.sla?.enabled;
    const reopening = ticket.status === 'closed';
    const actions = canManage ? (reopening ? [['reopen', 'Reopen ticket']] : [
        ['save', 'Assignment / priority / status'],
        ...(tracked ? [
            ...(!ticket.sla_state?.acknowledged_at ? [['acknowledge', 'Acknowledge and communicate next steps']] : []),
            ['update', 'Send progress update / vendor details'],
            ['delay', 'Document SLA risk / delay and revised estimate'],
            ...(ticket.sla_state?.workaround_accepted_at ? [['reopen', 'Resume original timer after failed workaround']] : []),
            // Existing paused tickets can resume, but no role may create a new pause.
            ...(ticket.sla?.paused && !ticket.sla?.resolution_complete ? [['resume', 'Resume resolution timer']] : []),
            ...(!['resolved', 'closed'].includes(ticket.status) ? [['restore', 'Restore service temporarily'], ...(role === 'leader' && ticket.priority === 'critical' ? [['approve_workaround', 'Accept P1 workaround and recovery plan']] : [])] : []),
        ] : []),
        ...(ticket.status !== 'resolved' ? [['resolve', 'Resolve ticket']] : [['reopen', 'Reopen for further work'], ...(role === 'leader' ? [['close', 'Close ticket']] : [])]),
    ]) : [];
    if (canAssignDuringHandover && !onReviewHold && !reopening) {
        // Delegate only assignment, priority and ordinary status changes, not supervisor approval.
        const saveIndex = actions.findIndex(([value]) => value === 'save');
        if (saveIndex !== -1) actions.splice(saveIndex, 1);
        actions.unshift(['handover_assign', 'Assign / priority / status']);
    }
    if (role === 'leader' && ticket.member_submission && !['closed', 'rejected'].includes(ticket.status)) {
        if (!onReviewHold) actions.push(['send_back', 'Send back for revision']);
        actions.push(['reject', 'Reject ticket']);
    }
    if (requester && !onReviewHold) actions.push(['reply', 'Reply / report a continuing issue'], ...(ticket.status === 'resolved' ? [['confirm', 'Confirm service is working']] : []));
    // Only fields relevant to the selected action are sent. Server authorization
    // independently checks role, assignment, and live/preview boundaries.
    const form = useForm({ action: actions[0]?.[0] || 'save', priority: ticket.priority || 'low', assigned_to: ticket.assigned_to || '', status: '',
        priority_reason: '', note: '', assessment: '', next_steps: '',
        findings: '', troubleshooting_performed: '', corrective_actions: '', resolution_details: '',
        workaround: '', recovery_plan: '', vendor: '', vendor_reference: '', vendor_notified_at: '', next_update_at: '', linked_ticket_id: '', rating: 5 });
    const action = form.data.action;
    const errorSummary = useRef(null);
    const field = (key, label, required = false, rows = 3) => <label key={key}>{label}<textarea required={required} rows={rows} maxLength={key === 'note' ? 10000 : 5000} value={form.data[key]} onChange={e => form.setData(key, e.target.value)} /></label>;
    const submit = e => {
        e.preventDefault();
        form.clearErrors('validation');
        if (form.data.action === 'handover_assign') {
            form.transform(data => ({
                ...(data.assigned_to && Number(data.assigned_to) !== ticket.assigned_to ? { assigned_to: data.assigned_to } : {}),
                ...(data.priority !== ticket.priority ? { priority: data.priority, priority_reason: data.priority_reason } : {}),
                ...(data.status ? { status: data.status } : {}),
                ...(data.note ? { note: data.note } : {}),
            }));
            form.patch(route('tickets.handover.assign', ticket.id), { preserveScroll: true, onSuccess: onClose });
            return;
        }
        form.transform(data => {
            const payload = { action: ['resolve', 'close'].includes(data.action) ? 'save' : data.action };
            const fields = {
                acknowledge: ['assessment', 'next_steps'], resume: ['note'],
                update: ['note', 'vendor', 'vendor_reference', 'vendor_notified_at', 'next_update_at', 'linked_ticket_id'],
                restore: ['workaround', 'recovery_plan'], approve_workaround: ['workaround', 'recovery_plan'],
                resolve: ['findings', 'resolution_details'],
                send_back: ['note'], reject: ['note'], close: ['note'], reopen: ['note'], reply: ['note'], confirm: ['note'], feedback: ['note', 'rating'], save: ['priority_reason', 'note'],
                delay: ['note', 'delay_reason', 'actions_taken', 'assistance_required', 'next_update_at'],
            };
            (fields[data.action] || []).forEach(key => { if (data[key] !== '') payload[key] = data[key]; });
            ['vendor_notified_at', 'next_update_at'].forEach(key => { if (payload[key]) payload[key] = new Date(payload[key]).toISOString(); });
            if (data.action === 'save') {
                if (role === 'leader' && data.priority && data.priority !== ticket.priority) payload.priority = data.priority;
                if (role === 'leader' && data.assigned_to && Number(data.assigned_to) !== ticket.assigned_to) payload.assigned_to = Number(data.assigned_to);
                if (data.status) payload.status = data.status;
            }
            if (data.action === 'resolve') payload.status = 'resolved';
            if (data.action === 'close') payload.status = 'closed';
            if (data.action === 'reopen') payload.status = 'in_progress';
            return payload;
        });
        // Inertia's React transform() returns void. Register the transformer
        // first, then submit separately; chaining prevents every action from sending.
        form.patch(ticketRoute('update', { ticket: ticket.id }), {
            preserveScroll: true, onSuccess: onClose,
            onError: () => errorSummary.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
        });
    };
    return <div className="ticket-overlay" onClick={onClose}>
        <section className="ticket-dialog" role="dialog" aria-modal="true" aria-labelledby="ticket-title" onClick={e => e.stopPropagation()} onKeyDown={e => e.key === 'Escape' && onClose()}>
            <div className="ticket-card-heading"><div><span className="ticket-eyebrow">TICKET #{ticket.ticket_code}</span><h2 id="ticket-title">{ticket.subject}</h2></div><button type="button" onClick={onClose} aria-label="Close ticket">✕</button></div>
            <dl className="ticket-details"><div><dt>Created by</dt><dd>{ticket.employee_name}</dd></div><div><dt>Branch</dt><dd>{ticket.ticket_location?.name || ticket.branch?.name}</dd></div><div><dt>Category</dt><dd>{ticket.category}</dd></div>{ticket.closed_at && <div><dt>Closed at</dt><dd>{new Date(ticket.closed_at).toLocaleString()}</dd></div>}<div><dt>Priority</dt><dd>{priorityLabels[ticket.priority] || 'Low'}</dd></div><div><dt>Status</dt><dd>{labels[ticket.status]}</dd></div><div><dt>Assigned to</dt><dd>{ticket.assignee?.name || 'Unassigned — awaiting leader allocation'}</dd></div><div><dt>Reporting channel</dt><dd>{ticket.reporting_channel || 'portal'}</dd></div></dl>
            <div className="ticket-dialog-intake"><TicketSlaSummary ticket={ticket} /></div>
            <p className="ticket-description">{ticket.description}</p>
            <div className="ticket-dialog-intake"><TicketIntakeDetails ticket={ticket} />{ticket.emergency_reason && <p>Emergency reporting reason: {ticket.emergency_reason}</p>}</div>
            {/* Native validation otherwise stops submission before Inertia can
                display errors. Surface its message beside the save controls too. */}
            {actions.length > 0 && <form onSubmit={submit} onInvalidCapture={e => form.setError('validation', e.target.validationMessage)}>
                <label>Action<select value={action} onChange={e => { form.clearErrors(); form.setData('action', e.target.value); }}>{actions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                {action === 'handover_assign' && <><label>Assign to an IT member
                    <select value={handoverMembers.some(person => Number(person.id) === Number(form.data.assigned_to)) ? form.data.assigned_to : ''} onChange={e => form.setData('assigned_to', e.target.value)}>
                        <option value="">Keep current assignment</option>
                        {handoverMembers.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                    </select>
                </label>
                    <label>Priority<select value={form.data.priority} onChange={e => form.setData('priority', e.target.value)}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    {form.data.priority !== ticket.priority && field('priority_reason', 'Reason for priority change', true)}
                    <label>Status<select value={form.data.status} onChange={e => form.setData('status', e.target.value)}><option value="">Keep current status</option><option value="in_progress">In progress</option></select></label>
                    {field('note', 'Handover / status note', ticket.status === 'resolved' && form.data.status === 'in_progress')}
                </>}
                {action === 'save' && <>
                    {role === 'leader' && <div className="ticket-field-row"><label>Priority<select value={form.data.priority} onChange={e => form.setData('priority', e.target.value)}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Assign IT owner<select value={form.data.assigned_to} onChange={e => form.setData('assigned_to', e.target.value)}><option value="" disabled>Choose IT member</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label></div>}
                    {form.data.priority && form.data.priority !== ticket.priority && field('priority_reason', 'Reason for priority classification / change', true)}
                    <label>Status<select value={form.data.status} onChange={e => form.setData('status', e.target.value)}><option value="">Keep current status</option><option value="in_progress">In progress</option></select></label>
                    {field('note', 'Handover / status note', ticket.status === 'resolved' && form.data.status === 'in_progress')}
                </>}
                {action === 'acknowledge' && <>{field('assessment', 'Initial assessment', true)}{field('next_steps', 'Next steps to communicate to requester', true)}</>}

                {['resume', 'update', 'delay', 'close', 'reopen', 'reply', 'confirm', 'feedback'].includes(action) && field('note', action === 'feedback' ? 'Feedback comments (optional)' : action === 'close' ? 'Closure reason and requester follow-up' : action === 'reopen' ? 'Reason for reopening' : 'Message / reason / findings / next steps', !['confirm', 'feedback'].includes(action))}
                {action === 'send_back' && field('note', 'Explain what the creator needs to revise', true)}
                {action === 'reject' && field('note', 'Rejection reason (optional)')}
                {action === 'delay' && <>{field('delay_reason', 'Reason for anticipated delay', true)}{field('actions_taken', 'Actions already taken', true)}{field('assistance_required', 'Assistance or approval required (or none)', true)}<label>Revised estimate / next update<input required type="datetime-local" value={form.data.next_update_at} onChange={e => form.setData('next_update_at', e.target.value)} /></label></>}
                {['restore', 'approve_workaround'].includes(action) && <>
                    <p className="ticket-form-note">Service is available through a workaround. The ticket stays open until the underlying issue is fixed. Recording restoration does not stop the SLA timer; leader acceptance of a Critical workaround can satisfy the resolution target.</p>
                    {field('workaround', 'How service was restored temporarily', true)}
                    {field('recovery_plan', action === 'approve_workaround' ? 'Recovery plan and expected completion' : 'Remaining work / next steps (optional)', action === 'approve_workaround')}
                </>}
                {/* One fix summary includes actions and verification instead of three overlapping fields. */}
                {action === 'resolve' && <><p className="ticket-form-note">The underlying issue is fixed. Resolving stops the resolution timer and asks the requester to verify; closure remains a separate leader action.</p>{field('findings', 'Issue found', tracked)}{field('resolution_details', 'Fix applied and verification', tracked)}</>}
                {action === 'update' && <>
                    <div className="ticket-field-row"><label>Vendor (optional)<input maxLength={255} value={form.data.vendor} onChange={e => form.setData('vendor', e.target.value)} /></label><label>Vendor reference (optional)<input maxLength={255} value={form.data.vendor_reference} onChange={e => form.setData('vendor_reference', e.target.value)} /></label></div>
                    <div className="ticket-field-row"><label>Vendor notified at<input type="datetime-local" value={form.data.vendor_notified_at} onChange={e => form.setData('vendor_notified_at', e.target.value)} /></label><label>Next update / estimate<input type="datetime-local" value={form.data.next_update_at} onChange={e => form.setData('next_update_at', e.target.value)} /></label></div>
                    <label>Related / follow-up ticket ID (optional)<input type="text" maxLength={24} value={form.data.linked_ticket_id} onChange={e => form.setData('linked_ticket_id', e.target.value)} /></label>
                </>}
                {action === 'feedback' && <label>Support rating<select value={form.data.rating} onChange={e => form.setData('rating', e.target.value)}>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n} / 5</option>)}</select></label>}
                <div ref={errorSummary} aria-live="polite">{Object.entries(form.errors).map(([key, error]) => <p className="ticket-error" role="alert" key={key}>{error}</p>)}</div>
                <div className="ticket-dialog-actions"><button type="button" className="ticket-secondary" onClick={onClose}>Cancel</button><button type="submit" className="ticket-primary" disabled={form.processing}>{form.processing ? 'Saving…' : 'Save and notify'}</button></div>
            </form>}
            <section className="ticket-activity"><h3>Ticket history</h3>{history.length ? history.map(event => <article key={event.id}><strong>{event.type.replaceAll('_', ' ')} · {event.actor?.name || 'SLA scheduler'}</strong><small>{new Date(event.created_at).toLocaleString()}</small><p>{event.message}</p>{Object.entries(event.details || {}).filter(([key, value]) => value != null && (key !== 'linked_ticket_id' || !event.details.linked_ticket_code)).map(([key, value]) => <p key={key}><span>{key.replaceAll('_', ' ')}:</span> {typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>)}</article>) : <p>No activity recorded for this existing ticket.</p>}</section>
        </section>
    </div>;
}
// Changing identity or view remounts TicketScreen so drafts and edit dialogs
// cannot carry over into another test employee.
export default function Index(props) {
    return <TicketScreen key={`${props.ticketUser?.id}:${props.filters.view}`} {...props} />;
}

function TicketLocations({ branches, branchCodes, locations }) {
    const { flash } = usePage().props;
    const form = useForm({ name: '', code: '' });
    const removal = useForm({});
    const remove = location => {
        if (window.confirm(`Remove ${location.name} from new tickets?`)) {
            removal.delete(route('tickets.locations.destroy', location.id), { preserveScroll: true });
        }
    };
    const submit = event => {
        event.preventDefault();
        form.post(route('tickets.locations.store'), { onSuccess: () => form.reset() });
    };

    return <section className="ticket-card ticket-locations">
        <div className="ticket-card-heading"><div><h1>Ticket locations</h1><p>Manage extra locations for ticket requests.</p></div></div>
        {flash?.success && <p role="status">{flash.success}</p>}
        <form onSubmit={submit}>
            <table className="ticket-admin-table">
                <thead><tr><th scope="col">Location name</th><th scope="col">Location code</th><th scope="col">Actions</th></tr></thead>
                <tbody>
                    {branches.map(branch => <tr key={`branch-${branch.id}`}><td data-label="Location">{branch.name}</td><td data-label="Code">{branchCodes[branch.name.trim().toLowerCase()] || '—'}</td><td data-label="Actions">—</td></tr>)}
                    {locations.map(location => <tr key={`location-${location.id}`}>
                        <td data-label="Location">{location.name}</td><td data-label="Code">{location.code}</td>
                        <td data-label="Actions"><button type="button" className="ticket-secondary" disabled={removal.processing}
                            aria-label={`Remove ${location.name}`} onClick={() => remove(location)}>Remove</button></td>
                    </tr>)}
                    <tr>
                        <td data-label="New location"><input aria-label="New location name" required maxLength={120} value={form.data.name} onChange={e => form.setData('name', e.target.value)} />
                            {form.errors.name && <p className="ticket-error" role="alert">{form.errors.name}</p>}</td>
                        <td data-label="Code"><input aria-label="New location code" title="Enter exactly three letters or digits" required minLength={3} maxLength={3} pattern="[A-Za-z0-9]{3}" value={form.data.code} onChange={e => form.setData('code', e.target.value.toUpperCase())} />
                            {form.errors.code && <p className="ticket-error" role="alert">{form.errors.code}</p>}</td>
                        <td />
                    </tr>
                </tbody>
            </table>
            <button type="submit" className="ticket-primary" disabled={form.processing}>+ Add location</button>
        </form>
    </section>;
}

function TicketRevisionForm({ ticket, onClose }) {
    const reason = ticket.activities?.find(event => event.type === 'revision_requested')?.message;
    const form = useForm({
        subject: ticket.subject,
        description: ticket.description,
        affected_asset: ticket.affected_asset || '',
        operational_impact: ticket.operational_impact || '',
        supporting_links: (ticket.supporting_links || []).join('\n'),
        reporting_channel: ticket.reporting_channel || 'portal',
        emergency_reason: ticket.emergency_reason || '',
    });
    const submit = event => {
        event.preventDefault();
        form.transform(data => ({
            ...data,
            supporting_links: data.supporting_links.split(/\r?\n/).map(link => link.trim()).filter(Boolean),
        }));
        form.patch(route('tickets.revisions.update', ticket.id), { onSuccess: onClose, preserveScroll: true });
    };

    return <section className="ticket-card ticket-create ticket-revision">
        <div className="ticket-card-heading"><div>
            <h2>Revise #{ticket.ticket_code}</h2>
            {reason && <p className="ticket-description"><strong>Leader’s comment</strong><br />{reason}</p>}
            <p>{ticket.ticket_location?.name || ticket.branch?.name || 'Unknown location'} · {ticket.category}</p>
        </div></div>
        <form onSubmit={submit}>
            <label>Ticket subject<input required maxLength={180} value={form.data.subject} onChange={e => form.setData('subject', e.target.value)} /></label>
            <label>Affected system, equipment, application or service<input required maxLength={255} value={form.data.affected_asset} onChange={e => form.setData('affected_asset', e.target.value)} /></label>
            <label>Details of issue<textarea required rows={5} maxLength={10000} value={form.data.description} onChange={e => form.setData('description', e.target.value)} /></label>
            <label>Business or clinical operational impact<textarea required rows={3} maxLength={5000} value={form.data.operational_impact} onChange={e => form.setData('operational_impact', e.target.value)} /></label>
            <label>Supporting links (optional, one per line)<textarea rows={3} value={form.data.supporting_links} onChange={e => form.setData('supporting_links', e.target.value)} /></label>
            <label>Reporting channel<select required value={form.data.reporting_channel} onChange={e => form.setData('reporting_channel', e.target.value)}>
                <option value="portal">Portal</option><option value="email">Email</option><option value="viber">Viber</option><option value="messaging_app">Other messaging app</option>
            </select></label>
            {form.data.reporting_channel !== 'portal' && <label>Reason the original ticket could not be created<textarea required rows={3} maxLength={5000} value={form.data.emergency_reason} onChange={e => form.setData('emergency_reason', e.target.value)} /></label>}
            {Object.entries(form.errors).map(([key, error]) => <p key={key} className="ticket-error" role="alert">{error}</p>)}
            <div className="ticket-dialog-actions">
                <button type="button" className="ticket-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="ticket-primary" disabled={form.processing}>{form.processing ? 'Submitting…' : 'Resubmit ticket'}</button>
            </div>
        </form>
    </section>;
}

function TicketHandover({ members, handovers, today }) {
    const { flash } = usePage().props;
    const form = useForm({ member_id: '', starts_on: today, ends_on: today });
    const revocation = useForm({});
    const submit = event => {
        event.preventDefault();
        form.post(route('tickets.handover.store'), { onSuccess: () => form.reset('member_id') });
    };

    return <section className="ticket-card ticket-create ticket-locations">
        <div className="ticket-card-heading"><div>
            <h1>Assignment handover</h1>
            <p>Grant an IT member temporary access to assign tickets, change priority and update status. Both dates are included and follow local clinic time.</p>
        </div></div>
        {flash?.success && <p role="status">{flash.success}</p>}
        <form onSubmit={submit}>
            <label>IT member<select required value={form.data.member_id} onChange={e => form.setData('member_id', e.target.value)}>
                <option value="">Select IT member</option>
                {members.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select></label>
            <div className="ticket-field-row">
                <label>Start date<input type="date" required value={form.data.starts_on} onChange={e => form.setData('starts_on', e.target.value)} /></label>
                <label>End date<input type="date" required min={form.data.starts_on > today ? form.data.starts_on : today} value={form.data.ends_on} onChange={e => form.setData('ends_on', e.target.value)} /></label>
            </div>
            {Object.entries(form.errors).map(([field, error]) => <p key={field} className="ticket-error" role="alert">{error}</p>)}
            <button type="submit" className="ticket-primary" disabled={form.processing || !members.length}>Grant assignment access</button>
        </form>
        {handovers.length ? <div className="ticket-table-wrap"><table className="ticket-admin-table">
            <thead><tr><th>IT member</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{handovers.map(grant => {
                const status = grant.revoked_at ? 'Revoked' : grant.ends_on < today ? 'Expired' : grant.starts_on > today ? 'Scheduled' : 'Active';
                return <tr key={grant.id}>
                    <td data-label="IT member">{grant.member?.name}</td><td data-label="Start">{grant.starts_on}</td><td data-label="End">{grant.ends_on}</td><td data-label="Status">{status}</td>
                    <td data-label="Actions">{['Scheduled', 'Active'].includes(status) && <button type="button" className="ticket-secondary" disabled={revocation.processing}
                        onClick={() => revocation.delete(route('tickets.handover.revoke', grant.id), { preserveScroll: true })}>Revoke</button>}</td>
                </tr>;
            })}</tbody>
        </table></div> : <p className="ticket-empty">No assignment handovers yet.</p>}
    </section>;
}

export function TicketScreen({ priorityLabels = defaultPriorityLabels, prioritySettings = [], submissionAcknowledgement = null, prioritySummary = null, pendingFeedback = [], leaderboard = null, pendingImport = null, leaderSummary = null, memberRating = null, memberSummary = null, employeeSummary = null, creationPage = false, departments = [], filterBranches = [], ticketLocations = [], branchCodes = {}, ticketRole, tickets, filters, categories, branches, members, reports, memberWorkloads = [], slaReport, slaPolicy, ticketUser, canAssignDuringHandover = false, handoverMembers = [], handovers = [], handoverToday = null }) {
    const { auth } = usePage().props;
    // Module content uses the test identity; SidebarLayout keeps the real admin session.
    const actor = ticketUser || auth.user;
    const ticketRoute = (action, params = {}) => {
        const { view, ...query } = params;
        // Screen identity belongs in the path. Export still takes a view filter.
        const page = action === 'index' ? (view || 'dashboard') : action;
        return route(`tickets.${page}`, { ...(view && filters.location_filter ? { location_filter: filters.location_filter } : {}), ...(view && filters.branch_filter ? { branch_filter: filters.branch_filter } : {}), ...(view === 'all' && filters.assignee_filter ? { assignee_filter: filters.assignee_filter } : {}), leaderboard_period: filters.leaderboard_period || 'all', priority_filter: filters.priority_filter || 'all', closed_period: filters.closed_period || '', date_from: filters.date_from || '', date_to: filters.date_to || '', status_filter: filters.status_filter || 'all', sort: filters.sort || 'created_at', direction: filters.direction || 'desc', report_period: filters.report_period || 'all', per_page: filters.per_page || '10', ...(action === 'index' ? query : params) });
    };
    const employee = ticketRole === 'employee';
    const [receipt, setReceipt] = useState(null);
    const lastReceiptId = useRef(null);
    useEffect(() => {
        // Partial dashboard refreshes may retain props: never reopen a dismissed receipt.
        if (employee && submissionAcknowledgement && lastReceiptId.current !== submissionAcknowledgement.id) {
            lastReceiptId.current = submissionAcknowledgement.id;
            setReceipt(submissionAcknowledgement);
        }
    }, [employee, submissionAcknowledgement]);
    const member = ticketRole === 'member';
    const leader = ticketRole === 'leader';
    const revisions = filters.view === 'revisions';
    const dashboardSummary = leader ? leaderSummary : member ? memberSummary : employeeSummary;
    const ranking = leader && !creationPage && filters.view === 'leaderboard';
    const dashboard = !creationPage && filters.view === 'dashboard';
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');
    useEffect(() => { setDateFrom(filters.date_from || ''); setDateTo(filters.date_to || ''); }, [filters.date_from, filters.date_to]);
    const dateErrors = usePage().props.errors || {};
    const [search, setSearch] = useState(filters.search);
    const [selected, setSelected] = useState(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const filterPanelId = useId();
    const actionForTicket = ticket => {
        if (revisions) return 'Edit revision';
        if (['rejected', 'revision_requested'].includes(ticket.status)) return 'View';
        if (leader || ticket.assigned_to === actor.id || (canAssignDuringHandover && ticket.status !== 'closed')) {
            return ticket.status === 'closed' ? 'Reopen' : 'Manage';
        }
        return 'View';
    };
    const openTicket = ticket => {
        setSelected(ticket);
        if (revisions) window.scrollTo(0, 0);
    };
    // Creation has its own route; the list never contains the intake form.
    useEffect(() => { const timer = setInterval(() => { if (!selected && !document.hidden) router.reload({ only: ['canAssignDuringHandover', 'handoverMembers', 'handovers', 'handoverToday', 'tickets', 'slaReport', 'reports', 'memberWorkloads', 'employeeSummary', 'memberSummary', 'leaderSummary', 'memberRating', 'leaderboard', 'pendingFeedback', 'prioritySummary', 'priorityLabels', 'slaPolicy'] }); }, 60000); return () => clearInterval(timer); }, [selected]);
    // Build the form for this role; Laravel independently validates every submitted field.
    const form = useForm({ branch_id: branches.find(b => b.id === actor.branch_id)?.id || branches[0]?.id || (ticketLocations.length ? `location:${ticketLocations[0].id}` : ''), subject: '', description: '', category: '', priority: '',
        employee_department: actor.department || '', affected_asset: '', operational_impact: '',
        supporting_links: '', reporting_channel: employee ? 'portal' : 'email', emergency_reason: '' });
    const submitTicket = e => {
        e.preventDefault();
        // One URL per line becomes a validated JSON array. No image upload occurs.
        form.transform(data => {
            const { emergency_reason, branch_id, ...intake } = data;
            const location = String(branch_id).startsWith('location:');
            // The server supplies creation time; no client timestamp is submitted.
            return { ...intake, ...(location ? { ticket_location_id: branch_id.slice(9) } : { branch_id }), ...(employee ? {} : { emergency_reason }),
            supporting_links: data.supporting_links.split(/\r?\n/).map(url => url.trim()).filter(Boolean),
        }; });
        form.post(ticketRoute('store'), { preserveScroll: true, onSuccess: () => {
            form.reset();
        } });
    };
    const invalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);
    const updateTicketDates = (from, to) => {
        setDateFrom(from);
        setDateTo(to);
        // Do not send an invalid range while the user is adjusting the other bound.
        if (from && to && from > to) return;
        router.get(ticketRoute('index', { view: filters.view, search, date_from: from, date_to: to }), {}, { preserveState: true, preserveScroll: true });
    };
    const clearTicketFilters = () => {
        setDateFrom('');
        setDateTo('');
        setSearch('');
        router.get(ticketRoute('index', { view: filters.view, search: '', date_from: '', date_to: '', branch_filter: '', location_filter: '', status_filter: 'all', priority_filter: 'all', assignee_filter: '', closed_period: '' }), {}, { preserveState: true, preserveScroll: true });
    };
    const sortTickets = (key, direction = filters.sort === key && filters.direction === 'asc' ? 'desc' : 'asc') => {
        router.get(ticketRoute('index', { view: filters.view, search, sort: key, direction }), {}, { preserveScroll: true });
    };
    // Show only the views allowed by the flowchart; backend checks enforce the same boundary.
    const views = employee ? [['dashboard', 'Dashboard'], ['all', 'All my tickets']] : ticketRole === 'leader' ? [['dashboard', 'Dashboard'], ['leaderboard', 'Leaderboard'], ['admin', 'Admin'], ['all', 'All tickets'], ['assigned', 'Assigned to me']] : [['dashboard', 'Dashboard'], ['assigned', 'Assigned to me'], ['revisions', 'Pending revisions'], ['all', 'All tickets']];
    const adminView = ['admin', 'handover', 'sla_settings'].includes(filters.view);
    // Creation links to its own page.
    const sidebarLinks = views.map(([view, label]) => {
        const active = !creationPage && (view === 'admin' ? adminView : filters.view === view);
        return { label, href: ticketRoute('index', { view, branch_filter: '', location_filter: '', assignee_filter: '', status_filter: 'all', closed_period: '' }), active, icon: () => <TicketSidebarIcon kind={view} active={active} /> };
    });
    if (employee || member || leader) sidebarLinks.splice(1, 0, { label: employee ? 'Create ticket' : 'Create ticket', href: ticketRoute('create'), active: creationPage, icon: () => <TicketSidebarIcon kind="create" active={creationPage} /> });
    // Both groups use the same denominator and authorized drill-down scope.
    const renderDashboardCards = cards => <div className="employee-ticket-stats">{cards.map(([key, label, color, caption, reportCount]) => {
        const count = reportCount ?? dashboardSummary?.[key] ?? 0;
        const total = dashboardSummary?.total ?? 0;
        return <Link key={key} className={`ticket-stat employee-stat-${color}`} href={ticketRoute('index', {
            view: member ? 'assigned' : 'all', status_filter: key === 'total' ? 'all' : key,
            priority_filter: 'all', branch_filter: '', location_filter: '', closed_period: '', date_from: '', date_to: '',
        })}>
            <span className="ticket-stat-label">{label}</span><strong>{count}</strong>
            <span className="employee-stat-percentage">{(total ? count / total * 100 : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% of total tickets</span>
            {caption && <span className="ticket-stat-caption">{caption}</span>}
        </Link>;
    })}</div>;
    if (adminView) {
        const showingHandover = filters.view === 'handover';
        const showingSla = filters.view === 'sla_settings';
        return <SidebarLayout activeModule="IT Ticketing Module" sidebarLinks={sidebarLinks}>
            <Head title="Ticketing Admin" />
            <main className="ticketing">
                <header className="ticket-page-heading"><h1>Ticketing Admin</h1></header>
                <nav className="ticket-admin-nav" aria-label="Ticketing admin sections">
                    <Link className="ticket-secondary" href={route('tickets.admin')} aria-current={!showingHandover && !showingSla ? 'page' : undefined}>Locations</Link>
                    <Link className="ticket-secondary" href={route('tickets.admin.handover')} aria-current={showingHandover ? 'page' : undefined}>Handover</Link>
                    <Link className="ticket-secondary" href={route('tickets.admin.sla')} aria-current={showingSla ? 'page' : undefined}>SLA &amp; priorities</Link>
                </nav>
                {showingSla ? <TicketSlaSettings priorities={prioritySettings} /> : showingHandover
                    ? <TicketHandover members={handoverMembers} handovers={handovers} today={handoverToday} />
                    : <TicketLocations branches={filterBranches} branchCodes={branchCodes} locations={ticketLocations} />}
            </main>
        </SidebarLayout>;
    }

    return <SidebarLayout activeModule="IT Ticketing Module" sidebarLinks={sidebarLinks}>
        <Head title="IT Ticketing Module · TCC Purrtal" />
        <main className="ticketing">
            <header className="ticket-page-heading"><div><span className="ticket-eyebrow">TCC PURRTAL / IT SUPPORT</span><h1>IT Ticketing Module</h1><p>{employee ? 'Let us know how we can help. Submit a ticket to the IT team.' : 'Keep every request moving, from first report to resolution.'}</p></div></header>
            {(member || leader || String(actor?.department?.name || actor?.department || auth.user?.department?.name || auth.user?.department || '').trim().toLowerCase() === 'it') && <ITWorkspaceSwitcher current="tickets" />}
            {ranking && <TicketLeaderboard
                data={leaderboard}
                onPeriodChange={period => router.get(ticketRoute('index', { view: 'leaderboard', leaderboard_period: period }), {}, { preserveScroll: true })}
                exportUrl={ticketRoute('export', {
                    view: 'leaderboard',
                    ...(leaderboard?.detail && {
                        leaderboard_member: leaderboard.detail.member.id,
                        leaderboard_detail: leaderboard.detail.type,
                    }),
                })}
                backUrl={ticketRoute('index', { view: 'leaderboard' })}
                detailUrl={(member, detail, page = 1) => ticketRoute('index', { view: 'leaderboard', leaderboard_member: member, leaderboard_detail: detail, leaderboard_page: page })}
                onSelectTicket={setSelected}
            />}
            {dashboard && <section className="ticket-card employee-ticket-dashboard" aria-labelledby="employee-dashboard-title">
                {(leader || employee) && <div className="employee-ticket-actions"><div><h3>{leader ? 'Manage team support' : member ? 'Manage your support workload' : 'Need IT support?'}</h3><p>{leader ? 'Review team tickets, manage your assignments, or log an emergency request.' : member ? 'Review your assignments, browse team tickets, or log an emergency request.' : 'Create a request or check updates on your tickets.'}</p></div><div>
                    <Link className="ticket-primary" href={ticketRoute('create')}>{employee ? '+ Create ticket' : '+ Create ticket'}</Link>
                    <Link className="ticket-secondary" href={ticketRoute('index', { view: employee ? 'all' : 'assigned', status_filter: 'all' })}>{employee ? 'View my tickets' : 'Assigned to me'}</Link>
                    {!employee && <Link className="ticket-secondary" href={ticketRoute('index', { view: 'all', assignee_filter: '', status_filter: 'all' })}>All tickets</Link>}
                </div></div>}
                <div className="ticket-card-heading"><div><h2 id="employee-dashboard-title">{leader ? 'IT team dashboard' : member ? 'My IT ticket dashboard' : 'My ticket dashboard'}</h2><p>{leader ? 'Team tickets at a glance. Percentages use all tickets in this environment.' : member ? 'Your assigned tickets at a glance. Percentages use all tickets currently assigned to you.' : 'Your support requests at a glance. Percentages use all your tickets.'} Open includes resolved tickets awaiting closure.</p></div></div>
                <section className="ticket-dashboard-group" aria-labelledby="dashboard-all-tickets">
                    <div className="ticket-dashboard-group-heading"><h3 id="dashboard-all-tickets">All Tickets</h3><p>Overall ticket volume, including closed tickets.</p></div>
                    {renderDashboardCards([['total', 'Total tickets', 'gray'], ...(!employee ? [['closed', 'Closed tickets', 'green']] : [])])}
                    {leader && <div className="ticket-closure-summary"><div><h3>Closed by period</h3><p>Overlapping periods; do not add together.</p></div><dl>
                        {[['day', 'Today'], ['week', 'This week'], ['month', 'This month'], ['year', 'This year']].map(([period, label]) => <div key={period}><dt>{label}</dt><dd><Link href={ticketRoute('index', { view: 'all', assignee_filter: '', status_filter: 'closed', priority_filter: 'all', closed_period: period, date_from: '', date_to: '' })}>{reports?.[`Closed · ${label}`] ?? 0}</Link></dd></div>)}
                    </dl></div>}
                    {(member || leader) && <section className="ticket-priority-dashboard" aria-labelledby="priority-dashboard-title">
                    <h3 id="priority-dashboard-title">Tickets by priority</h3><p>{member ? 'All tickets assigned to you' : 'All team tickets'} · Select a priority to view matching tickets.</p>
                    <div className="ticket-priority-grid">{Object.entries(priorityLabels).map(([value, label]) => [value, label, ({ critical: 'red', high: 'yellow', medium: 'blue', low: 'green' })[value] || 'blue']).map(([value, label, color]) =>
                        <Link key={value} className={`ticket-stat employee-stat-${color}`} href={ticketRoute('index', { view: member ? 'assigned' : 'all', priority_filter: value, branch_filter: '', location_filter: '', status_filter: 'all', closed_period: '', date_from: '', date_to: '' })}><span className="ticket-stat-label">{label}</span><strong>{prioritySummary?.[value] ?? 0}</strong></Link>
                    )}</div>
                </section>}
                </section>
                <section className="ticket-dashboard-group" aria-labelledby="dashboard-open-tickets">
                    <div className="ticket-dashboard-group-heading"><h3 id="dashboard-open-tickets">Open Tickets</h3><p>Tickets that haven’t been closed yet.</p></div>
                    {renderDashboardCards([
                        ['open', 'Open tickets', 'blue'], ['not_started', 'Not started', 'red'], ['in_progress', 'In progress', 'yellow'],
                        ['resolved', 'Resolved', 'green', 'Awaiting closure'],
                        ...(leader ? [['unassigned', 'Unassigned active', 'blue', 'Not started or in progress', reports?.['Unassigned active']]] : []),
                    ])}
                </section>
                {member && <div className="ticket-member-own-rating" aria-label="Your resolver rating">
                    <div><h3>My support rating</h3><p>Ratings from tickets you resolved. Reassignment does not transfer ratings.</p></div>
                    <div><strong>{memberRating?.count ? `${Number(memberRating.average).toFixed(1)} / 5` : 'Not rated yet'}</strong><span>{memberRating?.count ?? 0} rated ticket{memberRating?.count === 1 ? '' : 's'}</span></div>
                </div>}
                {member && <div className="employee-ticket-actions"><div><h3>{leader ? 'Manage team support' : member ? 'Manage your support workload' : 'Need IT support?'}</h3><p>{leader ? 'Review team tickets, manage your assignments, or log an emergency request.' : member ? 'Review your assignments, browse team tickets, or log an emergency request.' : 'Create a request or check updates on your tickets.'}</p></div><div>
                    <Link className="ticket-primary" href={ticketRoute('create')}>{employee ? '+ Create ticket' : '+ Create ticket'}</Link>
                    <Link className="ticket-secondary" href={ticketRoute('index', { view: employee ? 'all' : 'assigned', status_filter: 'all' })}>{employee ? 'View my tickets' : 'Assigned to me'}</Link>
                    {!employee && <Link className="ticket-secondary" href={ticketRoute('index', { view: 'all', assignee_filter: '', status_filter: 'all' })}>All tickets</Link>}
                </div></div>}

            </section>}
            {/* Render independently of the table view so leaders always see statistics. */}
            {!creationPage && !ranking && !dashboard && ticketRole === 'leader' && <TicketReports reports={reports} ticketRoute={ticketRoute} filters={filters} />}
            {dashboard && ticketRole === 'leader' && slaReport && <TicketSlaPerformance report={slaReport} period={filters.report_period || 'all'}
                onPeriodChange={period => router.get(ticketRoute('index', { view: filters.view, search, report_period: period }))} />}
            {/* Workload totals stay independent of ticket searches and table pagination. */}
            {!creationPage && !ranking && ticketRole === 'leader' && <MemberWorkloads members={memberWorkloads} />}
            {!dashboard && !ranking && <Link className="ticket-primary ticket-emergency-toggle" href={ticketRoute(creationPage ? 'index' : 'create')}>{creationPage ? 'Back to tickets' : employee ? '+ Create ticket' : '+ Create ticket'}</Link>}
            <div className={creationPage ? 'ticket-creation-page' : ''}>
                {creationPage && <section className="ticket-card ticket-create"><div className="ticket-card-heading"><h2>{employee ? 'Submit a Ticket' : 'Create ticket'}</h2></div><form onSubmit={submitTicket}>
                    {!employee && <><label>Emergency reporting channel<select value={form.data.reporting_channel} onChange={e => form.setData('reporting_channel', e.target.value)}><option value="email">Email</option><option value="viber">Viber</option><option value="messaging_app">Other messaging app</option></select></label><label>Why a ticket could not be created<textarea required maxLength={5000} value={form.data.emergency_reason} onChange={e => form.setData('emergency_reason', e.target.value)} /></label></>}
                    <label>Employee name<input value={actor.name} readOnly /></label>
                    {/* Account department is display-only; the server derives its own snapshot. */}
                    <label>Department<input readOnly value={actor.department || ''} placeholder="No department assigned" /></label>
                    {!actor.department && <p className="ticket-error">Your account has no assigned department. Contact your administrator.</p>}
                    <label>Branch affected<select required value={form.data.branch_id} onChange={e => form.setData('branch_id', e.target.value)}><option value="" disabled>Select branch affected</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}{ticketLocations.map(location => <option key={`location:${location.id}`} value={`location:${location.id}`}>{location.name}</option>)}</select></label>
                    <label>Ticket subject<input required maxLength={180} value={form.data.subject} onChange={e => form.setData('subject', e.target.value)} /></label>
                    
                    
                    <label>Affected system, equipment, application or service<input required maxLength={255} value={form.data.affected_asset} onChange={e => form.setData('affected_asset', e.target.value)} /></label>
                    <label>Ticket category<select required value={form.data.category} onChange={e => form.setData('category', e.target.value)}><option value="" disabled>Select category</option>{categories.map(c => <option key={c} value={c}>{c}{categoryExamples[c] ? ` (e.g. ${categoryExamples[c]})` : ''}</option>)}</select></label>
                    {/* Initial priority starts the SLA target immediately; leadership can reclassify without resetting time. */}
                    <label>Initial priority<select required value={form.data.priority} onChange={e => form.setData('priority', e.target.value)}><option value="" disabled>Select priority</option>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <label>Details of issue<textarea required rows={5} maxLength={10000} placeholder="Describe what happened or the service you need…" value={form.data.description} onChange={e => form.setData('description', e.target.value)} /></label>
                    
                    
                    <label>Business or clinical operational impact<textarea required rows={3} maxLength={5000} placeholder="Explain how work or clinical operations are affected" value={form.data.operational_impact} onChange={e => form.setData('operational_impact', e.target.value)} /></label>
                    <label>Screenshot or supporting-file links (optional)<textarea rows={3} placeholder="https://… (one link per line, up to 10)" value={form.data.supporting_links} onChange={e => form.setData('supporting_links', e.target.value)} /><small className="ticket-field-help">HTTP/HTTPS links only. Ensure IT can access the linked files.</small></label>
                    
                    
                    
                    {Object.entries(form.errors).map(([key, error]) => <p className="ticket-error" role="alert" key={key}>{error}</p>)}
                    {(!branches.length && !ticketLocations.length) && <p className="ticket-error">No branch locations are configured. Contact your administrator.</p>}
                    <button className="ticket-primary" disabled={form.processing || (!branches.length && !ticketLocations.length) || !actor.department}>{form.processing ? 'Submitting…' : '+ Submit Ticket'}</button><p className="ticket-form-note">The IT team will be notified when you submit.</p>
                </form></section>}
                {revisions && selected && <TicketRevisionForm key={selected.id} ticket={selected} onClose={() => setSelected(null)} />}
                {!creationPage && !dashboard && !ranking && <section className="ticket-card ticket-list">
                    <div className="ticket-card-heading ticket-list-heading">
                        <div><h2>{views.find(([v]) => v === filters.view)?.[1]}</h2><p>{`${tickets.total} request${tickets.total === 1 ? '' : 's'} · Track and review support tickets`}</p></div>
                        {(member || leader) && <TicketWorkbookControls leader={leader} pending={pendingImport} ticketRoute={ticketRoute} view={filters.view} search={search} />}
                    </div>
                    <>
                        <button type="button" className="ticket-filter-toggle ticket-secondary" aria-expanded={filtersOpen} aria-controls={filterPanelId}
                            onClick={() => setFiltersOpen(open => !open)}>Filters &amp; sort <span aria-hidden="true">{filtersOpen ? '−' : '+'}</span></button>
                        <div id={filterPanelId} className="ticket-filters-panel" data-open={filtersOpen}>
                        <div className="ticket-table-toolbar">
                            <form className="ticket-search" onSubmit={e => { e.preventDefault(); router.get(ticketRoute('index', { view: filters.view, search }), {}, { preserveState: true }); }}><input aria-label="Search tickets" placeholder="Search ticket ID, subject or description…" maxLength={180} value={search} onChange={e => setSearch(e.target.value)} /><button className="ticket-secondary">Search</button></form>
                            {/* Dashboard cards and this selector share the same server-side filter. */}
                            {!revisions && <label className="ticket-page-size">Ticket status<select value={filters.status_filter || 'all'} onChange={e => router.get(ticketRoute('index', { view: filters.view, search, status_filter: e.target.value, closed_period: '' }), {}, { preserveState: true, preserveScroll: true })}>
                                {Object.entries({ all: 'All statuses', open: 'Open tickets', closed: 'Closed tickets', not_started: 'Not started', in_progress: 'In progress', resolved: 'Resolved', ...(!employee ? { revision_requested: 'Pending revision', rejected: 'Denied' } : {}), ...(leader ? { unassigned: 'Unassigned active' } : {}) }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select></label>}
                            <label className="ticket-page-size">Priority<select value={filters.priority_filter || 'all'} onChange={e => router.get(ticketRoute('index', { view: filters.view, search, priority_filter: e.target.value }), {}, { preserveState: true, preserveScroll: true })}>
                                {Object.entries({ all: 'All priorities', ...priorityLabels }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select></label>
                            <label className="ticket-page-size">
                                Branch
                                <select value={filters.location_filter ? `location:${filters.location_filter}` : filters.branch_filter ?? ''} onChange={e => router.get(
                                    ticketRoute('index', { view: filters.view, search, branch_filter: e.target.value.startsWith('location:') ? '' : e.target.value,
                                        location_filter: e.target.value.startsWith('location:') ? e.target.value.slice(9) : '' }),
                                    {}, { preserveState: true, preserveScroll: true }
                                )}>
                                    <option value="">All branches</option>
                                    {filterBranches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                                    {ticketLocations.map(location => <option key={`location:${location.id}`} value={`location:${location.id}`}>{location.name}</option>)}
                                </select>
                            </label>
                            {(member || leader) && filters.view === 'all' && (
                                <label className="ticket-page-size">
                                    Assigned member
                                    <select value={filters.assignee_filter ?? ''} onChange={e => router.get(
                                        ticketRoute('index', { view: 'all', search, assignee_filter: e.target.value }),
                                        {}, { preserveState: true, preserveScroll: true }
                                    )}>
                                        <option value="">All assignees</option>
                                        {members.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                                    </select>
                                </label>
                            )}
                            {/* A size change starts on page one while preserving the selected view and search. */}
                            <label className="ticket-page-size">Tickets per page<select value={filters.per_page || '10'} onChange={e => router.get(ticketRoute('index', { view: filters.view, search, per_page: e.target.value }), {}, { preserveState: true, preserveScroll: true })}>
                                {['5', '10', '15', 'all'].map(size => <option key={size} value={size}>{size === 'all' ? 'All' : size}</option>)}
                            </select></label>
                        </div>
                        {filters.closed_period && <p className="ticket-active-closure-filter">Closed · {{ day: 'Today', week: 'This week', month: 'This month', year: 'This year' }[filters.closed_period]} <Link href={ticketRoute('index', { view: filters.view, search, closed_period: '' })}>Clear closure period</Link></p>}
                        {/* Date-only inputs filter creation dates inclusively in Asia/Manila. */}
                        <div className="ticket-date-filter" aria-label="Creation date filters">
                            <span>Creation date</span>
                            <label>From<input type="date" value={dateFrom} onChange={e => updateTicketDates(e.target.value, dateTo)} /></label>
                            <label>To<input type="date" value={dateTo} onChange={e => updateTicketDates(dateFrom, e.target.value)} /></label>
                            <button type="button" className="ticket-secondary" onClick={clearTicketFilters}>Clear filters</button>
                            {(invalidDateRange || dateErrors.date_from || dateErrors.date_to) && <p className="ticket-error" role="alert">{invalidDateRange ? 'The To date must be on or after the From date.' : dateErrors.date_from || dateErrors.date_to}</p>}
                        </div>
                        {/* Compact columns at wide widths, labeled ticket rows when the list gets narrow. */}
                        <div className="ticket-list-mobile-sort">
                            <label>Sort by<select value={filters.sort || 'created_at'} onChange={e => sortTickets(e.target.value, 'asc')}>{ticketColumns.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                            <button type="button" className="ticket-secondary" onClick={() => sortTickets(filters.sort || 'created_at')}>{filters.direction === 'asc' ? 'Ascending ↑' : 'Descending ↓'}</button>
                        </div>
                        </div>
                        <div className="ticket-tile-grid" aria-label="Tickets">
                            {tickets.data.map(ticket => <TicketTile key={ticket.id} ticket={ticket} action={actionForTicket(ticket)} onOpen={() => openTicket(ticket)} />)}
                        </div>
                        <div className="ticket-list-table-wrap">
                            <table className="ticket-list-table" role="table" aria-label="Tickets">
                                <colgroup>{ticketColumns.map(([key, , width]) => <col key={key} style={{ width: `${width}%` }} />)}</colgroup>
                                <thead role="rowgroup"><tr role="row">
                                    {ticketColumns.map(([key, label]) =>
                                        <th key={key} scope="col" aria-sort={filters.sort === key ? (filters.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" className="ticket-sort" onClick={() => sortTickets(key)}>{label} <span aria-hidden="true">{filters.sort === key ? (filters.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>
                                    )}
                                </tr></thead>
                                <tbody role="rowgroup">{tickets.data.map(t => {
                                    const action = actionForTicket(t);
                                    const openRow = () => openTicket(t);
                                    return <tr role="row" key={t.id}>
                                        <td role="cell" data-label="Ticket subject" className="ticket-subject-cell"><span className="ticket-number">#{t.ticket_code}</span><strong><button type="button" className="ticket-subject-trigger" onClick={openRow}>{t.subject}</button></strong><button type="button" className="ticket-edit" aria-label={`${action} ticket: ${t.subject}`} onClick={openRow}>{action}</button></td>
                                        <td role="cell" data-label="Ticket description" className="ticket-description-cell"><p className="ticket-description">{t.description}</p><details className="ticket-intake-expand"><summary>Request details</summary><TicketIntakeDetails ticket={t} /></details></td>
                                        <td role="cell" data-label="Category"><span className="ticket-category">{t.category}</span></td>
                                        <td role="cell" data-label="Status"><span className={`ticket-status ${t.status}`}>{labels[t.status]}</span></td>
                                        {/* Timeline retains creation-date sorting and displays the full SLA summary. */}
                                        <td role="cell" data-label="Timeline" className="ticket-timeline-cell">
                                            <div>Created: <time dateTime={t.created_at}>{new Date(t.created_at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></div>
                                            <div>Responded Time: {t.sla?.enabled ? (t.sla.response_complete ? supportDuration(t.sla.response_elapsed) : 'Pending') : '—'}</div>
                                            <div>Resolution Time: {t.sla?.enabled ? (t.sla.resolution_complete ? supportDuration(t.sla.resolution_elapsed) : 'Pending') : '—'}</div>
                                        </td>
                                        <td role="cell" data-label="Priority"><span className={`ticket-priority ${t.priority || ''}`}>{priorityLabels[t.priority] || 'Low'}</span></td>
                                        <td role="cell" data-label="Branch">{t.ticket_location?.name || t.branch?.name || '—'}</td>
                                        <td role="cell" data-label="Ticket creator">{t.employee_name}</td>
                                        <td role="cell" data-label="Assigned to">{t.assignee?.name || 'Unassigned'}</td>
                                    </tr>;
                                })}</tbody>
                            </table>
                            {!tickets.data.length && <div className="ticket-empty"><span aria-hidden="true">▤</span><h3>No tickets found</h3><p>{employee ? 'Your submitted tickets will appear here.' : 'Tickets matching this view will appear here.'}</p></div>}
                        </div>
                        <footer className="ticket-pagination"><span>Showing {tickets.from || 0}–{tickets.to || 0} of {tickets.total}</span><div>{tickets.links.map((link, i) => link.url ? <Link key={i} href={link.url} className={link.active ? 'active' : ''} aria-current={link.active ? 'page' : undefined}>{i === 0 ? 'Previous' : i === tickets.links.length - 1 ? 'Next' : link.label}</Link> : <span key={i}>{i === 0 ? 'Previous' : i === tickets.links.length - 1 ? 'Next' : link.label}</span>)}</div></footer>
                    </>
                </section>}
            </div>
        </main>
        {receipt && <TicketSubmissionAcknowledgement ticket={receipt} supportHours={slaPolicy} onClose={() => setReceipt(null)} />}
        {!receipt && !selected && !creationPage && <TicketFeedbackQueue key={`${actor.id}`} tickets={pendingFeedback} ticketRoute={ticketRoute} />}
        {selected && !revisions && <TicketEditor key={selected.id} ticket={selected} role={ticketRole} members={members} canAssignDuringHandover={canAssignDuringHandover} handoverMembers={handoverMembers} actor={actor} ticketRoute={ticketRoute} onClose={() => setSelected(null)} />}
    </SidebarLayout>;
}
