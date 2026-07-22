import { getHRLinks } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

import { moduleHasAccess } from '@/Config/navigation';

import ConfirmModal from '@/Components/ConfirmModal';

export default function ApprovalRequest({ auth, requests = [], userRole = '', branches = [] }) {

    // Global Confirm Modal
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false, title: '', message: '', confirmText: '', confirmColor: '', onConfirm: () => {}
    });

    // --- STATE MANAGEMENT ---
    const exactUserRole = userRole;
    const roleLower = String(userRole).toLowerCase().trim();

    const isAdmin = roleLower === 'admin';
    const isExecutive = roleLower === 'director of corporate services and operations' || isAdmin;

    const isRequesterOnly = roleLower.includes('tl') ||
                            roleLower.includes('team leader') ||
                            roleLower === 'marketing manager';

    const hrLinks = getHRLinks(auth.user.role?.name || 'Employee', auth);

    if (!moduleHasAccess(auth, 'hr')) {
        return (
            <SidebarLayout user={auth.user} activeModule="HR MENU" sidebarLinks={hrLinks}>
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

    

    const [activeTab, setActiveTab] = useState((isRequesterOnly && !isAdmin) ? 'in-progress' : 'action-required');
    
    // 🟢 NEW: Search Bar State
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // --- REJECTION MODAL STATE ---
    const [rejectModal, setRejectModal] = useState({ isOpen: false, requestId: null, reason: '' });

    const openRejectModal = (requestId) => setRejectModal({ isOpen: true, requestId, reason: '' });
    const closeRejectModal = () => setRejectModal({ isOpen: false, requestId: null, reason: '' });

    const submitRejection = () => {
        router.patch(route('hr.manpower-requests.update-status', rejectModal.requestId), {
            status: 'Rejected',
            rejection_reason: rejectModal.reason
        }, {
            preserveScroll: true,
            onSuccess: () => {
                closeRejectModal();
                closeModal(); 
            }
        });
    };

    // --- SORTING / PAGINATION ---
    const ITEMS_PER_PAGE = 10;
    const [sortField, setSortField] = useState('requester');
    const [sortDirection, setSortDirection] = useState('asc');
    const [currentPage, setCurrentPage] = useState(1);

    const toggleSort = (field) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection('asc');
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

    const getSortableValue = (req, field) => {
        switch (field) {
            case 'requester': return req.requester?.name || '';
            case 'position': return req.position?.name || '';
            case 'status': return req.status || '';
            default: return '';
        }
    };

    // --- SIMPLIFIED ACTION HELPER (For Approvals) ---
    const confirmAction = (requestId, status) => {
        if (status === 'Rejected') {
            openRejectModal(requestId);
            return;
        }

        setConfirmDialog({
            isOpen: true,
            title: `Endorse Request`,
            message: `Are you sure you want to endorse this manpower request?`,
            confirmText: 'Endorse',
            confirmColor: 'bg-indigo-600 hover:bg-indigo-700',
            onConfirm: () => {
                router.patch(route('hr.manpower-requests.update-status', requestId), {
                    status: status
                }, {
                    preserveScroll: true,
                    onSuccess: () => {
                        closeConfirmModal();
                        closeModal();
                    }
                });
            }
        });
    };

    const closeConfirmModal = () => setConfirmDialog({ ...confirmDialog, isOpen: false });

    const openModal = (req) => {
        setSelectedRequest(req);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setTimeout(() => setSelectedRequest(null), 200);
    };

    // --- FILTERING LOGIC ---
    const getFilteredRequests = () => {
        return requests.filter(req => {
            // 1. Tab Filtering
            if (activeTab === 'completed' && req.status !== 'Approved' && req.status !== 'Rejected') return false;

            const currentApproverNeeded = req.workflow_path ? req.workflow_path[req.current_step] : null;
            const isMyTurn = currentApproverNeeded === exactUserRole || isExecutive;

            if (activeTab === 'action-required' && (req.status !== 'Pending' || !isMyTurn)) return false;
            if (activeTab === 'in-progress' && (req.status !== 'Pending' || isMyTurn)) return false;

            // 🟢 2. NEW: Search Filtering (by Requester Name or Position)
            if (searchQuery) {
                const query = searchQuery.toLowerCase().trim();
                const requesterName = (req.requester?.name || '').toLowerCase();
                const positionName = (req.position?.name || '').toLowerCase();
                
                if (!requesterName.includes(query) && !positionName.includes(query)) {
                    return false;
                }
            }

            return true;
        });
    };

    const displayedRequests = useMemo(() => {
        const filtered = getFilteredRequests();
        return [...filtered].sort((a, b) => {
            const aValue = getSortableValue(a, sortField).toLowerCase();
            const bValue = getSortableValue(b, sortField).toLowerCase();
            const comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [requests, activeTab, sortField, sortDirection, exactUserRole, isAdmin, searchQuery]);

    // 🟢 NEW: Reset to page 1 if tab, sort, or search changes
    useEffect(() => { setCurrentPage(1); }, [activeTab, sortField, sortDirection, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(displayedRequests.length / ITEMS_PER_PAGE));

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    const paginatedRequests = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return displayedRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [displayedRequests, currentPage]);

    // --- VISUAL HELPERS ---
    const getStatusBadge = (status) => {
        if (status === 'Approved') return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs font-bold border border-green-200">Fully Approved</span>;
        if (status === 'Rejected') return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-md text-xs font-bold border border-red-200">Rejected</span>;
        return <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-md text-xs font-bold border border-amber-200">In Progress</span>;
    };

    return (
        <SidebarLayout user={auth.user} activeModule="HR MENU" sidebarLinks={hrLinks}>
            <Head title={isRequesterOnly && !isAdmin ? "My Requests" : "Approval Board"} />

            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 relative">

                {/* HEADER */}
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{isRequesterOnly && !isAdmin ? "My Manpower Requests" : "Manpower Approval Board"}</h2>
                        <p className="mt-1 text-sm text-gray-500">Track and manage clinic hiring workflow.</p>
                    </div>
                    <Link href={route('hr.manpower-requests.create')} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-indigo-500">
                        + New Request
                    </Link>
                </div>

                {/* TABS & SEARCH */}
                <div className="border-b border-gray-200 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="flex gap-6 overflow-x-auto">
                        {(!isRequesterOnly || isAdmin) && (
                            <button onClick={() => setActiveTab('action-required')} className={`pb-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'action-required' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                Action Required
                            </button>
                        )}
                        <button onClick={() => setActiveTab('in-progress')} className={`pb-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'in-progress' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            In Progress
                        </button>
                        <button onClick={() => setActiveTab('completed')} className={`pb-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'completed' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            Completed / History
                        </button>
                    </div>
                    
                    {/* 🟢 NEW: Search Bar aligned to the right of the tabs */}
                    <div className="relative w-full sm:w-64 mb-3 sm:mb-2">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search by requester or position..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                        />
                    </div>
                </div>

                {/* DATA TABLE */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">
                                        <div className="flex items-center">
                                            <span>Requester</span>
                                            {renderHeaderSortButton('requester')}
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">
                                        <div className="flex items-center">
                                            <span>Position Needed</span>
                                            {renderHeaderSortButton('position')}
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">
                                        <div className="flex items-center">
                                            <span>Master Status</span>
                                            {renderHeaderSortButton('status')}
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase">Workflow Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {paginatedRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-gray-500 font-medium">
                                            {searchQuery ? 'No requests match your search.' : 'No requests found in this category.'}
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedRequests.map((req) => (
                                        <tr key={req.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-gray-900">{req.requester?.name || 'Unknown'}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-indigo-700">{req.position?.name || 'N/A'}</div>
                                                <div className="text-xs text-gray-600 mt-1">{req.department?.name}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {getStatusBadge(req.status)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap flex justify-end gap-2">
                                                <button onClick={() => openModal(req)} className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md font-bold transition">
                                                    View Details
                                                </button>

                                                {activeTab === 'action-required' && req.status !== 'Rejected' && (
                                                    <>
                                                        <button onClick={() => openRejectModal(req.id)} className="text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md font-bold transition">
                                                            {isExecutive && selectedRequest?.workflow_path && selectedRequest.workflow_path[selectedRequest.current_step] !== exactUserRole ? 'Override & Reject' : 'Reject Request'}
                                                        </button>
                                                        <button onClick={() => confirmAction(req.id, 'Approved')} className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md font-bold transition">
                                                            {isExecutive && selectedRequest?.workflow_path && selectedRequest.workflow_path[selectedRequest.current_step] !== exactUserRole 
                                                                ? 'Executive Override (Approve)' 
                                                                : 'Endorse Request'
                                                            }
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {displayedRequests.length > ITEMS_PER_PAGE && (
                        <div className="px-6 py-4 border-t border-gray-100 bg-white flex items-center justify-between">
                            <p className="text-sm text-gray-500">
                                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, displayedRequests.length)} of {displayedRequests.length} requests
                            </p>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Previous</button>
                                <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                                <button type="button" onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Next</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* DETAILS MODAL */}
                {isModalOpen && selectedRequest && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-gray-900/60 backdrop-blur-sm p-4 sm:p-0">
                        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">

                            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Request Details: {selectedRequest.position?.name}</h3>
                                    <p className="text-xs text-gray-500 mt-1">Submitted by {selectedRequest.requester?.name} on {new Date(selectedRequest.created_at).toLocaleDateString()}</p>
                                </div>
                                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-2">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-6 flex-grow">
                                <div className="flex flex-col gap-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                    <div className="flex flex-wrap gap-4">
                                        <div><span className="text-xs text-indigo-400 uppercase font-bold block">Status</span> {getStatusBadge(selectedRequest.status)}</div>
                                        <div><span className="text-xs text-indigo-400 uppercase font-bold block">Headcount</span> <span className="font-bold text-indigo-900">{selectedRequest.headcount}</span></div>
                                        <div><span className="text-xs text-indigo-400 uppercase font-bold block">Target Date</span> <span className="font-bold text-indigo-900">{new Date(selectedRequest.date_needed).toLocaleDateString()}</span></div>
                                        <div><span className="text-xs text-indigo-400 uppercase font-bold block">Budgeted?</span>
                                            {selectedRequest.is_budgeted ? <span className="text-green-700 font-bold text-sm">Yes (Plantilla)</span> : <span className="text-red-600 font-bold text-sm">No (Unbudgeted)</span>}
                                        </div>
                                    </div>
                                    
                                    {/* 🟢 DISPLAY REJECTION REASON IF EXISTS */}
                                    {selectedRequest.status === 'Rejected' && selectedRequest.rejection_reason && (
                                        <div className="w-full pt-3 border-t border-indigo-200">
                                            <span className="text-xs text-red-500 uppercase font-bold block mb-1">Reason for Rejection:</span>
                                            <p className="text-sm font-semibold text-red-800 bg-red-100/50 p-3 rounded-md border border-red-200">
                                                {selectedRequest.rejection_reason}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-3">Placement Info</h4>
                                        <p className="text-sm mb-2"><span className="font-semibold text-gray-700">Branch:</span> {selectedRequest.branch?.name || branches.map(b => b.name).join(', ')}</p>
                                        <p className="text-sm mb-2"><span className="font-semibold text-gray-700">Department:</span> {selectedRequest.department?.name}</p>
                                        <p className="text-sm mb-2"><span className="font-semibold text-gray-700">Type:</span> {selectedRequest.employment_status}</p>
                                        {selectedRequest.employment_status === 'Reliever' && <p className="text-sm mb-2 text-amber-600"><span className="font-semibold">Reliever Info:</span> {selectedRequest.reliever_info}</p>}
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-3">Position Context</h4>
                                        <p className="text-sm mb-2"><span className="font-semibold text-gray-700">New Position?</span> {selectedRequest.is_new_position ? 'Yes' : 'No'}</p>
                                        <p className="text-sm mb-2"><span className="font-semibold text-gray-700">Replacement?</span> {selectedRequest.is_replacement ? `Yes (${selectedRequest.replaced_employee_name})` : 'No'}</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-3">Justification & Requirements</h4>
                                    {!selectedRequest.is_budgeted && (
                                        <div className="mb-4 bg-red-50 p-3 rounded-lg border border-red-100">
                                            <span className="font-bold text-red-800 text-sm block mb-1">Unbudgeted Justification:</span>
                                            <p className="text-sm text-red-700">{selectedRequest.unbudgeted_purpose}</p>
                                        </div>
                                    )}
                                    <div className="mb-4">
                                        <span className="font-semibold text-gray-700 text-sm block">General Purpose:</span>
                                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded mt-1">{selectedRequest.purpose}</p>
                                    </div>
                                    {selectedRequest.is_new_position === 1 && (
                                        <div className="mb-4">
                                            <span className="font-semibold text-gray-700 text-sm block">Job Description:</span>
                                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded mt-1 whitespace-pre-wrap">{selectedRequest.job_description}</p>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                        <p className="text-sm"><span className="font-semibold text-gray-700 block">Education:</span> {selectedRequest.educational_background}</p>
                                        <p className="text-sm"><span className="font-semibold text-gray-700 block">Experience:</span> {selectedRequest.years_experience}</p>
                                    </div>
                                    <div className="mt-4">
                                        <span className="font-semibold text-gray-700 text-sm block">Required Skills:</span>
                                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded mt-1 whitespace-pre-wrap">{selectedRequest.skills_required}</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-3">Approval Workflow</h4>
                                    <div className="flex flex-wrap gap-2 text-sm font-bold text-gray-500">
                                        {selectedRequest.workflow_path && selectedRequest.workflow_path.map((roleName, index) => {
                                            let dotColor = 'bg-gray-300';
                                            if (selectedRequest.status === 'Rejected' && index === selectedRequest.current_step) dotColor = 'bg-red-500';
                                            else if (index < selectedRequest.current_step || selectedRequest.status === 'Approved') dotColor = 'bg-green-500';
                                            else if (index === selectedRequest.current_step && selectedRequest.status === 'Pending') dotColor = 'bg-amber-400 animate-pulse';

                                            return (
                                                <span key={index} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                                                    <span className={`h-3 w-3 rounded-full ${dotColor}`}></span>
                                                    {roleName}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
                                <button onClick={closeModal} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition">Close</button>
                                {activeTab === 'action-required' && selectedRequest.status === 'Pending' && (
                                    <>
                                        <button onClick={() => openRejectModal(selectedRequest.id)} className="px-4 py-2 text-sm font-bold text-red-600 bg-red-100 hover:bg-red-200 rounded-md transition">Reject Request</button>
                                        <button onClick={() => confirmAction(selectedRequest.id, 'Approved')} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm transition">Endorse Request</button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 🟢 REJECT REASON MODAL */}
            {rejectModal.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
                            <h3 className="text-lg font-bold text-red-900">Reject Manpower Request</h3>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Please provide a reason for rejection:</label>
                            <textarea
                                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                                rows="4"
                                value={rejectModal.reason}
                                onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                                placeholder="State the reason here. This will be sent to the requester..."
                                autoFocus
                            ></textarea>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                            <button onClick={closeRejectModal} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100">Cancel</button>
                            <button 
                                onClick={submitRejection} 
                                className="px-6 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" 
                                disabled={!rejectModal.reason.trim()}
                            >
                                Submit Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                show={confirmDialog.isOpen}
                onClose={closeConfirmModal}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText={confirmDialog.confirmText}
                confirmColor={confirmDialog.confirmColor}
                onConfirm={confirmDialog.onConfirm}
            />
        </SidebarLayout>
    );
}