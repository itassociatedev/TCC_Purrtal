import { Link } from '@inertiajs/react';
import './ITWorkspaceSwitcher.css';

// Render one destination beside the current module title, rather than two competing tabs.
export default function ITWorkspaceSwitcher({ current }) {
    const fromTasks = current === 'tasks';
    const destination = fromTasks ? 'IT Ticketing' : 'Task Module';
    return <Link
        href={route(fromTasks ? 'tickets.dashboard' : 'tasks.index')}
        className="it-module-switch"
        aria-label={`Switch to ${fromTasks ? 'IT Ticketing Module' : 'Task Module'}`}
    >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4 4-4-4 4-4" />
        </svg>
        <span>Switch To {destination}</span>
    </Link>;
}
