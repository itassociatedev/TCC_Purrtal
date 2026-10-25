import { useState } from 'react';

// Pages are bounded after edits/removals; filtering or changing screens starts from the first page.
export default function PagedList({ items, children, resetKey = '', label = 'items', initialSize = 10 }) {
    const [state, setState] = useState({ key: resetKey, page: 1, size: initialSize });
    const size = state.size;
    const pages = Math.max(1, Math.ceil(items.length / size));
    const page = state.key === resetKey ? Math.min(state.page, pages) : 1;
    const start = (page - 1) * size;
    const changePage = next => setState({ key: resetKey, page: next, size });
    return <div className="tm-paged-list">{children(items.slice(start, start + size))}{items.length > 5 && <nav className="tm-pagination" aria-label={`${label} pagination`}><span>{start + 1}–{Math.min(start + size, items.length)} of {items.length} {label}</span><label>Per page<select aria-label={`${label} per page`} value={size} onChange={event => setState({ key: resetKey, page: 1, size: Number(event.target.value) })}><option value={5}>5</option><option value={10}>10</option></select></label>{pages > 1 && <div className="tm-pagination-actions"><button type="button" className="tm-secondary" disabled={page === 1} onClick={() => changePage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" className="tm-secondary" disabled={page === pages} onClick={() => changePage(page + 1)}>Next</button></div>}</nav>}</div>;
}
