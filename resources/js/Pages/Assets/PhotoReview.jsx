import React, { useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { getAssetLinks } from '@/Config/navigation';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';

export default function PhotoReview({ pendingSubmissions, rejectedSubmissions, pendingCount }) {
    const { auth } = usePage().props;
    const assetLinks = getAssetLinks(auth);
    const [tab, setTab] = useState('pending');
    const [selected, setSelected] = useState([]);
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState('');
    const [previewing, setPreviewing] = useState(null);

    const pendingRows = Array.isArray(pendingSubmissions) ? pendingSubmissions : (pendingSubmissions?.data || []);
    const rejectedRows = Array.isArray(rejectedSubmissions) ? rejectedSubmissions : (rejectedSubmissions?.data || []);
    const rows = tab === 'pending' ? pendingRows : rejectedRows;
    const reviewFields = submission => {
        const data = submission.asset_data || submission.asset || {};
        return [
            ['Category', data.category], ['Classification', data.classification], ['Branch', data.branch], ['Department', data.department],
            ['Condition', data.condition], ['Serial / model', [data.serial_no, data.model_no].filter(Boolean).join(' / ')],
            ['Color', data.color], ['Assigned to', data.assigned_personnel], ['Area', data.area], ['Supplier', data.supplier_name],
            ['Purchase date', data.purchase_date], ['Warranty expiry', data.warranty_expiration],
            ['Status', data.asset_status], ['Quantity', data.qty], ['Unit value', data.unit_value], ['Total value', data.total_value],
        ].filter(([, value]) => value !== undefined && value !== null && value !== '');
    };
    const selectableIds = useMemo(() => pendingRows.map(row => row.id), [pendingRows]);
    const allSelected = tab === 'pending' && selectableIds.length > 0 && selectableIds.every(id => selected.includes(id));
    const toggleSelected = id => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
    const toggleAll = () => setSelected(allSelected ? [] : selectableIds);
    const submitDecision = (decision, message = '', ids = selected) => {
        if (!ids.length) return;
        router.post(route('asset-photo-review.bulk-decide'), { ids, decision, reason: message }, { preserveScroll: true, onSuccess: () => setSelected([]) });
    };

    const handleKeyDown = (event, submission) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (tab === 'pending') {
                if (event.target.closest('[data-action="approve"]')) {
                    router.post(route('asset-photo-review.decide', submission.id), { decision: 'approved' }, { preserveScroll: true });
                } else if (event.target.closest('[data-action="reject"]')) {
                    setSelected([submission.id]);
                    setReason('');
                    setRejecting(true);
                }
            }
        }
    };

    return <SidebarLayout activeModule="Assets" sidebarLinks={assetLinks} header={<h2 className="font-semibold text-xl text-gray-800">Asset Review</h2>}>
        <Head title="Asset Review" />
        <div className="min-h-[calc(100dvh-8rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-lg font-black text-gray-900">Asset Review</h1>
                            <p className="text-sm text-gray-500">{pendingCount} submission(s) awaiting IT review.</p>
                        </div>
                        {tab === 'pending' && (
                            <div className="flex flex-wrap gap-2">
                                <PrimaryButton
                                    disabled={!selected.length}
                                    onClick={() => submitDecision('approved')}
                                    className="!py-2 !px-3 text-xs bg-emerald-600 hover:bg-emerald-700"
                                >
                                    Approve Selected ({selected.length})
                                </PrimaryButton>
                                <SecondaryButton
                                    disabled={!selected.length}
                                    onClick={() => { setReason(''); setRejecting(true); }}
                                    className="!py-2 !px-3 text-xs !text-red-600"
                                >
                                    Reject All Selected
                                </SecondaryButton>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2 border-b -mb-4" role="tablist" aria-label="Photo review tabs">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={tab === 'pending'}
                            aria-controls="pending-panel"
                            id="pending-tab"
                            onClick={() => { setTab('pending'); setSelected([]); }}
                            className={`border-b-2 px-3 py-2 text-xs font-black uppercase tracking-wider ${tab === 'pending' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500'}`}
                        >
                            Pending ({pendingCount})
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={tab === 'rejected'}
                            aria-controls="rejected-panel"
                            id="rejected-tab"
                            onClick={() => { setTab('rejected'); setSelected([]); }}
                            className={`border-b-2 px-3 py-2 text-xs font-black uppercase tracking-wider ${tab === 'rejected' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500'}`}
                        >
                            Rejected History
                        </button>
                    </div>
                </div>

                <div className="p-6" id={tab === 'pending' ? 'pending-panel' : 'rejected-panel'} role="tabpanel" aria-labelledby={tab === 'pending' ? 'pending-tab' : 'rejected-tab'}>
                    {rows.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="mt-4 text-gray-500">{tab === 'pending' ? 'No pending asset submissions.' : 'No rejected submissions.'}</p>
                        </div>
                    ) : tab === 'rejected' ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-left">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-500">Asset</th>
                                        <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-500">Submitted by</th>
                                        <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-500">Rejection message</th>
                                        <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-500">Reviewed by</th>
                                        <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-500">Reviewed</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {rejectedRows.map(submission => (
                                        <tr key={submission.id}>
                                            <td className="whitespace-nowrap px-4 py-3">
                                                <div className="font-bold text-gray-900">{submission.asset?.name || submission.asset_data?.name || 'Asset unavailable'}</div>
                                                <div className="font-mono text-xs text-indigo-600">{submission.asset?.asset_tag || submission.asset_data?.asset_tag || '—'}</div>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{submission.submitter?.name || '—'}</td>
                                            <td className="max-w-md px-4 py-3 text-sm text-gray-700">{submission.rejection_reason || 'No rejection message was provided.'}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{submission.reviewer?.name || '—'}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{submission.reviewed_at ? new Date(submission.reviewed_at).toLocaleString() : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                            role="list"
                            aria-label="Pending asset submissions"
                        >
                            {rows.map(submission => (
                                <article
                                    key={submission.id}
                                    role="listitem"
                                    tabIndex={0}
                                    onKeyDown={(e) => handleKeyDown(e, submission)}
                                    className={`relative group bg-gray-50 rounded-lg border border-gray-200 overflow-hidden transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent ${selected.includes(submission.id) ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}`}
                                    aria-selected={selected.includes(submission.id)}
                                >
                                    {/* Checkbox */}
                                    {tab === 'pending' && (
                                        <div className="absolute top-2 left-2 z-10">
                                            <label className="inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selected.includes(submission.id)}
                                                    onChange={() => toggleSelected(submission.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    aria-label={`Select ${submission.asset?.asset_tag || 'photo'} for bulk action`}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-5 h-5 rounded border-2 border-gray-300 peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-focus:ring-2 peer-focus:ring-indigo-500 peer-focus:ring-offset-2 transition-colors">
                                                    {selected.includes(submission.id) && (
                                                        <svg className="w-full h-full text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </div>
                                            </label>
                                        </div>
                                    )}

                                    <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                                        <button
                                            type="button"
                                            className="block h-full w-full cursor-zoom-in"
                                            onClick={() => setPreviewing(submission)}
                                            aria-label={`View larger photo for ${submission.asset?.asset_tag || 'asset'}`}
                                        >
                                            <img
                                                src={route('asset-photo-review.preview', submission.id)}
                                                alt={`Submitted photo for ${submission.asset?.asset_tag || 'asset'}`}
                                                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                                                loading="lazy"
                                            />
                                        </button>
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${submission.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                                {submission.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="p-4">
                                        <div className="font-bold text-gray-900 truncate" title={submission.asset?.name || submission.asset_data?.name || 'Asset unavailable'}>
                                            {submission.asset?.name || submission.asset_data?.name || 'Asset unavailable'}
                                        </div>
                                        <div className="font-mono text-xs text-indigo-600 mt-0.5">
                                            {submission.asset?.asset_tag || submission.asset_data?.asset_tag || '—'}
                                        </div>
                                        <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${submission.submission_type === 'new_asset' ? 'bg-indigo-100 text-indigo-700' : submission.submission_type === 'asset_update' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {submission.submission_type === 'new_asset' ? 'New asset + photo' : submission.submission_type === 'asset_update' ? 'Asset update + photo' : 'Photo update'}
                                        </span>
                                        {reviewFields(submission).length > 0 && (
                                            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border border-gray-200 bg-white p-3 text-xs">
                                                {reviewFields(submission).map(([label, value]) => (
                                                    <div key={label} className="min-w-0"><dt className="font-bold text-gray-400">{label}</dt><dd className="truncate font-semibold text-gray-700" title={String(value)}>{value}</dd></div>
                                                ))}
                                            </dl>
                                        )}
                                        <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            <span className="truncate">{submission.submitter?.name || '—'}</span>
                                        </div>

                                        {(
                                            <div className="mt-4 flex gap-2" role="group" aria-label="Photo actions">
                                                <button
                                                    type="button"
                                                    data-action="approve"
                                                    onClick={() => router.post(route('asset-photo-review.decide', submission.id), { decision: 'approved' }, { preserveScroll: true })}
                                                    className="flex-1 py-2 px-3 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    type="button"
                                                    data-action="reject"
                                                    onClick={() => { setSelected([submission.id]); setReason(''); setRejecting(true); }}
                                                    className="flex-1 py-2 px-3 text-xs font-medium text-red-600 bg-red-50 rounded border border-red-200 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>

        <Modal show={Boolean(previewing)} onClose={() => setPreviewing(null)} maxWidth="5xl">
            {previewing && (
                <div className="p-4 sm:p-6">
                    <div className="mb-4 flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-black text-gray-900">{previewing.asset?.asset_tag || 'Asset photo'}</h2>
                            <p className="text-sm text-gray-500">{previewing.asset?.name || 'Asset details unavailable'}</p>
                        </div>
                        <SecondaryButton onClick={() => setPreviewing(null)}>Close</SecondaryButton>
                    </div>
                    <img
                        src={route('asset-photo-review.preview', previewing.id)}
                        alt={`Large submitted photo for ${previewing.asset?.asset_tag || 'asset'}`}
                        className="mx-auto max-h-[75dvh] w-full rounded-lg bg-gray-100 object-contain"
                    />
                </div>
            )}
        </Modal>

        <Modal show={rejecting} onClose={() => setRejecting(false)} maxWidth="md" title="Reject selected photos">
            <div className="p-6">
                <label htmlFor="photo-rejection-reason" className="text-sm text-gray-500">Rejection message (optional). Explain what the submitter should correct.</label>
                <textarea
                    id="photo-rejection-reason"
                    value={reason}
                    onChange={event => setReason(event.target.value)}
                    className="mt-4 w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                    rows="4"
                    placeholder="Reason for rejection"
                    aria-label="Rejection reason"
                />
                <div className="mt-5 flex justify-end gap-2">
                    <SecondaryButton onClick={() => setRejecting(false)}>Cancel</SecondaryButton>
                    <PrimaryButton onClick={() => { setRejecting(false); submitDecision('rejected', reason); }} className="bg-red-600 hover:bg-red-700">
                        Reject Selected
                    </PrimaryButton>
                </div>
            </div>
        </Modal>
    </SidebarLayout>;
}
