import { Link } from '@inertiajs/react';

export default function ITWorkspaceSwitcher({ current, ticketPreviewRole = null }) {
    return (
        <nav aria-label="IT workspace views" className="tm-it-workspace-switcher" role="navigation">
            <Link
                href={route('tasks.index')}
                aria-current={current === 'tasks' ? 'page' : undefined}
                className={current === 'tasks' ? 'active' : ''}
            >
                Tasks
            </Link>
            <Link
                href={ticketPreviewRole
                    ? route('tickets.preview.dashboard', { preview_role: ticketPreviewRole })
                    : route('tickets.dashboard')}
                aria-current={current === 'tickets' ? 'page' : undefined}
                className={current === 'tickets' ? 'active' : ''}
            >
                IT Tickets
            </Link>
        </nav>
    );
}
