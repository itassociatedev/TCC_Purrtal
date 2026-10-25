import Modal from '@/Components/Modal';
import { getHRAdminLinks } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { formatAppDate } from '@/Utils/date';
import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { canViewModule, canApproveModule } from '@/Config/navigation';

export default function HRAdminOverview({ auth, requests }) {
    const hrLinks = getHRAdminLinks(auth);
    const { system } = usePage().props;

    if (!canViewModule(auth, 'documents') && !canApproveModule(auth, 'form_2316_approvals') && !canViewModule(auth, 'hr_overview')) {
        return (
            <SidebarLayout activeModule="HR ADMIN" sidebarLinks={hrLinks}>
                <Head title="Access Denied" />
                <div className="py-12 max-w-4xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                        <p className="text-gray-600">You do not have permission to view this section.</p>
                    </div>
                </div>
            </SidebarLayout>
        );
    }

    const canAct = canApproveModule(auth, 'form_2316_approvals');

    const requestList = requests || [];
    const ITEMS_PER_PAGE = 10;

    // --- TAB & FILTER STATES ---
    const [activeTab, setActiveTab] = useState('action-required');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // --- SORT STATE ---
    const [sortField, setSortField] = useState('date');
    const [sortDirection, setSortDirection] = useState('desc');

    // --- PAGINATION STATE ---
    const [currentPage, setCurrentPage] = useState(1);

    const toggleSort = (field) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection(field === 'date' ? 'desc' : 'asc');
        }
    };

    const renderHeaderSortButton = (field) => {
        const isActive = sortField === field;
        const upClass = isActive && sortDirection === 'asc' ? 'text-gray-900' : 'text-gray-300';
        const downClass = isActive && sortDirection === 'desc' ? 'text-gray-900' : 'text-gray-300';

        return (
            <button
                type="button"
                onClick={() => toggleSort(field)}
                className="ml-2 inline-flex items-center justify-center hover:opacity-80 transition"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                    <g className={upClass} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 17V7" />
                        <path d="M4 10l3-3 3 3" />
                    </g>
                    <g className={downClass} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 7v10" />
                        <path d="M14 14l3 3 3-3" />
                    </g>
                </svg>
            </button>
        );
    };

    // --- VIEW DETAILS MODAL STATE ---
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);

    const openViewModal = (req) => {
        setSelectedRequest(req);
        setIsViewModalOpen(true);
    };

    const closeViewModal = () => {
        setIsViewModalOpen(false);
        setTimeout(() => setSelectedRequest(null), 300);
    };

    // --- APPROVE MODAL STATE ---
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [approvingId, setApprovingId] = useState(null);

    // --- ACTION HANDLER ---
    const handleAction = (id, actionType) => {
        if (actionType === 'approve' && canAct) {
            setApprovingId(id);
            setIsApproveModalOpen(true);
            return;
        }
    };

    // --- SUBMIT APPROVAL ---
    const submitApprove = () => {
        if (!canAct || approvingId === null) {
            setIsApproveModalOpen(false);
            setApprovingId(null);
            return;
        }

        router.patch(route('hr.admin.update-status', approvingId), {
            action: 'approve'
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setIsApproveModalOpen(false);
                setApprovingId(null);
            }
        });
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Pending HR': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'General Accounting': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'Released': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    // --- TAB & SEARCH/DATE FILTERING ---
    const filteredRequests = useMemo(() => {
        return requestList.filter((req) => {
            // 1. Tab Filter
            if (activeTab === 'action-required' && req.status !== 'Pending HR') return false;
            if (activeTab === 'in-progress' && req.status !== 'General Accounting') return false;
            if (activeTab === 'completed' && req.status !== 'Released') return false;

            // 2. Search Filter (by Employee Name)
            if (searchQuery) {
                const query = searchQuery.toLowerCase().trim();
                const employeeName = (req.user?.name || req.name || '').toLowerCase();
                
                if (!employeeName.includes(query)) {
                    return false;
                }
            }

            // 3. Date Range Filter
            let matchesDate = true;
            if (startDate || endDate) {
                const reqDate = new Date(req.created_at);
                reqDate.setHours(0, 0, 0, 0);

                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    if (reqDate < start) matchesDate = false;
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (reqDate > end) matchesDate = false;
                }
            }

            return matchesDate;
        });
    }, [requestList, activeTab, searchQuery, startDate, endDate]);

    // --- SORTING ---
    const sortedRequests = useMemo(() => {
        return [...filteredRequests].sort((a, b) => {
            let aValue = '';
            let bValue = '';

            switch (sortField) {
                case 'requestor':
                    aValue = (a.user?.name || '').toLowerCase();
                    bValue = (b.user?.name || '').toLowerCase();
                    break;
                case 'date':
                    aValue = new Date(a.created_at).getTime();
                    bValue = new Date(b.created_at).getTime();
                    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
                case 'type':
                    aValue = (a.type === 'COE' ? 'COE' : 'Form 2316').toLowerCase();
                    bValue = (b.type === 'COE' ? 'COE' : 'Form 2316').toLowerCase();
                    break;
                default:
                    return 0;
            }

            const comparison = aValue.localeCompare(bValue, undefined, {
                numeric: true,
                sensitivity: 'base',
            });

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [filteredRequests, sortField, sortDirection]);

    // --- RESET PAGE WHEN FILTERS CHANGE ---
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, sortField, sortDirection, searchQuery, startDate, endDate]);

    const totalPages = Math.max(1, Math.ceil(sortedRequests.length / ITEMS_PER_PAGE));

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const paginatedRequests = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [sortedRequests, currentPage]);

    return (
        <SidebarLayout activeModule="HR ADMIN" sidebarLinks={hrLinks}>
            <Head title="HR Admin Overview" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">

                    <div className="mb-6">
                        <h1 className="text-2xl font-semibold text-gray-900">Pending Document Requests</h1>
                        <p className="text-gray-500 text-sm mt-1">Review and approve employee document requests.</p>
                    </div>

                    {/* TABS */}
                    <div className="border-b border-gray-200 mb-6 flex gap-6 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('action-required')}
                            className={`pb-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap ${
                                activeTab === 'action-required'
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Action Required
                        </button>
                        <button
                            onClick={() => setActiveTab('in-progress')}
                            className={`pb-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap ${
                                activeTab === 'in-progress'
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            In Progress
                        </button>
                        <button
                            onClick={() => setActiveTab('completed')}
                            className={`pb-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap ${
                                activeTab === 'completed'
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Completed / History
                        </button>
                    </div>

                    {/* 🟢 FILTER WIDGET (Search + Dates) */}
                    <div className="mb-6 bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Live Search Bar */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Search Employee</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Type a name..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Start Date */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                                />
                            </div>

                            {/* End Date */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                                />
                            </div>
                        </div>

                        {/* Reset Filters Button */}
                        {(searchQuery || startDate || endDate) && (
                            <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
                                <button
                                    onClick={() => { setSearchQuery(''); setStartDate(''); setEndDate(''); }}
                                    className="text-sm text-gray-500 hover:text-gray-800 font-semibold bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-md transition-colors"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </div>

                    {/* TABLE CONTAINER */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                        {sortedRequests.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                {searchQuery || startDate || endDate ? 'No requests match your current filters.' : 'No requests found in this category.'}
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto overflow-y-auto max-h-[400px] relative w-full custom-scrollbar">
                                    <table className="min-w-full divide-y divide-gray-200 text-left text-sm text-gray-600">
                                        <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-sm text-gray-500 uppercase tracking-wider text-[11px] font-bold">
                                            <tr>
                                                <th className="px-6 py-4">
                                                    <div className="flex items-center">
                                                        <span>Date</span>
                                                        {renderHeaderSortButton('date')}
                                                    </div>
                                                </th>
                                                <th className="px-6 py-4">
                                                    <div className="flex items-center">
                                                        <span>Requestor</span>
                                                        {renderHeaderSortButton('requestor')}
                                                    </div>
                                                </th>
                                                <th className="px-6 py-4">
                                                    <div className="flex items-center">
                                                        <span>Document Type</span>
                                                        {renderHeaderSortButton('type')}
                                                    </div>
                                                </th>
                                                <th className="px-6 py-4">Details / Reason</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>

                                        <tbody className="bg-white divide-y divide-gray-100">
                                            {paginatedRequests.map((req) => (
                                                <tr
                                                    key={req.id}
                                                    onClick={() => openViewModal(req)}
                                                    className="hover:bg-gray-50 cursor-pointer transition-colors group"
                                                >
                                                    <td className="px-6 py-4 font-medium text-gray-500 whitespace-nowrap">
                                                        {formatAppDate(req.created_at, system?.timezone)}
                                                    </td>

                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="font-bold text-gray-900">{req.user?.name || 'Unknown User'}</div>
                                                        <div className="text-xs text-gray-500">{req.user?.email || ''}</div>
                                                    </td>

                                                    <td className="px-6 py-4 font-bold text-indigo-900 whitespace-nowrap">
                                                        {req.type === 'COE' ? 'COE' : 'Form 2316'}
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        {req.type === 'COE' ? (
                                                            <div className="max-w-xs">
                                                                <span className="font-semibold block text-gray-800">{req.reason}</span>
                                                                {req.specific_details && (
                                                                    <span className="text-xs text-gray-500 break-all line-clamp-2">
                                                                        {req.specific_details}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 italic">Standard Tax Form</span>
                                                        )}
                                                    </td>

                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${getStatusStyle(req.status)}`}>
                                                            {req.status}
                                                        </span>
                                                    </td>

                                                    <td
                                                        className="px-6 py-4 text-right whitespace-nowrap"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {activeTab === 'action-required' && req.status === 'Pending HR' ? (
                                                            canAct ? (
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button
                                                                        onClick={() => handleAction(req.id, 'approve')}
                                                                        className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition-colors shadow-sm"
                                                                        title="Approve this request"
                                                                    >
                                                                        Approve
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-gray-400 italic font-medium">View Only</span>
                                                            )
                                                        ) : (
                                                            <span className="text-xs text-gray-400 italic">Processed</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {sortedRequests.length > ITEMS_PER_PAGE && (
                                    <div className="px-6 py-4 border-t border-gray-100 bg-white flex items-center justify-between">
                                        <p className="text-sm text-gray-500">
                                            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sortedRequests.length)} of {sortedRequests.length} requests
                                        </p>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                                disabled={currentPage === 1}
                                                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Previous
                                            </button>
                                            <span className="text-sm text-gray-600">
                                                Page {currentPage} of {totalPages}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                                disabled={currentPage === totalPages}
                                                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* --- VIEW DETAILS MODAL --- */}
            <Modal show={isViewModalOpen} onClose={closeViewModal} maxWidth="md">
                {selectedRequest && (
                    <div className="p-6 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b pb-4 mb-5">
                            <h2 className="text-xl font-bold text-gray-900">Request Details</h2>
                            <button onClick={closeViewModal} className="text-gray-400 hover:text-gray-600">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Requestor</label>
                                <p className="mt-1 text-sm font-semibold text-gray-900">
                                    {selectedRequest.user?.name || 'Unknown User'}
                                </p>
                                <p className="text-xs text-gray-500">{selectedRequest.user?.email || ''}</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Document Type</label>
                                <p className="mt-1 text-sm font-semibold text-indigo-900">
                                    {selectedRequest.type === 'COE' ? 'Certificate of Employment' : 'Form 2316'}
                                </p>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Date Requested</label>
                                <p className="mt-1 text-sm text-gray-900">
                                    {formatAppDate(selectedRequest.created_at, system?.timezone)}
                                </p>
                            </div>

                            {selectedRequest.type === 'COE' && (
                                <>
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Reason</label>
                                        <p className="mt-1 text-sm text-gray-900">{selectedRequest.reason}</p>
                                    </div>

                                    {selectedRequest.specific_details && (
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Specific Details</label>
                                            <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap break-all">{selectedRequest.specific_details}</p>
                                        </div>
                                    )}
                                </>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Current Status</label>
                                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold uppercase tracking-wide ${getStatusStyle(selectedRequest.status)}`}>
                                    {selectedRequest.status}
                                </span>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end pt-4 border-t">
                            <button
                                onClick={closeViewModal}
                                className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none transition-colors"
                            >
                                Close Window
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* --- APPROVE CONFIRMATION MODAL --- */}
            <Modal show={isApproveModalOpen && canAct} onClose={() => setIsApproveModalOpen(false)} maxWidth="sm">
                <div className="p-6">
                    <div className="flex items-center justify-between border-b pb-4 mb-5">
                        <h2 className="text-xl font-bold text-gray-900">Confirm Approval</h2>
                        <button onClick={() => setIsApproveModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <p className="text-sm text-gray-700 mb-6 mt-2">
                        Are you sure you want to approve this document request? The document will be moved to the next step in the workflow.
                    </p>

                    <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={() => setIsApproveModalOpen(false)}
                            className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={submitApprove}
                            disabled={!canAct}
                            className={`rounded-md px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors ${canAct ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
                        >
                            Confirm Approve
                        </button>
                    </div>
                </div>
            </Modal>

        </SidebarLayout>
    );
}