import TrackingStepper from '@/Components/TrackingStepper';
import { getPRPOLinks } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';

// =====================================================================
// MINI TRACKING STEPPER (Delivery Style)
// =====================================================================
const TrackerLine = ({ pr }) => {
    const isPRRejected = pr.status === 'rejected';
    const isPRCancelled = pr.status === 'cancelled';
    const hasPOs = pr.purchase_orders && pr.purchase_orders.length > 0;

    let isFullyOrdered = false;
    let isPoProcessing = false;
    let hasPoCancelled = false;
    let poStatusMsg = "";

    if (hasPOs) {
        const statuses = pr.purchase_orders.map(po => po.status);

        if (statuses.includes('cancelled')) {
            hasPoCancelled = true;
            poStatusMsg = "Notice: A Purchase Order for this request was cancelled.";
        } else if (statuses.includes('po_generated')) {
            isPoProcessing = true;
            poStatusMsg = "Purchase Order generated. Procurement is finalizing the details.";
        } else if (statuses.includes('pending_evp_final')) {
            isPoProcessing = true;
            poStatusMsg = "Purchase Order submitted. Pending final approval from Executive Vice President.";
        } else if (statuses.every(s => s === 'approved')) {
            isFullyOrdered = true;
            poStatusMsg = `Purchase Order approved! Items have been officially ordered. Estimated delivery: ${pr.date_needed || 'TBD'}`;
        } else {
            isPoProcessing = true;
            poStatusMsg = "Purchase Order is currently being processed.";
        }
    }

    const isHalted = isPRRejected || isPRCancelled || hasPoCancelled;
    const step1 = true;
    const step2 = ['pr_generated', 'pending_procurement', 'pending_procurement_tl', 'po_generated', 'pending_evp_final', 'approved'].includes(pr.status);
    const step3 = ['po_generated', 'pending_evp_final', 'approved'].includes(pr.status);
    const step4 = pr.status === 'approved' || isFullyOrdered;

    const getStepClass = (isComplete, isCurrent) => {
        if (isHalted) return 'bg-red-500 ring-red-100';
        if (isComplete) return 'bg-indigo-600 ring-indigo-100';
        if (isCurrent) return 'bg-white border-2 border-indigo-600 ring-indigo-50';
        return 'bg-gray-200';
    };

    const getLineClass = (isActive) => {
        if (isHalted) return 'border-red-500';
        return isActive ? 'border-indigo-600' : 'border-gray-200';
    };

    return (
        <div className="mt-6 mb-2 px-4 sm:px-8">
            <div className="relative flex items-center justify-between w-full">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 flex">
                    <div className={`h-full w-1/3 border-t-2 ${getLineClass(step2)} transition-colors duration-500`}></div>
                    <div className={`h-full w-1/3 border-t-2 ${getLineClass(step3)} transition-colors duration-500`}></div>
                    <div className={`h-full w-1/3 border-t-2 ${getLineClass(step4)} transition-colors duration-500`}></div>
                </div>

                <div className="relative flex flex-col items-center group">
                    <div className={`w-4 h-4 rounded-full ring-4 z-10 ${getStepClass(step1, !step2)}`}></div>
                    <span className="absolute top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-700 uppercase whitespace-nowrap">Submitted</span>
                </div>
                <div className="relative flex flex-col items-center group">
                    <div className={`w-4 h-4 rounded-full ring-4 z-10 ${getStepClass(step2, step2 && !step3)}`}></div>
                    <span className="absolute top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-700 uppercase whitespace-nowrap">PR Generated</span>
                </div>
                <div className="relative flex flex-col items-center group">
                    <div className={`w-4 h-4 rounded-full ring-4 z-10 ${getStepClass(step3, step3 && !step4)}`}></div>
                    <span className="absolute top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-700 uppercase whitespace-nowrap">PO Generated</span>
                </div>
                <div className="relative flex flex-col items-center group">
                    <div className={`w-4 h-4 rounded-full ring-4 z-10 ${getStepClass(step4, step4)}`}></div>
                    <span className="absolute top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-700 uppercase whitespace-nowrap">{isFullyOrdered ? "Finalized" : "EVP Approval"}</span>
                </div>
            </div>

            <div className="mt-8 text-center text-xs font-medium">
                {isHalted ? (
                    <span className="text-red-600">
                        {hasPoCancelled ? poStatusMsg : `This request was ${pr.status}. Please check with your manager.`}
                    </span>
                ) : hasPOs ? (
                    <span className={isFullyOrdered ? "text-green-600" : "text-amber-600"}>{poStatusMsg}</span>
                ) : step3 ? (
                    <span className="text-amber-600">Purchase Order Generated. Pending Executive Vice President Final Approval.</span>
                ) : step2 ? (
                    <span className="text-indigo-600">Purchase Request Generated. Procurement is reviewing the document.</span>
                ) : (
                    <span className="text-gray-500">Submitted and pending manager approvals.</span>
                )}
            </div>
        </div>
    );
};

