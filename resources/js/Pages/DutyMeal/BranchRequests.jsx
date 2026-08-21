import React, { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import ConfirmModal from '@/Components/ConfirmModal';
import { getDutyMealLinks } from '@/Config/navigation';

export default function BranchRequests({ requests = [] }) {
    const { auth } = usePage().props;
    const dutyMealLinks = getDutyMealLinks(auth);
    const [processingId, setProcessingId] = useState(null);

    // Filter states
    const [filter, setFilter] = useState('pending');
    const filteredRequests = requests.filter(req => req.status === filter);

    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, requestId: null, action: '' });

    const handleAction = (id, action) => {
        setConfirmDialog({ isOpen: true, requestId: id, action });
    };

    const confirmAction = () => {
        const { requestId, action } = confirmDialog;
        setConfirmDialog({ isOpen: false, requestId: null, action: '' });
        setProcessingId(requestId);

        router.post(route('duty-meals.branch-requests.handle', requestId), { status: action }, {
            preserveScroll: true,
            onFinish: () => setProcessingId(null)
        });
    };

    return (
        <SidebarLayout
            user={auth.user}
            activeModule="Duty Meals"
            sidebarLinks={dutyMealLinks}
            header={<h2 className="text-xl font-semibold leading-tight text-slate-800">Branch Transfer Requests</h2>}
        >
            <Head title="Branch Requests" />

            <div className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-fade-in-up">
                
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Branch Overrides</h2>
                        <p className="text-slate-500 text-sm mt-1">Approve or reject duty meal branch transfers for multi-branch staff.</p>
                    </div>

                    <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                        {['pending', 'approved', 'rejected'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilter(status)}
                                className={`px-4 py-2 text-sm font-bold capitalize rounded-md transition-colors ${
                                    filter === status 
                                    ? 'bg-indigo-50 text-indigo-700' 
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Transfer Request</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-1/4">Reason</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {filteredRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium">
                                            No {filter} requests found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRequests.map(req => (
                                        <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">
                                                {new Date(req.duty_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700">
                                                {req.user_name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                                                    <span className="line-through">{req.original_branch}</span>
                                                    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                    </svg>
                                                    <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{req.requested_branch}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 italic">
                                                {req.reason || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {req.status === 'pending' ? (
                                                    <div className="flex justify-center gap-2">
                                                        <button 
                                                            onClick={() => handleAction(req.id, 'approved')}
                                                            disabled={processingId === req.id}
                                                            className="px-3 py-1.5 bg-emerald-100 text-emerald-700 font-bold text-xs uppercase tracking-wider rounded hover:bg-emerald-200 transition-colors"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button 
                                                            onClick={() => handleAction(req.id, 'rejected')}
                                                            disabled={processingId === req.id}
                                                            className="px-3 py-1.5 bg-rose-100 text-rose-700 font-bold text-xs uppercase tracking-wider rounded hover:bg-rose-200 transition-colors"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wide border ${
                                                        req.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                                                    }`}>
                                                        {req.status}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <ConfirmModal 
                show={confirmDialog.isOpen}
                onClose={() => setConfirmDialog({ isOpen: false, requestId: null, action: '' })}
                title={`Confirm ${confirmDialog.action === 'approved' ? 'Approval' : 'Rejection'}`}
                message={`Are you sure you want to ${confirmDialog.action === 'approved' ? 'approve' : 'reject'} this branch transfer request?`}
                confirmText={`Yes, ${confirmDialog.action === 'approved' ? 'Approve' : 'Reject'}`}
                confirmColor={confirmDialog.action === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}
                onConfirm={confirmAction}
            />
        </SidebarLayout>
    );
}