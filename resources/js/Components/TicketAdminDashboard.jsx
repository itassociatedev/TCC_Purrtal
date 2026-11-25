import { Link } from '@inertiajs/react';

const sections = [
    { title: 'Locations', routeName: 'tickets.admin.locations', tone: 'blue',
        description: 'View clinic locations and manage additional locations used in ticket requests.',
        icon: 'M12 22s8-7 8-13a8 8 0 1 0-16 0c0 6 8 13 8 13ZM12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z' },
    { title: 'Handover', routeName: 'tickets.admin.handover', tone: 'green',
        description: 'Give an IT member temporary assignment, priority and status access for selected dates.',
        icon: 'M3 8h16m-4-4 4 4-4 4M21 16H5m4-4-4 4 4 4' },
    { title: 'SLA & Priorities', routeName: 'tickets.admin.sla', tone: 'purple',
        description: 'Set SLA targets, manage priority order, and add, remove or restore priorities.',
        icon: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z' },
];

// These cards are navigation only. Each destination still enforces supervisor access on the server.
export default function TicketAdminDashboard() {
    return <section aria-labelledby="ticket-admin-dashboard-title">
        <div className="ticket-card-heading"><div><h2 id="ticket-admin-dashboard-title">Administration Dashboard</h2><p>Choose an area to manage the ticketing module.</p></div></div>
        <div className="ticket-admin-dashboard-grid">{sections.map(section => <Link key={section.routeName}
            href={route(section.routeName)} className={`ticket-card ticket-admin-dashboard-card ticket-admin-tone-${section.tone}`}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={section.icon} /></svg>
            <h3>{section.title}</h3><p>{section.description}</p><span>Open {section.title} <span aria-hidden="true">→</span></span>
        </Link>)}</div>
    </section>;
}
