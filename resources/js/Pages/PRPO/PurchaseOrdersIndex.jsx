import ConfirmModal from '@/Components/ConfirmModal';
import Modal from '@/Components/Modal';
import TrackingStepper from '@/Components/TrackingStepper';
import { getPRPOLinks } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

export default function PurchaseOrdersIndex({ auth, purchaseOrders, currentView, isRestrictedRole, pendingPRs = [] }) {
    const sidebarLinks = getPRPOLinks(auth);
    const pos = purchaseOrders?.data || [];

    const userrole = auth.user.role?.name?.toLowerCase().trim() || '';
    const canManagePO = userrole.includes('procurement') ||
                    userrole.includes('director') ||
                    userrole.includes('executive vice president') ||
                    userrole.includes('evp') ||
                    userrole === 'admin';

    const [searchQuery, setSearchQuery] = useState('');
    const [filterBranch, setFilterBranch] = useState('');
    const [filterPriority, setFilterPriority] = useState('');

    const uniqueBranches = useMemo(() => {
        return [...new Set(pos.map(po => po.purchase_request?.branch).filter(Boolean))].sort();
    }, [pos]);

    const uniquePriorities = useMemo(() => {
        return [...new Set(pos.map(po => po.purchase_request?.priority).filter(Boolean))].sort();
    }, [pos]);

    const filteredPOs = useMemo(() => {
        const filtered = pos.filter(po => {
            const searchLower = searchQuery.toLowerCase().trim();
            const poId = (po.po_number || '').toLowerCase();
            const prId = (po.purchase_request?.pr_number || '').toLowerCase();
            const preparedBy = (po.purchase_request?.user?.name || '').toLowerCase();
            const supplier = (po.supplier?.name || '').toLowerCase();

            const matchesSearch = !searchLower || poId.includes(searchLower) || prId.includes(searchLower) || preparedBy.includes(searchLower) || supplier.includes(searchLower);
            const matchesBranch = !filterBranch || po.purchase_request?.branch === filterBranch;
            const matchesPriority = !filterPriority || po.purchase_request?.priority === filterPriority;

            return matchesSearch && matchesBranch && matchesPriority;
        });

        return filtered.sort((a, b) => {
            const idA = a.po_number || a.purchase_request?.pr_number || '';
            const idB = b.po_number || b.purchase_request?.pr_number || '';
            return idB.localeCompare(idA, undefined, { numeric: true, sensitivity: 'base' });
        });
    }, [pos, searchQuery, filterBranch, filterPriority]);

    const filteredPendingPRs = useMemo(() => {
        if (!pendingPRs) return [];
        const filtered = pendingPRs.filter(pr => {
            const searchLower = searchQuery.toLowerCase().trim();
            const prId = (pr.pr_number || '').toLowerCase();
            const preparedBy = (pr.user?.name || '').toLowerCase();

            const matchesSearch = !searchLower || prId.includes(searchLower) || preparedBy.includes(searchLower);
            const matchesBranch = !filterBranch || pr.branch === filterBranch;
            const matchesPriority = !filterPriority || pr.priority === filterPriority;

            return matchesSearch && matchesBranch && matchesPriority;
        });

        return filtered.sort((a, b) => {
            const idA = a.pr_number || '';
            const idB = b.pr_number || '';
            return idB.localeCompare(idA, undefined, { numeric: true, sensitivity: 'base' });
        });
    }, [pendingPRs, searchQuery, filterBranch, filterPriority]);

    // 🟢 Double Pagination States
    const [prPage, setPrPage] = useState(1);
    const [poPage, setPoPage] = useState(1);
    const itemsPerPage = 10; // Change to your desired page size

    useEffect(() => {
        setPrPage(1);
        setPoPage(1);
    }, [searchQuery, filterBranch, filterPriority, currentView]);

    const paginatedPRs = useMemo(() => {
        const start = (prPage - 1) * itemsPerPage;
        return filteredPendingPRs.slice(start, start + itemsPerPage);
    }, [filteredPendingPRs, prPage]);

    const paginatedPOs = useMemo(() => {
        const start = (poPage - 1) * itemsPerPage;
        return filteredPOs.slice(start, start + itemsPerPage);
    }, [filteredPOs, poPage]);

    const prTotalPages = Math.ceil(filteredPendingPRs.length / itemsPerPage);
    const poTotalPages = Math.ceil(filteredPOs.length / itemsPerPage);

    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', confirmText: '', confirmColor: '', onConfirm: () => {} });
    const closeConfirmModal = () => setConfirmDialog({ ...confirmDialog, isOpen: false });

    const handleGeneratePO = (id, e) => {
        if (e) e.stopPropagation();
        setConfirmDialog({
            isOpen: true,
            title: "Generate Purchase Orders",
            message: "Are you sure you want to generate Purchase Orders for this endorsed request? This action cannot be undone.",
            confirmText: "Generate Purchase Order",
            confirmColor: "bg-teal-600 hover:bg-teal-500",
            onConfirm: () => {
                router.post(route("prpo.purchase-requests.generate-pos", id), {}, {
                    preserveScroll: true,
                    onSuccess: () => { closeConfirmModal(); closeModal(); },
                });
            },
        });
    };

    const userRole = auth.user.role?.name?.toLowerCase() || '';
    const isDCSO = ['director of corporate services and operations', 'admin'].includes(userRole);
    const isEVP = ['executive vice president', 'evp', 'admin'].includes(userRole);
    const isProcurementTL = ['procurement tl', 'procurement team leader', 'admin'].includes(userRole);
    const canEditPO = isProcurementTL || isEVP || userRole === 'admin';

    const [selectedPO, setSelectedPO] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalView, setModalView] = useState('PO');
    const [isEditMode, setIsEditMode] = useState(false);

    const [newFiles, setNewFiles] = useState([]);
    const [removedItemIds, setRemovedItemIds] = useState([]);
    const [isRemovedModalOpen, setIsRemovedModalOpen] = useState(false);

    const [discountType, setDiscountType] = useState('amount');
    const [selectedItemIds, setSelectedItemIds] = useState([]);

    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    const { data, setData, processing, reset, errors, setError, clearErrors } = useForm({
        delivery_date: '', payment_terms: '', ship_to: '', no_of_quotations: '', discount_total: 0, vat_rate: 12, status: 'po_generated', items: [],
    });

    const [liveTotals, setLiveTotals] = useState({ gross: 0, actualDiscount: 0, net: 0, vat: 0, grand: 0 });

    useEffect(() => {
        if (selectedPO && modalView === 'PO') {
            const activeItems = selectedPO.items?.filter(item => !removedItemIds.includes(item.id) && item.status !== 'removed') || [];
            const gross = activeItems.reduce((sum, item) => sum + parseFloat(item.net_payable || 0), 0);

            const rawDiscountInput = parseFloat(data.discount_total) || 0;
            const actualDiscount = discountType === 'percentage' ? gross * (rawDiscountInput / 100) : rawDiscountInput;

            const net = gross - actualDiscount;
            const vatRate = parseFloat(data.vat_rate) || 0;
            const vat = net * (vatRate / 100);

            setLiveTotals({ gross, actualDiscount, net, vat, grand: net + vat });
        }
    }, [data.discount_total, data.vat_rate, selectedPO, removedItemIds, discountType, modalView]);

    const openModal = (doc, viewType = 'PO') => {
        setSelectedPO(doc);
        setModalView(viewType);
        setNewFiles([]);
        setRemovedItemIds([]);
        setSelectedItemIds([]);
        setDiscountType('amount');
        setIsEditMode(false);
        clearErrors();

        if (viewType === 'PO') {
            const formattedDeliveryDate = doc.delivery_date ? doc.delivery_date.split('T')[0] : '';
            setData({
                delivery_date: formattedDeliveryDate, payment_terms: doc.payment_terms || '30 Days', ship_to: doc.ship_to || 'Main Clinic', no_of_quotations: doc.no_of_quotations || '', discount_total: doc.discount_total || 0, vat_rate: 12, status: doc.status, items: doc.items || [],
            });
        } else {
            reset(); // Safely clear the form if we are just viewing a PR
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setTimeout(() => { setSelectedPO(null); reset(); setModalView('PO'); }, 200);
    };

    const handleSave = (newStatus) => {
        router.post(route('prpo.purchase-orders.update', selectedPO.id), {
            ...data, discount_total: liveTotals.actualDiscount, status: newStatus, _method: 'put', new_attachments: newFiles, removed_item_ids: removedItemIds
        }, {
            preserveScroll: true, forceFormData: true, onSuccess: () => closeModal(),
        });
    };

    const submitRejection = (e) => {
        e.preventDefault();
        router.post(route('prpo.purchase-orders.update', selectedPO.id), {
            ...data, discount_total: liveTotals.actualDiscount, status: 'cancelled', remarks: rejectReason, _method: 'put', new_attachments: newFiles, removed_item_ids: removedItemIds
        }, {
            preserveScroll: true, forceFormData: true, onSuccess: () => { setIsRejectModalOpen(false); setRejectReason(''); closeModal(); }
        });
    };

    const confirmSave = (newStatus) => {
        if (newStatus === 'pending_evp_final' && (!data.no_of_quotations || data.no_of_quotations <= 0)) {
            setError('no_of_quotations', 'You must provide the Number of Quotations before submitting for approval.');
            return;
        }

        if (newStatus === 'po_generated' && selectedPO.status === 'po_generated') {
            handleSave(newStatus);
            return;
        }

        if (newStatus === 'cancelled') {
            setRejectReason('');
            setIsRejectModalOpen(true);
            return;
        }

        let title, message, confirmText, confirmColor;

        if (newStatus === 'pending_evp_final') {
            title = 'Submit for EVP Approval'; message = 'Are you ready to submit this PO to the Executive Vice President for final approval?'; confirmText = 'Submit PO'; confirmColor = 'bg-indigo-600 hover:bg-indigo-500';
        } else if (newStatus === 'approved') {
            title = 'Approve Purchase Order'; message = 'Are you sure you want to finalize and approve this PO? This will lock the document.'; confirmText = 'Approve PO'; confirmColor = 'bg-green-600 hover:bg-green-500';
        } else if (newStatus === 'po_generated' && selectedPO.status === 'pending_evp_final') {
            title = 'Return to Draft'; message = 'Are you sure you want to return this PO to Procurement so they can make corrections?'; confirmText = 'Return to Generation Queue'; confirmColor = 'bg-orange-500 hover:bg-orange-600';
        }

        setConfirmDialog({
            isOpen: true, title, message, confirmText, confirmColor,
            onConfirm: () => { handleSave(newStatus); closeConfirmModal(); }
        });
    };

    const handleFileChange = (e) => setNewFiles(Array.from(e.target.files));
    const handleItemNoteChange = (itemId, newNote) => setData('items', data.items.map(item => item.id === itemId ? { ...item, notes: newNote } : item));

    const activeItems = data.items?.filter(item => !removedItemIds.includes(item.id) && item.status !== 'removed') || [];
    const removedItems = selectedPO?.items?.filter(item => removedItemIds.includes(item.id) || item.status === 'removed') || [];

    const handleSelectAll = (e) => e.target.checked ? setSelectedItemIds(activeItems.map(i => i.id)) : setSelectedItemIds([]);
    const handleSelectItem = (id) => setSelectedItemIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

    const handleRemoveItem = (itemId) => {
        if (activeItems.length === 1) {
            setConfirmDialog({ isOpen: true, title: 'Cancel Purchase Order', message: 'Dropping the last remaining item will completely cancel this Purchase Order. Proceed?', confirmText: 'Cancel PO', confirmColor: 'bg-red-600 hover:bg-red-500', onConfirm: () => { handleSave('cancelled'); closeConfirmModal(); } });
        } else {
            setConfirmDialog({ isOpen: true, title: 'Drop Item', message: 'Are you sure you want to drop this item? Its cost will be deducted from the Grand Total.', confirmText: 'Drop Item', confirmColor: 'bg-red-600 hover:bg-red-500', onConfirm: () => { setRemovedItemIds(prev => [...prev, itemId]); setSelectedItemIds(prev => prev.filter(id => id !== itemId)); closeConfirmModal(); } });
        }
    };

    const handleBulkAction = () => {
        if (selectedItemIds.length === activeItems.length) {
            setConfirmDialog({ isOpen: true, title: 'Cancel Purchase Order', message: 'You have selected all remaining items. Dropping all items will permanently cancel this Purchase Order. Proceed?', confirmText: 'Cancel PO', confirmColor: 'bg-red-600 hover:bg-red-500', onConfirm: () => { handleSave('cancelled'); closeConfirmModal(); } });
        } else {
            setConfirmDialog({ isOpen: true, title: 'Drop Selected Items', message: `Are you sure you want to drop ${selectedItemIds.length} item(s)? Their costs will be deducted from the Grand Total.`, confirmText: 'Drop Items', confirmColor: 'bg-red-600 hover:bg-red-500', onConfirm: () => { setRemovedItemIds(prev => [...prev, ...selectedItemIds]); setSelectedItemIds([]); closeConfirmModal(); } });
        }
    };

    const formatCurrency = (amount) => `₱${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const formatStatus = (rawStatus) => {
        let status = rawStatus;
        if (status === 'pending_approval') status = 'pending_evp_final';
        if (status === 'drafted') status = 'po_generated';

        const statusMap = {
            'pending_procurement_tl': { label: 'PO Generation Ready', color: 'bg-purple-100 text-purple-800 ring-1 ring-inset ring-purple-600/20' },
            'po_generated': { label: 'Purchase Order Review & EVP Submission', color: 'bg-green-100 text-green-800 ring-1 ring-inset ring-green-600/20' },
            'pending_evp_final': { label: 'Pending EVP Final Approval', color: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-600/20' },
            'approved': { label: 'Purchase Order Approved', color: 'bg-green-100 text-green-800 ring-1 ring-inset ring-green-600/20' },
            'cancelled': { label: 'Purchase Order Cancelled', color: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20' }
        };

        const mapped = statusMap[status] || {
            label: status ? status.replace(/_/g, ' ').toUpperCase() : 'UNKNOWN',
            color: 'bg-gray-100 text-gray-800 ring-1 ring-inset ring-gray-600/20'
        };

        return (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${mapped.color}`}>
                {mapped.label}
            </span>
        );
    };

    return (
        <SidebarLayout activeModule="PR/PO Module" sidebarLinks={sidebarLinks}>
            <Head title="Purchase Orders" />
            <div className="mx-auto max-w-7xl py-6 relative px-4 sm:px-6 lg:px-8">
                <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Purchase Orders</h2>
                        <p className="mt-1 text-sm text-gray-500">Manage generated POs, apply negotiated discounts, and finalize for delivery.</p>
                    </div>
                </div>

                <div className="mb-6 flex space-x-1 rounded-lg bg-gray-100 p-1 w-full sm:w-fit overflow-x-auto border border-gray-200 whitespace-nowrap">
                    <Link href={route('prpo.purchase-orders.index', { view: 'my_request' })} className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${currentView === 'my_request' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`}>
                        My Request {currentView !== 'my_request'}
                    </Link>

                    {!isRestrictedRole && (
                        <>
                            <Link href={route('prpo.purchase-orders.index', { view: 'action_needed' })} className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${currentView === 'action_needed' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`}>
                                For PO Generation {currentView !== 'action_needed'}
                            </Link>
                            <Link href={route('prpo.purchase-orders.index', { view: 'po_generation' })} className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${currentView === 'po_generation' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`}>
                                POs for EVP Submission
                            </Link>
                            <Link href={route('prpo.purchase-orders.index', { view: 'po_generated' })} className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${currentView === 'po_generated' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`}>
                                POs for EVP Approvals
                            </Link>
                            <Link href={route('prpo.purchase-orders.index', { view: 'all' })} className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${currentView === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'}`}>
                                Approved Purchase Orders
                            </Link>
                        </>
                    )}
                </div>

                <div className="mb-6 bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Search Purchase Order</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
                                <input type="text" placeholder="PO/PR ID, Preparer, or Supplier..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Branch</label>
                            <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors">
                                <option value="">All Branches</option>
                                {uniqueBranches.map((branch, idx) => (<option key={idx} value={branch}>{branch}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Priority</label>
                            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors">
                                <option value="">All Priorities</option>
                                {uniquePriorities.map((priority, idx) => (<option key={idx} value={priority}>{priority}</option>))}
                            </select>
                        </div>
                    </div>
                    {(searchQuery || filterBranch || filterPriority) && (
                        <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
                            <button onClick={() => { setSearchQuery(''); setFilterBranch(''); setFilterPriority(''); }} className="w-full sm:w-auto text-sm text-gray-500 hover:text-gray-800 font-semibold bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-md transition-colors">Clear Filters</button>
                        </div>
                    )}
                </div>

                {/* NEW: Render the waiting PRs directly above the PO table */}
                {currentView === 'action_needed' && pendingPRs && pendingPRs.length > 0 && (
                    <div className="mb-8 bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl overflow-x-auto border border-indigo-100">

                        <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-3 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">Purchase Request ID</th>
                                    <th className="px-3 py-2 text-center font-semibold text-gray-900 min-w-[150px]">Supplier Name</th>
                                    <th className="px-3 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">Date Needed</th>
                                    <th className="px-3 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">Est. Gross Amount</th>
                                    <th className="px-3 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">Est. Grand Total</th>
                                    <th className="px-3 py-2 text-center font-semibold text-gray-900">Status</th>
                                    <th className="px-3 py-2 text-center font-semibold text-gray-900"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {paginatedPRs.length === 0 ? (
                                    <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">No requests found matching your filters.</td></tr>
                                ) : (
                                    paginatedPRs.map((pr) => {
                                        // Dynamically calculate the totals and suppliers for the PR to match the PO styling
                                        const estTotal = pr.items?.reduce((sum, item) => sum + (parseFloat(item.total_cost) || 0), 0) || 0;

                                        // Pull all unique suppliers from the PR items
                                        const suppliers = [...new Set(pr.items?.map(i => i.supplier?.name).filter(Boolean))];
                                        const supplierText = suppliers.length > 1 ? 'Multiple Suppliers' : (suppliers[0] || 'Unknown Supplier');

                                        return (
                                            <tr key={pr.id} onClick={() => openModal({ purchase_request: pr, status: 'pending_procurement_tl' }, 'PR')} className="hover:bg-gray-50 transition cursor-pointer">
                                                <td className="px-6 py-2 text-center font-bold text-indigo-600 whitespace-nowrap">{pr.pr_number || `PR-${pr.id}`}</td>
                                                <td className="px-6 py-2 text-center font-medium text-gray-900">{supplierText}</td>
                                                <td className="px-6 py-2 whitespace-nowrap text-center">{pr.date_needed ? new Date(pr.date_needed).toLocaleDateString('en-US', {year: 'numeric',month: 'long',day: 'numeric'}) : "N/A"}</td>
                                                <td className="px-6 py-2 text-center text-gray-500 whitespace-nowrap">{formatCurrency(estTotal)}</td>
                                                <td className="px-6 py-2 text-center font-bold text-gray-900 whitespace-nowrap">{formatCurrency(estTotal)}</td>
                                                <td className="px-6 py-2 text-center whitespace-nowrap">
                                                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold bg-purple-100 text-purple-800">PO Generation Ready</span>
                                                </td>
                                                <td className="px-6 py-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                    <button onClick={(e) => handleGeneratePO(pr.id, e)} className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 transition-all">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> Generate PO
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>

                        {prTotalPages > 1 && (
                            <div className="flex flex-col sm:flex-row justify-between items-center border-t border-gray-200 bg-gray-50 px-6 py-4">
                                <span className="text-sm text-gray-600">Showing <span className="font-bold text-gray-900">{((prPage - 1) * itemsPerPage) + 1}</span> to <span className="font-bold text-gray-900">{Math.min(prPage * itemsPerPage, filteredPendingPRs.length)}</span> of <span className="font-bold text-gray-900">{filteredPendingPRs.length}</span> entries</span>
                                <div className="flex items-center gap-2 mt-3 sm:mt-0">
                                    <button onClick={() => setPrPage(p => Math.max(1, p - 1))} disabled={prPage === 1} className="px-4 py-2 text-sm font-semibold rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">Previous</button>
                                    <span className="text-sm font-medium text-gray-700 px-2">Page {prPage} of {prTotalPages}</span>
                                    <button onClick={() => setPrPage(p => Math.min(prTotalPages, p + 1))} disabled={prPage === prTotalPages} className="px-4 py-2 text-sm font-semibold rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">Next</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {currentView !== 'action_needed' && (
                <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">Purchase Order ID</th>
                                <th className="px-2 py-2 text-center font-semibold text-gray-900 w-56">Supplier Name</th>
                                <th className="px-6 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">Purchase Order Date</th>
                                <th className="px-6 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">Gross Amount</th>
                                <th className="px-6 py-2 text-center font-semibold text-gray-900 whitespace-nowrap">Grand Total</th>
                                <th className="px-6 py-2 text-center font-semibold text-gray-900 w-56">Status</th>
                                <th className="px-6 py-2 text-center font-semibold text-gray-900 w-56">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {paginatedPOs.length === 0 ? (
                                <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-500">{searchQuery || filterBranch || filterPriority ? 'No Purchase Orders match your filters.' : 'No Purchase Orders found.'}</td></tr>
                            ) : (
                                paginatedPOs.map((po) => (
                                    <tr key={po.id} onClick={() => openModal(po)} className="hover:bg-gray-50 transition cursor-pointer">
                                        <td className="px-6 py-2 text-center font-bold text-indigo-600 whitespace-nowrap">{po.po_number || po.purchase_request?.pr_number}</td>
                                        <td className="px-2 py-2 text-center font-medium text-gray-900 w-56 whitespace-normal break-words">{po.supplier?.name || 'Unknown Supplier'}</td>
                                        <td className="px-6 py-2 whitespace-nowrap text-center">{po.created_at ? new Date(po.created_at).toLocaleDateString('en-US', {year: 'numeric',month: 'long',day: 'numeric'}): "N/A"}</td>
                                        <td className="px-6 py-2 text-center text-gray-500 whitespace-nowrap">{formatCurrency(po.gross_amount)}</td>
                                        <td className="px-6 py-2 text-center font-bold text-gray-900 whitespace-nowrap">{formatCurrency(po.grand_total)}</td>
                                        <td className="px-6 py-2 text-center w-56 whitespace-normal break-words">{formatStatus(po.status)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {poTotalPages > 1 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center border-t border-gray-200 bg-gray-50 px-6 py-2 rounded-b-xl">
                            <span className="text-sm text-gray-600">Showing <span className="font-bold text-gray-900">{((poPage - 1) * itemsPerPage) + 1}</span> to <span className="font-bold text-gray-900">{Math.min(poPage * itemsPerPage, filteredPOs.length)}</span> of <span className="font-bold text-gray-900">{filteredPOs.length}</span> entries</span>
                            <div className="flex items-center gap-2 mt-3 sm:mt-0">
                                <button onClick={() => setPoPage(p => Math.max(1, p - 1))} disabled={poPage === 1} className="px-4 py-2 text-sm font-semibold rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">Previous</button>
                                <span className="text-sm font-medium text-gray-700 px-2">Page {poPage} of {poTotalPages}</span>
                                <button onClick={() => setPoPage(p => Math.min(poTotalPages, p + 1))} disabled={poPage === poTotalPages} className="px-4 py-2 text-sm font-semibold rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">Next</button>
                            </div>
                        </div>
                    )}
                </div>
                )}

                {isModalOpen && selectedPO && (
                    <div onClick={closeModal} className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-gray-900 bg-opacity-60 backdrop-blur-sm p-4 sm:p-6">
                        <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-6xl rounded-2xl bg-white shadow-2xl transition-all flex flex-col max-h-[90vh]">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b px-4 sm:px-6 py-2 shrink-0 bg-gray-50 rounded-t-2xl relative">
                                <div className="pr-8 mb-3 sm:mb-0">
                                    <h3 className="text-xl font-bold text-gray-900 flex flex-wrap items-center gap-2 sm:gap-3">
                                        {modalView === 'PO' ? selectedPO.po_number : `${selectedPO.purchase_request?.pr_number || selectedPO.pr_number}`}
                                        {formatStatus(modalView === 'PO' ? selectedPO.status : (selectedPO.purchase_request?.status || selectedPO.status))}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {modalView === 'PO' ? <>Supplier: <span className="font-semibold text-gray-700">{selectedPO.supplier?.name}</span></> : <>Prepared by {selectedPO.purchase_request?.user?.name || selectedPO.user?.name} on {selectedPO.purchase_request?.date_prepared || selectedPO.date_prepared}</>}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                                    {selectedPO.purchase_request && selectedPO.po_number && (
                                        <button onClick={() => setModalView(modalView === 'PO' ? 'PR' : 'PO')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-md border border-indigo-100 transition-colors w-full sm:w-auto text-center">
                                            {modalView === 'PO' ? 'View Original PR ➔' : '← Back to PO'}
                                        </button>
                                    )}
                                    {modalView === 'PO' && (selectedPO.status === 'approved' || selectedPO.status === 'drafted' || selectedPO.status === 'pending_procurement_tl' || selectedPO.status === 'pending_evp_final' || selectedPO.status === 'pending_approval' || selectedPO.status === 'po_generated') && (
                                    <a href={route('prpo.purchase-orders.print', selectedPO.id)} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-2 rounded-md flex items-center justify-center gap-1 shadow-sm transition-colors w-full sm:w-auto">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> View Purchase Order PDF
                                    </a>
                                    )}
                                    {modalView === 'PR' && canManagePO && (
                                        <a href={route('prpo.purchase-requests.print', selectedPO.purchase_request.id)} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-2 rounded-md flex items-center justify-center gap-1 shadow-sm transition-colors w-full sm:w-auto">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> View Purchase Request PDF
                                        </a>
                                    )}
                                </div>
                                <button onClick={closeModal} className="absolute top-4 right-4 sm:static text-gray-400 hover:text-gray-600 p-1"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>

                            <div className="overflow-y-auto px-4 sm:px-6 py-6 flex-1 bg-white">
                                <div className="mb-8 sm:px-12 md:px-24">
                                    <TrackingStepper currentStatus={modalView === 'PO' ? selectedPO.status : selectedPO.purchase_request?.status} type={modalView === 'PO' ? 'PO' : 'PR'} branch={selectedPO.purchase_request?.branch} pr={selectedPO.purchase_request} />
                                </div>

                                {selectedPO.status === 'cancelled' && selectedPO.remarks && (
                                    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                                        <label className="text-xs font-bold text-red-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> Reason for Cancellation
                                        </label>
                                        <p className="text-sm text-red-700 whitespace-pre-wrap leading-relaxed break-all">{selectedPO.remarks}</p>
                                    </div>
                                )}

                                {modalView === 'PO' ? (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Delivery Date</label>
                                                <input type="date" disabled={!isEditMode} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100" value={data.delivery_date} onChange={e => setData('delivery_date', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Payment Terms</label>
                                                <input type="text" disabled={!isEditMode} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100" value={data.payment_terms} onChange={e => setData('payment_terms', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Ship To</label>
                                                <input type="text" disabled={!isEditMode} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100" value={data.ship_to} onChange={e => setData('ship_to', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">No. of Quotations <span className="text-red-500">*</span></label>
                                                <input type="number" disabled={!isEditMode} min="0" required className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm disabled:bg-gray-100 ${errors.no_of_quotations ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'}`} value={data.no_of_quotations} onChange={e => { setData('no_of_quotations', e.target.value); clearErrors('no_of_quotations'); }} />
                                                {errors.no_of_quotations && <p className="mt-1 text-xs font-semibold text-red-600">{errors.no_of_quotations}</p>}
                                            </div>
                                        </div>

                                        {removedItems.length > 0 && (
                                            <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between bg-red-50 p-3 rounded-lg border border-red-100">
                                                <span className="text-sm font-medium text-red-800">{removedItems.length} item(s) have been dropped from this PO.</span>
                                                <button onClick={() => setIsRemovedModalOpen(true)} className="w-full sm:w-auto text-xs font-bold bg-white text-red-700 px-3 py-2 rounded shadow-sm border border-red-200 hover:bg-red-50 transition text-center">View Removed Items</button>
                                            </div>
                                        )}

                                        <div className="flex flex-col lg:flex-row gap-8">
                                            <div className="flex-1 overflow-hidden">
                                                {selectedItemIds.length > 0 && isEditMode && (
                                                    <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 transition-all">
                                                        <span className="text-sm font-semibold text-indigo-800">{selectedItemIds.length} item(s) selected</span>
                                                        <button onClick={handleBulkAction} className="w-full sm:w-auto bg-red-600 text-white px-4 py-2 rounded-md text-sm font-bold shadow-sm hover:bg-red-500 transition">{selectedItemIds.length === activeItems.length ? 'Cancel PO' : 'Drop Selected'}</button>
                                                    </div>
                                                )}

                                                <div className="overflow-x-auto rounded-lg border border-gray-200 w-full">
                                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                                        <thead className="bg-gray-100">
                                                            <tr>
                                                                {isEditMode && (
                                                                    <th className="px-4 py-2 w-10 text-center"><input type="checkbox" className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 cursor-pointer" checked={selectedItemIds.length === activeItems.length && activeItems.length > 0} onChange={handleSelectAll} /></th>
                                                                )}
                                                                <th className="px-3 py-2 font-semibold text-center min-w-[90px]">Product Name</th>
                                                                <th className="px-3 py-2 font-semibold text-center min-w-[70px]">Description</th>
                                                                <th className="px-3 py-2 font-semibold text-center min-w-[50px]">Requested Quantity</th>
                                                                <th className="px-3 py-2 font-semibold text-center min-w-[70px]">Unit Price</th>
                                                                <th className="px-3 py-2 font-semibold text-center min-w-[70px]">Total Cost</th>
                                                                {isEditMode && <th className="px-3 py-2 font-semibold text-center min-w-[0px]">Action</th>}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-200 bg-white">
                                                            {activeItems.map((item) => (
                                                                <tr key={item.id} className={selectedItemIds.includes(item.id) ? 'bg-indigo-50/50' : ''}>
                                                                    {isEditMode && (
                                                                        <td className="px-4 py-2 text-center"><input type="checkbox" className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 cursor-pointer" checked={selectedItemIds.includes(item.id)} onChange={() => handleSelectItem(item.id)} /></td>
                                                                    )}
                                                                    <td className="px-4 py-2 font-medium text-gray-900 min-w-[150px]">{item.description}</td>
                                                                    <td className="px-4 py-2 min-w-[150px]"><input type="text" value={item.notes || ''} onChange={(e) => handleItemNoteChange(item.id, e.target.value)} disabled={!isEditMode} placeholder="e.g. 15+1 Freebie" className="block w-full min-w-[120px] rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-transparent disabled:border-transparent disabled:p-0 disabled:text-gray-600 font-medium" /></td>
                                                                    <td className="px-4 py-2 text-center font-bold">{parseFloat(item.qty)} {item.unit}</td>
                                                                    <td className="px-4 py-2 text-right whitespace-nowrap">₱{item.unit_price}</td>
                                                                    <td className="px-4 py-2 text-right font-medium whitespace-nowrap">₱{item.net_payable}</td>
                                                                    {isEditMode && (
                                                                        <td className="px-4 py-2 text-center"><button onClick={() => handleRemoveItem(item.id)} className="text-red-600 hover:text-red-800 font-bold text-xs bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded transition">Drop</button></td>
                                                                    )}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            <div className="w-full lg:w-80 shrink-0 bg-gray-50 rounded-lg p-5 border border-gray-200 h-fit mt-6 lg:mt-0">
                                                <h4 className="font-bold text-gray-900 mb-4 border-b pb-2">Amount Summary</h4>
                                                <div className="space-y-3 text-sm">
                                                    <div className="flex justify-between text-gray-600"><span>Gross Amount:</span><span className="font-medium text-gray-900">{formatCurrency(selectedPO.gross_amount || 0)}</span></div>
                                                    {selectedPO.discount_total > 0 && (<div className="flex justify-between text-gray-600"><span>Less: Discount</span><span className="font-medium text-indigo-500">-{formatCurrency(selectedPO.discount_total)}</span></div>)}
                                                    <div className="flex justify-between text-gray-600 font-medium pt-2 border-t border-gray-200"><span>Net of Discount:</span><span>{formatCurrency(selectedPO.net_of_discount || selectedPO.gross_amount || 0)}</span></div>
                                                    <div className="flex justify-between items-center text-gray-600"><div className="flex items-center gap-1"><span>VAT Rate</span><input type="number" disabled={!isEditMode} className="w-16 rounded border-gray-300 shadow-sm py-0.5 px-1 text-xs text-center disabled:bg-gray-100" value={data.vat_rate} onChange={e => setData('vat_rate', e.target.value)} /><span>%</span></div><span>{formatCurrency(selectedPO.vat_total || 0)}</span></div>
                                                    <div className="flex justify-between items-center text-indigo-900 font-black text-lg pt-4 border-t border-gray-300 mt-4"><span>GRAND TOTAL</span><span>{formatCurrency(selectedPO.grand_total || 0)}</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="animate-in fade-in duration-300">
                                        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm">
                                            <div><span className="block font-semibold text-gray-900">Carbon Copy (CC)</span> {selectedPO.purchase_request?.cc_user?.name || selectedPO.cc_user?.name || "N/A"}</div>
                                            <div><span className="block font-semibold text-gray-900">Branch</span> {selectedPO.purchase_request?.branch || selectedPO.branch}</div>
                                            <div><span className="block font-semibold text-gray-900">Department</span> {selectedPO.purchase_request?.department || selectedPO.department}</div>
                                            <div><span className="block font-semibold text-gray-900">Request Type</span> {selectedPO.purchase_request?.request_type || selectedPO.request_type || 'N/A'}</div>
                                            <div><span className="block font-semibold text-gray-900">Priority</span> {selectedPO.purchase_request?.priority || selectedPO.priority || 'N/A'}</div>
                                            <div><span className="block font-semibold text-gray-900">Date Needed</span> <span className="text-red-600 font-bold">{selectedPO.purchase_request?.date_needed || selectedPO.date_needed || 'N/A'}</span></div>
                                            <div><span className="block font-semibold text-gray-900">Budget Status</span> {selectedPO.purchase_request?.budget_status || selectedPO.budget_status || 'N/A'}</div>
                                            <div><span className="block font-semibold text-gray-900">Status</span> {formatStatus(selectedPO.purchase_request?.status || selectedPO.status)}</div>
                                            {(selectedPO.purchase_request?.purpose_of_request || selectedPO.purpose_of_request) && (
                                                <div className="col-span-2 sm:col-span-4 mt-2 border-t pt-2 border-gray-200">
                                                    <span className="block font-semibold text-gray-900">Purpose of Request</span>
                                                    <p className="text-gray-600 whitespace-pre-wrap">{selectedPO.purchase_request?.purpose_of_request || selectedPO.purpose_of_request}</p>
                                                </div>
                                            )}
                                        </div>

                                        <h4 className="mb-2 font-bold text-gray-900 border-b pb-1">Requested Items</h4>
                                        <div className="overflow-x-auto rounded-lg border border-gray-200 mb-6 w-full">
                                            <table className="min-w-full divide-y divide-gray-200 text-sm text-left table-fixed">
                                                <thead className="bg-gray-100">
                                                    <tr>
                                                        <th className="px-4 py-2 font-semibold w-1/4">Product Name</th>
                                                        <th className="px-4 py-2 font-semibold w-1/4">Description</th>
                                                        <th className="px-4 py-2 font-semibold text-center w-24">Requested Quantity</th>
                                                        <th className="px-4 py-2 font-semibold w-1/4">Supplier Name</th>
                                                        <th className="px-4 py-2 font-semibold text-right w-24">Estimated Cost</th>
                                                        <th className="px-4 py-2 font-semibold text-right w-24">Total Cost</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 bg-white">
                                                    {(selectedPO.purchase_request?.items || selectedPO.items)?.map((prItem, idx) => (
                                                        <tr key={prItem.id || idx}>
                                                            <td className="px-4 py-2 font-medium text-gray-900 truncate" title={prItem.product?.name}>{prItem.product?.name || prItem.product_name || `Product ID: ${prItem.product_id || 'N/A'}`}</td>
                                                            <td className="px-4 py-2 text-gray-500 max-w-xs break-words">{prItem.specifications || '-'}</td>
                                                            <td className="px-4 py-2 text-center font-bold">{parseFloat(prItem.qty_requested || prItem.qty)} {prItem.unit}</td>
                                                            <td className="px-4 py-2 text-gray-500 truncate">{prItem.supplier?.name || "-"}</td>
                                                            <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(prItem.est_unit_cost || 0)}</td>
                                                            <td className="px-4 py-2 text-right font-bold text-indigo-700">{formatCurrency(prItem.total_cost || ((prItem.qty_requested || prItem.qty) * (prItem.est_unit_cost || 0)))}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-3 border-t bg-gray-50 px-6 py-2 shrink-0 rounded-b-2xl">
                                <button onClick={closeModal} className="text-sm font-semibold text-gray-700 hover:text-gray-900 px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-100">Close Window</button>

                                {modalView === 'PR' && selectedPO.purchase_request?.status === 'pending_procurement_tl' && canManagePO && (
                                    <button onClick={(e) => handleGeneratePO(selectedPO.purchase_request.id, e)} className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 focus:outline-none transition-all">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                        Generate PO
                                    </button>
                                )}

                                {modalView === 'PO' && !isEditMode && canEditPO && !['approved', 'cancelled'].includes(selectedPO.status) && (
                                    <button onClick={() => setIsEditMode(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
                                        Edit PO
                                    </button>
                                )}

                                {modalView === 'PO' && isEditMode && (
                                    <>
                                        <button onClick={() => { setIsEditMode(false); openModal(selectedPO, 'PO'); }} className="text-sm font-semibold text-gray-700 hover:text-gray-900 px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-100 flex items-center gap-1.5">
                                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                            Cancel Edit
                                        </button>
                                        <button onClick={() => handleSave(selectedPO.status)} disabled={processing} className="w-full sm:w-auto inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors">
                                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                            Save Updates
                                        </button>
                                    </>
                                )}

                                {modalView === 'PO' && !isEditMode && ['po_generated', 'drafted'].includes(selectedPO.status) && isProcurementTL && (
                                    <button onClick={() => confirmSave('pending_evp_final')} disabled={processing} className="w-full sm:w-auto inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">
                                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                        Submit to EVP for Final Approval
                                    </button>
                                )}

                                {modalView === 'PO' && !isEditMode && ['pending_evp_final', 'pending_approval'].includes(selectedPO.status) && isEVP && (
                                    <>
                                        <button onClick={() => confirmSave('cancelled')} disabled={processing} className="w-full sm:w-auto inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500">
                                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                            Reject PO
                                        </button>
                                        <button onClick={() => confirmSave('po_generated')} disabled={processing} className="w-full sm:w-auto inline-flex items-center gap-1.5 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-400">
                                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
                                            Return to Generation Queue
                                        </button>
                                        <button onClick={() => confirmSave('approved')} disabled={processing} className="w-full sm:w-auto inline-flex items-center gap-1.5 rounded-md bg-green-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500">
                                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                            Approve Purchase Order
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Removed Items / Modal implementations exact as provided original */}
            <ConfirmModal show={confirmDialog.isOpen} onClose={closeConfirmModal} title={confirmDialog.title} message={confirmDialog.message} confirmText={confirmDialog.confirmText} confirmColor={confirmDialog.confirmColor} onConfirm={confirmDialog.onConfirm} />
            <Modal show={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} maxWidth="md">
                <div className="p-4 sm:p-6 max-h-[85vh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b pb-4 mb-5">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900">Reason for Rejection</h2>
                        <button onClick={() => setIsRejectModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                    <form onSubmit={submitRejection}>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Please provide a brief reason why this Purchase Order is being rejected.</label>
                            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm" rows="4" placeholder="e.g., Exceeds budget, incorrect item specifications..." required />
                        </div>
                        <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
                            <button type="button" onClick={() => setIsRejectModalOpen(false)} className="w-full sm:w-auto rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none">Cancel</button>
                            <button type="submit" disabled={processing} className="w-full sm:w-auto rounded-md bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-500 transition-colors disabled:opacity-50">Confirm Reject</button>
                        </div>
                    </form>
                </div>
            </Modal>
        </SidebarLayout>
    );
}
