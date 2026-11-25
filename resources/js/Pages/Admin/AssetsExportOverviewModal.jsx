import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import PageNumberInput from '@/Components/PageNumberInput';

const peso = (value) => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const branchLabel = (branch) => {
    if (!branch) return 'No branch';
    if (typeof branch === 'object') return branch.name || branch.code || 'No branch';
    const text = String(branch);
    if (text.startsWith('{')) {
        try { const parsed = JSON.parse(text); return parsed.name || parsed.code || 'No branch'; } catch { return text; }
    }
    return text;
};

const countBy = (assets, pick) => Object.entries(assets.reduce((acc, asset) => {
    const key = pick(asset) || '—';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
}, {})).sort((a, b) => b[1] - a[1]);

const lineValue = (asset) => (Number(asset.unit_value) || 0) * Math.max(1, Number(asset.qty) || 1);

/**
 * Read-only overview of what the Excel masterlist will contain (the assets currently shown in the table).
 * The search box and paging below only change what is listed here; the file always contains every asset.
 */
export default function AssetsExportOverviewModal({ show, onClose, assets, onDownload }) {
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);

    useEffect(() => { if (show) { setQuery(''); setPage(1); } }, [show]);
    useEffect(() => { setPage(1); }, [query]);

    const summary = useMemo(() => ({
        totalValue: assets.reduce((sum, asset) => sum + lineValue(asset), 0),
        units: assets.reduce((sum, asset) => sum + Math.max(1, Number(asset.qty) || 1), 0),
        branches: countBy(assets, (asset) => branchLabel(asset.branch)),
        conditions: countBy(assets, (asset) => asset.condition),
        assigned: assets.filter((asset) => asset.user?.name || asset.assigned_personnel).length,
    }), [assets]);

    const visible = useMemo(() => {
        const term = query.trim().toLowerCase();
        if (!term) return assets;
        return assets.filter((asset) => [asset.name, asset.asset_tag, branchLabel(asset.branch), asset.user?.name || asset.assigned_personnel, asset.condition, asset.category]
            .some((value) => String(value || '').toLowerCase().includes(term)));
    }, [assets, query]);

    // 10 rows per page, but a search shows every match at once (12 matches means 12 rows).
    const pageSize = query.trim() ? Math.max(10, visible.length) : 10;
    const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageRows = visible.slice(start, start + pageSize);

    const stat = (label, value) => (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-[11px] font-black uppercase tracking-wider text-gray-400">{label}</div>
            <div className="mt-1 break-words text-lg font-black text-gray-900 sm:text-xl">{value}</div>
        </div>
    );

    const breakdown = (title, rows) => (
        <div className="rounded-lg border border-gray-200 p-4">
            <div className="text-[11px] font-black uppercase tracking-wider text-gray-400">{title}</div>
            <ul className="mt-2 space-y-1 text-sm">
                {rows.map(([name, count]) => (
                    <li key={name} className="flex justify-between gap-3"><span className="font-bold text-gray-700">{name}</span><span className="font-mono text-gray-500">{count}</span></li>
                ))}
            </ul>
        </div>
    );

    const pagerButton = 'rounded border border-gray-300 px-3 py-1 font-bold disabled:opacity-40';

    return (
        <Modal show={show} onClose={onClose} maxWidth="3xl">
            <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Export Asset Excel</h2>
                        <p className="mt-1 text-sm text-gray-500">Overview of what will be in the Excel file: only the rows you ticked in the table.</p>
                    </div>
                    <SecondaryButton onClick={onClose}>Close</SecondaryButton>
                </div>

                <p className="mt-3 text-xs text-gray-400">To change what is exported, close this window and tick or untick rows in the table.</p>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {stat('Assets', assets.length)}
                    {stat('Total units', summary.units)}
                    {stat('Assigned', `${summary.assigned} / ${assets.length}`)}
                    {stat('Total value', peso(summary.totalValue))}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {breakdown('By branch', summary.branches)}
                    {breakdown('By condition', summary.conditions)}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[11px] font-black uppercase tracking-wider text-gray-400">All {assets.length} assets in the file</div>
                    <div className="flex flex-wrap items-center gap-3">
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search this list..."
                            className="w-56 rounded-md border-gray-300 text-xs font-bold shadow-sm"
                        />
                    </div>
                </div>

                <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-gray-200">
                    <table className="min-w-full text-xs">
                        <thead className="sticky top-0 bg-[#2C4676] text-white">
                            <tr>{['#', 'Name', 'Tag', 'Branch', 'Assigned To', 'Condition', 'Total Value'].map((head) => <th key={head} className="px-3 py-2 text-left font-bold">{head}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {pageRows.map((asset, index) => (
                                <tr key={asset.id}>
                                    <td className="px-3 py-2 text-gray-400">{start + index + 1}</td>
                                    <td className="px-3 py-2 font-bold text-gray-800">{asset.name}</td>
                                    <td className="px-3 py-2 font-mono text-gray-600">{asset.asset_tag}</td>
                                    <td className="px-3 py-2 text-gray-600">{branchLabel(asset.branch)}</td>
                                    <td className="px-3 py-2 text-gray-600">{asset.user?.name || asset.assigned_personnel || '—'}</td>
                                    <td className="px-3 py-2 text-gray-600">{asset.condition || '—'}</td>
                                    <td className="px-3 py-2 text-right font-mono text-gray-700">{peso(lineValue(asset))}</td>
                                </tr>
                            ))}
                            {pageRows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center font-bold text-gray-400">No assets match your search.</td></tr>}
                        </tbody>
                    </table>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
                    <span>
                        {visible.length === 0 ? 'Showing 0' : `Showing ${start + 1} to ${Math.min(start + pageSize, visible.length)} of ${visible.length}`}
                        {query.trim() && ` (filtered from ${assets.length})`}
                    </span>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setPage(1)} disabled={currentPage === 1} className={pagerButton}>«</button>
                        <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} className={pagerButton}>Prev</button>
                        <span className="flex items-center gap-1 px-2 font-bold text-gray-700">Page <PageNumberInput value={currentPage} max={totalPages} onChange={setPage} /> of {totalPages}</span>
                        <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages} className={pagerButton}>Next</button>
                        <button type="button" onClick={() => setPage(totalPages)} disabled={currentPage === totalPages} className={pagerButton}>»</button>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                    <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
                    <PrimaryButton type="button" disabled={assets.length === 0} onClick={onDownload}>Download Excel</PrimaryButton>
                </div>
            </div>
        </Modal>
    );
}
