// Include a text count and accessible description rather than communicating overdue work by color alone.
export default function OverdueBadge({ count = 0, name = 'Employee' }) {
    if (!count) return null;
    const label = `${name}: ${count} overdue task${count === 1 ? '' : 's'}`;
    return <span className="tm-overdue-count" title={label} aria-label={label}><svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6.2"/><path d="M8 4v5M8 10.5v1"/></svg>{count}</span>;
}