export default function StatusIndex({ auth, requests }) {
    const sidebarLinks = getPRPOLinks(auth);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterBranch, setFilterBranch] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterDate, setFilterDate] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalView, setModalView] = useState('PR');
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [showRejection, setShowRejection] = useState(false);

    const formatCurrency = (amount) => `₱${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const formatStatus = (rawStatus) => {

        let status = rawStatus;
        if (status === 'pending_approval') status = 'pending_evp_final';
        if (status === 'drafted') status = 'po_generated';


        const statusMap = {
            'pending_inv_tl': { label: 'Pending Inventory Team Leader', color: 'bg-yellow-100 text-yellow-800' },
            'pending_ops_manager': { label: 'Pending Operations Manager', color: 'bg-orange-100 text-orange-800' },
            'pr_generated': { label: 'Purchase Request Generated', color: 'bg-blue-100 text-blue-800' },
            'pending_procurement': { label: 'Pending Procurement Assistant Review', color: 'bg-purple-100 text-purple-800' },
            'pending_procurement_tl': { label: 'Purchase Order Generation: Procurement TL', color: 'bg-purple-100 text-purple-800' },
            'po_generated': { label: 'Purchase Order Generated', color: 'bg-green-100 text-green-800' },
            'pending_evp_final': { label: 'Pending EVP Final Approval', color: 'bg-yellow-100 text-yellow-800' },
            'approved': { label: 'Purchase Order Approved', color: 'bg-green-100 text-green-800' },
            'rejected': { label: 'Rejected', color: 'bg-red-100 text-red-800' },
            'cancelled': { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
        };

        const mapped = statusMap[status] || { label: status, color: 'bg-gray-100 font-bold text-gray-800' };

        return (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${mapped.color}`}>
                {mapped.label}
            </span>
        );
    };

    const openModal = (doc, type) => {
        setSelectedDoc(doc);
        setModalView(type);
        setShowRejection(false);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setTimeout(() => { setSelectedDoc(null); setShowRejection(false); }, 200);
    };

    const uniqueBranches = useMemo(() => [...new Set(requests.data.map(pr => pr.branch).filter(Boolean))].sort(), [requests.data]);
    const uniquePriorities = useMemo(() => [...new Set(requests.data.map(pr => pr.priority).filter(Boolean))].sort(), [requests.data]);

    const filteredRequests = useMemo(() => {
        return requests.data.filter(pr => {
            const searchLower = searchQuery.toLowerCase().trim();
            const prId = (pr.pr_number || '').toLowerCase();
            const preparedBy = (pr.user?.name || '').toLowerCase();
            const matchesPOs = pr.purchase_orders?.some(po => (po.po_number || '').toLowerCase().includes(searchLower) || (po.supplier?.name || '').toLowerCase().includes(searchLower));
            const matchesSearch = !searchLower || prId.includes(searchLower) || preparedBy.includes(searchLower) || matchesPOs;
            const matchesBranch = !filterBranch || pr.branch === filterBranch;
            const matchesPriority = !filterPriority || pr.priority === filterPriority;

            let matchesType = true;
            const hasPOs = pr.purchase_orders && pr.purchase_orders.length > 0;
            if (filterType === 'pr_processing') {
                matchesType = !hasPOs && !['rejected', 'cancelled'].includes(pr.status);
            } else if (filterType === 'po_generated') {
                matchesType = hasPOs || pr.status === 'po_generated';
            } else if (filterType === 'halted') {
                matchesType = ['rejected', 'cancelled'].includes(pr.status);
            }

            let matchesDate = true;
            if (filterDate) matchesDate = pr.date_prepared.startsWith(filterDate);

            return matchesSearch && matchesBranch && matchesPriority && matchesType && matchesDate;
        });
    }, [requests.data, searchQuery, filterBranch, filterPriority, filterType, filterDate]);

    // 🟢 Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterBranch, filterPriority, filterType, filterDate]);

    const paginatedRequests = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredRequests.slice(start, start + itemsPerPage);
    }, [filteredRequests, currentPage]);

    const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

    return (
        <SidebarLayout activeModule="PR/PO Module" sidebarLinks={sidebarLinks}>
            <Head title="My Delivery Tracker" />
            <div className="mx-auto max-w-5xl py-6 px-4 sm:px-0">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Delivery Tracker</h2>
                        <p className="mt-1 text-sm text-gray-500">Track the progress of requests you have submitted or are copied on.</p>
                    </div>
                </div>
                <div className="mb-6 bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="relative lg:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Search</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
                                <input type="text" placeholder="PR/PO ID, User, or Supplier..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="block w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Branch</label>
                            <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className="block w-full px-3 py-1.5 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors">
                                <option value="">All Branches</option>
                                {uniqueBranches.map((branch, idx) => (<option key={idx} value={branch}>{branch}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Priority</label>
                            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="block w-full px-3 py-1.5 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors">
                                <option value="">All Priorities</option>
                                {uniquePriorities.map((priority, idx) => (<option key={idx} value={priority}>{priority}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Category</label>
                            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="block w-full px-3 py-1.5 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors">
                                <option value="all">All Requests</option>
                                <option value="pr_processing">Processing (PR)</option>
                                <option value="po_generated">Ordered (PO)</option>
                                <option value="halted">Rejected / Cancelled</option>
                            </select>
                        </div>
                        <div className="lg:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Month Requested</label>
                            <input type="month" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="block w-full px-3 py-1.5 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                        </div>
                    </div>
                    {(searchQuery || filterBranch || filterPriority || filterType !== 'all' || filterDate) && (
                        <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
                            <button onClick={() => { setSearchQuery(''); setFilterBranch(''); setFilterPriority(''); setFilterType('all'); setFilterDate(''); }} className="text-sm text-gray-500 hover:text-gray-800 font-semibold bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-md transition-colors">Clear Filters</button>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    {paginatedRequests.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300"><p className="text-gray-500">No requests found matching your filters.</p></div>
                    ) : (
                        paginatedRequests.map(pr => (
                            <div key={pr.id} className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-xl p-6 transition-all hover:shadow-md">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-4 mb-4 gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-bold text-gray-900">{pr.pr_number}</h3>
                                            {pr.purchase_orders && pr.purchase_orders.length > 0 && (
                                                <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20">{pr.purchase_orders.length} PO(s) Linked</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500">Target Delivery</p>
                                            <p className="text-sm font-bold text-gray-900">{pr.date_needed || 'TBD'}</p>
                                        </div>
                                        <div className="flex gap-2 mt-1">
                                            <button onClick={() => openModal(pr, 'PR')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md border border-indigo-200 transition">View Original PR</button>
                                            {pr.purchase_orders && pr.purchase_orders.length > 0 && (
                                                <button onClick={() => openModal(pr.purchase_orders[0], 'PO')} className="text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-md border border-teal-200 transition">View PO Details</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <p className="text-sm text-gray-600 font-medium">Contains {pr.items ? pr.items.length : 0} item(s):</p>
                                    <p className="text-xs text-gray-500 truncate mt-0.5">{pr.items && pr.items.map(item => item.specifications || 'Item').join(', ')}</p>
                                </div>
                                <TrackerLine pr={pr} />
                            </div>
                        ))
                    )}

                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200 mt-4">
                            <span className="text-sm text-gray-600">Showing <span className="font-bold text-gray-900">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-bold text-gray-900">{Math.min(currentPage * itemsPerPage, filteredRequests.length)}</span> of <span className="font-bold text-gray-900">{filteredRequests.length}</span> tracking records</span>
                            <div className="flex items-center gap-2 mt-3 sm:mt-0">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 text-sm font-semibold rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">Previous</button>
                                <span className="text-sm font-medium text-gray-700 px-2">Page {currentPage} of {totalPages}</span>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 text-sm font-semibold rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">Next</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && selectedDoc && (
                <div onClick={closeModal} className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-gray-900 bg-opacity-60 backdrop-blur-sm p-4 sm:p-0">
                    <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl transition-all flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between border-b px-6 py-2 shrink-0 bg-gray-50 rounded-t-2xl">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">{modalView === 'PR' ? selectedDoc.pr_number : selectedDoc.po_number}</h3>
                                <p className="text-sm text-gray-500 mt-1">{modalView === 'PR' ? `Prepared by ${selectedDoc.user?.name} on ${selectedDoc.date_prepared}` : `Purchase Order dated ${selectedDoc.po_date}`}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {modalView === 'PR' && ['pr_generated', 'pending_procurement', 'pending_procurement_tl', 'po_generated', 'pending_evp_final', 'approved'].includes(selectedDoc.status) && (
                                    <a href={route('prpo.purchase-requests.print', selectedDoc.id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-800 border border-blue-200">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> View PR PDF
                                    </a>
                                )}
                                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                        </div>
                        <div className="overflow-y-auto px-6 py-6 flex-grow">
                            <div className="mb-8 px-4 sm:px-16">
                                <TrackingStepper currentStatus={selectedDoc.status} type={modalView} branch={selectedDoc.branch} pr={modalView === 'PR' ? selectedDoc : null} />
                            </div>
                            {(() => {
                                const isDocRejected = (modalView === 'PR' && selectedDoc.status === 'rejected') || (modalView === 'PO' && selectedDoc.status === 'cancelled');
                                const docRejectionReason = modalView === 'PR' ? selectedDoc.rejection_reason : selectedDoc.remarks;
                                if (!isDocRejected || !docRejectionReason) return null;
                                return (
                                    <div className="mb-8 px-4 sm:px-16">
                                        {!showRejection ? (
                                            <button onClick={() => setShowRejection(true)} className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 py-3 rounded-xl text-sm font-bold transition-colors shadow-sm">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> View Reason for Rejection
                                            </button>
                                        ) : (
                                            <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-inner animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="flex justify-between items-start mb-3">
                                                    <label className="text-xs font-bold text-red-800 uppercase tracking-wider flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> Reason for Cancellation / Rejection</label>
                                                    <button onClick={() => setShowRejection(false)} className="text-red-500 hover:text-red-700 bg-red-100 hover:bg-red-200 rounded-md p-1 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                                                </div>
                                                <p className="text-sm text-red-900 whitespace-pre-wrap leading-relaxed break-all font-medium">{docRejectionReason}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {modalView === 'PR' && (
                                <>
                                    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm">
                                        <div><span className="block font-semibold text-gray-900">Carbon Copy (CC)</span> {selectedDoc.cc_user?.name || 'N/A'}</div>
                                        <div><span className="block font-semibold text-gray-900">Branch</span> {selectedDoc.branch}</div>
                                        <div><span className="block font-semibold text-gray-900">Department</span> {selectedDoc.department}</div>
                                        <div><span className="block font-semibold text-gray-900">Request Type</span> {selectedDoc.request_type || 'N/A'}</div>
                                        <div><span className="block font-semibold text-gray-900">Priority</span> {selectedDoc.priority || 'N/A'}</div>
                                        <div><span className="block font-semibold text-gray-900">Date Needed</span> <span className="text-red-600 font-bold">{selectedDoc.date_needed}</span></div>
                                        <div><span className="block font-semibold text-gray-900">Budget Alignment</span> {selectedDoc.budget_status || 'N/A'}</div>
                                        <div><span className="block font-semibold text-gray-900">Status</span> {formatStatus(selectedDoc.status)}</div>
                                        {selectedDoc.purpose_of_request && (
                                            <div className="col-span-2 sm:col-span-4 mt-2 border-t pt-2 border-gray-200">
                                                <span className="block font-semibold text-gray-900">Purpose of Request</span>
                                                <p className="text-gray-600 whitespace-pre-wrap">{selectedDoc.purpose_of_request}</p>
                                            </div>
                                        )}
                                    </div>
                                    <h4 className="mb-2 font-bold text-gray-900 border-b pb-1">Requested Items</h4>
                                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                                        <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="px-4 py-2 font-semibold">Product Name</th>
                                                    <th className="px-4 py-2 font-semibold">Descriptions</th>
                                                    <th className="px-4 py-2 font-semibold text-center">Requested Quantity</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 bg-white">
                                                {selectedDoc.items?.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td className="px-4 py-3 font-medium text-gray-900">{item.product?.name || `ID: ${item.product_id}`}</td>
                                                        <td className="px-4 py-3 text-gray-500">{item.specifications || '-'}</td>
                                                        <td className="px-4 py-3 text-center font-bold">{item.qty_requested} {item.unit}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                            {modalView === 'PO' && (
                                <>
                                    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm">
                                        <div><span className="block font-semibold text-gray-900">Supplier</span> {selectedDoc.supplier?.name || 'Unknown'}</div>
                                        <div><span className="block font-semibold text-gray-900">Delivery Date</span> {selectedDoc.delivery_date || 'TBD'}</div>
                                        <div><span className="block font-semibold text-gray-900">Payment Terms</span> {selectedDoc.payment_terms || '-'}</div>
                                        <div><span className="block font-semibold text-gray-900">Status</span> {formatStatus(selectedDoc.status)}</div>
                                        <div className="col-span-2 sm:col-span-4"><span className="block font-semibold text-gray-900">Ship To</span> {selectedDoc.ship_to || '-'}</div>
                                    </div>
                                    <div className="flex flex-col lg:flex-row gap-8 mb-4">
                                        <div className="flex-1">
                                            {selectedDoc.attachments && selectedDoc.attachments.length > 0 && (
                                                <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                                    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                                                        Supplier Quotations & Attachments
                                                    </h4>
                                                    <ul className="space-y-2">
                                                        {selectedDoc.attachments.map((file, idx) => (
                                                            <li key={idx} className="flex items-center text-sm text-indigo-600 hover:text-indigo-800">
                                                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                                                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"></path></svg>
                                                                    {file.original_name}
                                                                </a>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            <h4 className="mb-2 font-bold text-gray-900 border-b pb-1">Ordered Items</h4>
                                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                                                <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
                                                    <thead className="bg-gray-100">
                                                        <tr>
                                                            <th className="px-4 py-2 font-semibold">Product Name</th>
                                                            <th className="px-4 py-2 font-semibold">Description</th>
                                                            <th className="px-4 py-2 font-semibold text-center">Requested Quantity</th>
                                                            <th className="px-4 py-2 font-semibold text-right">Unit Price</th>
                                                            <th className="px-4 py-2 font-semibold text-right">Total Price</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200 bg-white">
                                                        {selectedDoc.items?.filter(i => i.status !== 'removed').map((item, idx) => (
                                                            <tr key={idx}>
                                                                <td className="px-4 py-3 font-medium text-gray-900">{item.description}</td>
                                                                <td className="px-4 py-3 text-gray-500">{item.notes || '-'}</td>
                                                                <td className="px-4 py-3 text-center font-bold">{item.qty} {item.unit}</td>
                                                                <td className="px-4 py-3 text-right">₱{item.unit_price}</td>
                                                                <td className="px-4 py-3 text-right font-medium">₱{item.net_payable}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        <div className="w-full lg:w-80 shrink-0 bg-gray-50 rounded-lg p-5 border border-gray-200 h-fit mt-6 lg:mt-0">
                                            <h4 className="font-bold text-gray-900 mb-4 border-b pb-2">Amount Summary</h4>
                                            <div className="space-y-3 text-sm">
                                                <div className="flex justify-between text-gray-600"><span>Gross Amount:</span><span className="font-medium text-gray-900">{formatCurrency(selectedDoc.gross_amount || 0)}</span></div>
                                                {selectedDoc.discount_total > 0 && (<div className="flex justify-between text-gray-600"><span>Less: Discount</span><span className="font-medium text-indigo-500">-{formatCurrency(selectedDoc.discount_total)}</span></div>)}
                                                <div className="flex justify-between text-gray-600 font-medium pt-2 border-t border-gray-200"><span>Net of Discount:</span><span>{formatCurrency(selectedDoc.net_of_discount || selectedDoc.gross_amount || 0)}</span></div>
                                                <div className="flex justify-between items-center text-gray-600"><span>VAT Total:</span><span>{formatCurrency(selectedDoc.vat_total || 0)}</span></div>
                                                <div className="flex justify-between items-center text-indigo-900 font-black text-lg pt-4 border-t border-gray-300"><span>GRAND TOTAL</span><span>{formatCurrency(selectedDoc.grand_total || 0)}</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </SidebarLayout>
    );
}
