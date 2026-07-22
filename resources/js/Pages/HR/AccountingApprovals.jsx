import Modal from '@/Components/Modal';
import { getHRLinks, canViewModule, canApproveModule } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head, router } from '@inertiajs/react';
import { useMemo, useState } from 'react'; // 🟢 ADDED useMemo

export default function AccountingApprovals({ auth, requests }) {
    const currentRole = auth.user?.role?.name || 'Guest';
    const HRLinks = getHRLinks(currentRole, auth);
    if (!canViewModule(auth, 'form_2316_approvals')) {
        return (
            <SidebarLayout activeModule="HR" sidebarLinks={HRLinks}>
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
    
    const requestList = requests || [];

    // --- FILTER STATES ---
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // --- LIVE FILTER LOGIC ---
    const filteredRequests = useMemo(() => {
        return requestList.filter(req => {
            // 1. Search Filter (by Employee Name)
            const employeeName = (req.user?.name || req.name || '').toLowerCase();
            const matchesSearch = !searchQuery || employeeName.includes(searchQuery.toLowerCase().trim());

            // 2. Date Range Filter (by Date Requested)
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

            return matchesSearch && matchesDate;
        });
    }, [requestList, searchQuery, startDate, endDate]);

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

    // --- RELEASE MODAL STATE ---
    const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
    const [releasingId, setReleasingId] = useState(null);
    const canApprove = canApproveModule(auth, 'form_2316_approvals');

    // --- ACTION HANDLER ---
    const handleAction = (id, actionStatus) => {
        if (actionStatus === 'Released' && canApprove) {
            setReleasingId(id);
            setIsReleaseModalOpen(true);
            return;
        }
    };

    const submitRelease = () => {
        if (!canApprove || releasingId === null) {
            setIsReleaseModalOpen(false);
            setReleasingId(null);
            return;
        }

        router.patch(route('hr.accounting.update', releasingId), {
            status: 'Released'
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setIsReleaseModalOpen(false);
                setReleasingId(null);
            }
        });
    };

    return (
        <SidebarLayout activeModule="HR" sidebarLinks={HRLinks}>
            <Head title="Accounting Approvals" />

            <div className="py-8">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    
                    <div className="mb-6 flex justify-between items-end">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">General Accounting Approvals</h3>
                            <p className="text-gray-600 text-sm">Review and process Form 2316 requests forwarded by HR.</p>
                        </div>
                    </div>

                    {/* 🟢 FILTER WIDGET */}
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

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                        {/* 🟢 USE filteredRequests.length HERE */}
                        {filteredRequests.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                {searchQuery || startDate || endDate ? 'No requests match your current filters.' : 'No requests found.'}
                            </div>
                        ) : (
                            <div className="overflow-x-auto overflow-y-auto max-h-[400px] relative w-full custom-scrollbar">
                                <table className="min-w-full divide-y divide-gray-200 text-left text-sm text-gray-600">
                                    <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[11px] font-bold shadow-sm">
                                        <tr>
                                            <th className="px-6 py-4">Date Requested</th>
                                            <th className="px-6 py-4">Employee Name</th>
                                            <th className="px-6 py-4">Document Type</th>
                                            <th className="px-6 py-4 text-center">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {/* 🟢 MAP filteredRequests HERE */}
                                        {filteredRequests.map((req) => (
                                            <tr 
                                                key={req.id} 
                                                onClick={() => openViewModal(req)}
                                                className="hover:bg-gray-50 cursor-pointer transition-colors group"
                                            >
                                                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                                    {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </td>
                                                <td className="px-6 py-4 font-semibold text-gray-900">
                                                    {req.user?.name || req.name || 'Unknown Employee'}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-indigo-900">
                                                    Form 2316
                                                </td>
                                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide
                                                        ${req.status === 'General Accounting' ? 'bg-amber-100 text-amber-800 border-amber-200' : ''}
                                                        ${req.status === 'Released' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : ''}
                                                    `}>
                                                        {req.status === 'General Accounting' ? 'Pending' : req.status}
                                                    </span>
                                                </td>
                                                
                                                <td 
                                                    className="px-6 py-4 text-right whitespace-nowrap"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {req.status === 'General Accounting' ? (
                                                        canApprove ? (
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleAction(req.id, 'Released')}
                                                                    className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-sm"
                                                                >
                                                                    Release
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs italic font-medium">View Only</span>
                                                        )
                                                    ) : (
                                                        <span className="text-gray-400 text-xs italic font-medium">Processed</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
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
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Employee Name</label>
                                <p className="mt-1 text-sm font-semibold text-gray-900">
                                    {selectedRequest.user?.name || selectedRequest.name || 'Unknown Employee'}
                                </p>
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
                                    {new Date(selectedRequest.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Current Status</label>
                                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold uppercase tracking-wide
                                    ${selectedRequest.status === 'General Accounting' ? 'bg-amber-100 text-amber-800 border-amber-200' : ''}
                                    ${selectedRequest.status === 'Released' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : ''}
                                `}>
                                    {selectedRequest.status === 'General Accounting' ? 'Pending' : selectedRequest.status}
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

            {/* --- RELEASE CONFIRMATION MODAL --- */}
            <Modal show={isReleaseModalOpen} onClose={() => setIsReleaseModalOpen(false)} maxWidth="sm">
                <div className="p-6">
                    <div className="flex items-center justify-between border-b pb-4 mb-5">
                        <h2 className="text-xl font-bold text-gray-900">Confirm Release</h2>
                        <button onClick={() => setIsReleaseModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <p className="text-sm text-gray-700 mb-6 mt-2">
                        Are you sure you want to mark this Form 2316 as Released? The employee will be notified immediately that their document is ready.
                    </p>

                    <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={() => setIsReleaseModalOpen(false)}
                            className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={submitRelease}
                            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-500 transition-colors"
                        >
                            Confirm Release
                        </button>
                    </div>
                </div>
            </Modal>
        </SidebarLayout>
    );
}