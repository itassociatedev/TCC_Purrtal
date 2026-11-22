import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';

export default function PhotoReview({ auth, submissions, pendingCount }) {
    const rows = Array.isArray(submissions) ? submissions : (submissions?.data || []);
    const [rejecting, setRejecting] = useState(null);
    const [reason, setReason] = useState('');

    const decide = (submission, decision, message = '') => {
        router.patch(route('asset-photos.decide', submission.id), { decision, reason: message }, { preserveScroll: true });
    };

    return (
        <SidebarLayout activeModule="Assets" header={<h2 className="font-semibold text-xl text-gray-800">Asset Photo Review</h2>}>
            <Head title="Asset Photo Review" />
            <div className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b flex items-center justify-between">
                        <div><h1 className="text-lg font-black text-gray-900">Pending submissions</h1><p className="text-sm text-gray-500">{pendingCount} photo(s) awaiting IT review.</p></div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50"><tr>{['Asset', 'Submitted By', 'Status', 'Photo', 'Actions'].map(label => <th key={label} className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-500">{label}</th>)}</tr></thead>
                            <tbody className="divide-y divide-gray-200">
                                {rows.map(submission => <tr key={submission.id}>
                                    <td className="px-5 py-4"><div className="font-bold text-gray-900">{submission.asset?.name}</div><div className="font-mono text-xs text-indigo-600">{submission.asset?.asset_tag}</div></td>
                                    <td className="px-5 py-4 text-sm text-gray-700">{submission.submitter?.name || '—'}</td>
                                    <td className="px-5 py-4"><span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700">{submission.status}</span></td>
                                    <td className="px-5 py-4"><img src={route('asset-photos.preview', submission.id)} alt="Submitted asset" className="h-16 w-24 object-cover rounded border" /></td>
                                    <td className="px-5 py-4"><div className="flex gap-2"><PrimaryButton onClick={() => decide(submission, 'approved')} className="!py-1.5 !px-3 text-xs bg-emerald-600 hover:bg-emerald-700">Approve</PrimaryButton><SecondaryButton onClick={() => { setRejecting(submission); setReason(''); }} className="!py-1.5 !px-3 text-xs !text-red-600">Reject</SecondaryButton></div></td>
                                </tr>)}
                                {rows.length === 0 && <tr><td colSpan="5" className="p-10 text-center text-gray-500">No pending photo submissions.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <Modal show={Boolean(rejecting)} onClose={() => setRejecting(null)} maxWidth="md">
                <div className="p-6"><h2 className="text-lg font-black text-gray-900">Reject photo</h2><p className="mt-1 text-sm text-gray-500">Add a reason so the submitter can correct and resubmit it.</p><textarea value={reason} onChange={event => setReason(event.target.value)} className="mt-4 w-full rounded-md border-gray-300" rows="4" placeholder="Reason for rejection" /><div className="mt-5 flex justify-end gap-2"><SecondaryButton onClick={() => setRejecting(null)}>Cancel</SecondaryButton><PrimaryButton onClick={() => { decide(rejecting, 'rejected', reason); setRejecting(null); }} className="bg-red-600 hover:bg-red-700">Reject photo</PrimaryButton></div></div>
            </Modal>
        </SidebarLayout>
    );
}
