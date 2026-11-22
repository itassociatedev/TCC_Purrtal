import React, { useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';

export default function PhotoReview({ pendingSubmissions, rejectedSubmissions, pendingCount }) {
    const [tab, setTab] = useState('pending');
    const [selected, setSelected] = useState([]);
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState('');
    const pendingRows = Array.isArray(pendingSubmissions) ? pendingSubmissions : (pendingSubmissions?.data || []);
    const rejectedRows = Array.isArray(rejectedSubmissions) ? rejectedSubmissions : (rejectedSubmissions?.data || []);
    const rows = tab === 'pending' ? pendingRows : rejectedRows;
    const selectableIds = useMemo(() => pendingRows.map(row => row.id), [pendingRows]);
    const allSelected = tab === 'pending' && selectableIds.length > 0 && selectableIds.every(id => selected.includes(id));
    const toggleSelected = id => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
    const toggleAll = () => setSelected(allSelected ? [] : selectableIds);
    const submitDecision = (decision, message = '', ids = selected) => {
        if (!ids.length) return;
        router.post(route('asset-photos.bulk-decide'), { ids, decision, reason: message }, { preserveScroll: true, onSuccess: () => setSelected([]) });
    };

    return <SidebarLayout activeModule="Assets" header={<h2 className="font-semibold text-xl text-gray-800">Asset Photo Review</h2>}>
        <Head title="Asset Photo Review" />
        <div className="min-h-[calc(100dvh-8rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-lg font-black text-gray-900">Asset Photo Review</h1><p className="text-sm text-gray-500">{pendingCount} photo(s) awaiting IT approval.</p></div>{tab === 'pending' && <div className="flex flex-wrap gap-2"><PrimaryButton disabled={!selected.length} onClick={() => submitDecision('approved')} className="!py-2 !px-3 text-xs bg-emerald-600 hover:bg-emerald-700">Approve Selected ({selected.length})</PrimaryButton><SecondaryButton disabled={!selected.length} onClick={() => { setReason(''); setRejecting(true); }} className="!py-2 !px-3 text-xs !text-red-600">Reject All Selected</SecondaryButton></div>}</div>
                    <div className="flex gap-2 border-b -mb-4"><button type="button" onClick={() => { setTab('pending'); setSelected([]); }} className={`border-b-2 px-3 py-2 text-xs font-black uppercase tracking-wider ${tab === 'pending' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500'}`}>Pending ({pendingCount})</button><button type="button" onClick={() => { setTab('rejected'); setSelected([]); }} className={`border-b-2 px-3 py-2 text-xs font-black uppercase tracking-wider ${tab === 'rejected' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500'}`}>Rejected History</button></div>
                </div>
                <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>{tab === 'pending' && <th className="px-5 py-3"><input type="checkbox" aria-label="Select all pending photos" checked={allSelected} onChange={toggleAll} /></th>}<th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-500">Asset</th><th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-500">Submitted By</th><th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-500">Status</th><th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-500">Photo</th>{tab === 'rejected' && <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-500">Reviewer Reason</th>}{tab === 'pending' && <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-500">Actions</th>}</tr></thead><tbody className="divide-y divide-gray-200">
                    {rows.map(submission => <tr key={submission.id}>{tab === 'pending' && <td className="px-5 py-4"><input type="checkbox" checked={selected.includes(submission.id)} onChange={() => toggleSelected(submission.id)} aria-label={`Select ${submission.asset?.asset_tag || 'photo'}`} /></td>}<td className="px-5 py-4"><div className="font-bold text-gray-900">{submission.asset?.name || 'Asset unavailable'}</div><div className="font-mono text-xs text-indigo-600">{submission.asset?.asset_tag || '—'}</div></td><td className="px-5 py-4 text-sm text-gray-700">{submission.submitter?.name || '—'}</td><td className="px-5 py-4"><span className={`px-2 py-1 rounded-full text-xs font-bold ${submission.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{submission.status}</span></td><td className="px-5 py-4"><img src={route('asset-photos.preview', submission.id)} alt={`Submitted photo for ${submission.asset?.asset_tag || 'asset'}`} className="h-16 w-24 object-cover rounded border" /></td>{tab === 'rejected' && <td className="px-5 py-4 text-sm text-gray-700"><div>{submission.rejection_reason || 'No reason provided'}</div><div className="mt-1 text-xs text-gray-500">Reviewed by {submission.reviewer?.name || '—'}</div></td>}{tab === 'pending' && <td className="px-5 py-4"><div className="flex gap-2"><PrimaryButton onClick={() => submitDecision('approved', '', [submission.id])} className="!py-1.5 !px-3 text-xs bg-emerald-600 hover:bg-emerald-700">Approve</PrimaryButton><SecondaryButton onClick={() => { setSelected([submission.id]); setReason(''); setRejecting(true); }} className="!py-1.5 !px-3 text-xs !text-red-600">Reject</SecondaryButton></div></td>}</tr>)}
                    {rows.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-gray-500">{tab === 'pending' ? 'No pending photo submissions.' : 'No rejected photos.'}</td></tr>}
                </tbody></table></div>
            </div>
        </div>
        <Modal show={rejecting} onClose={() => setRejecting(false)} maxWidth="md"><div className="p-6"><h2 className="text-lg font-black text-gray-900">Reject selected photos</h2><p className="mt-1 text-sm text-gray-500">Add an optional message explaining what the submitter should correct.</p><textarea value={reason} onChange={event => setReason(event.target.value)} className="mt-4 w-full rounded-md border-gray-300" rows="4" placeholder="Reason for rejection" /><div className="mt-5 flex justify-end gap-2"><SecondaryButton onClick={() => setRejecting(false)}>Cancel</SecondaryButton><PrimaryButton onClick={() => { setRejecting(false); submitDecision('rejected', reason); }} className="bg-red-600 hover:bg-red-700">Reject Selected</PrimaryButton></div></div></Modal>
    </SidebarLayout>;
}
