import ConfirmModal from "@/Components/ConfirmModal";
import TrackingStepper from "@/Components/TrackingStepper";
import {
    getPRPOLinks,
    canUserBypassViewMode,
    hasElevatedPermission,
    isUserAdmin,
} from "@/Config/navigation";
import SidebarLayout from "@/Layouts/SidebarLayout";
import { Head, Link, router, useForm } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";

const SearchableDropdown = ({ options, value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const wrapperRef = useRef(null);

    const selectedOption = options.find((opt) => String(opt.id) === String(value));

    useEffect(() => {
        if (!isOpen) {
            setSearchTerm(selectedOption ? selectedOption.name : "");
        }
    }, [isOpen, selectedOption]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm(selectedOption ? selectedOption.name : "");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [selectedOption]);

    const filteredOptions = options.filter((opt) =>
        opt.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    return (
        <div ref={wrapperRef} className="relative w-full">
            <input
                type="text"
                className="block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder={placeholder}
                value={isOpen ? searchTerm : selectedOption ? selectedOption.name : ""}
                onChange={(e) => {
                    const newVal = e.target.value;
                    setSearchTerm(newVal);
                    setIsOpen(true);
                    if (selectedOption && newVal !== selectedOption.name) onChange("");
                }}
                onFocus={() => {
                    setIsOpen(true);
                    setSearchTerm(selectedOption ? selectedOption.name : "");
                }}
            />
            {isOpen && (
                <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md bg-white py-1 text-xs shadow-lg ring-1 ring-black ring-opacity-5">
                    {filteredOptions.length === 0 ? (
                        <li className="px-3 py-2 text-gray-500">No results found</li>
                    ) : (
                        filteredOptions.map((opt) => (
                            <li
                                key={opt.id}
                                className="cursor-pointer px-3 py-2 hover:bg-indigo-600 hover:text-white transition-colors truncate"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    onChange(opt.id);
                                    setIsOpen(false);
                                    setSearchTerm(opt.name);
                                }}
                            >
                                {opt.name}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
};

const CCMultiSelect = ({ options = [], value = [], onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const wrapperRef = useRef(null);

    const safeOptions = Array.isArray(options) ? options : [];
    const safeValue = Array.isArray(value) ? value : [];
    const selectedOptions = safeOptions.filter((opt) => safeValue.map(String).includes(String(opt.id)));

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = safeOptions.filter((opt) =>
        opt.name.toLowerCase().includes(searchTerm.toLowerCase()) && !safeValue.map(String).includes(String(opt.id))
    );

    const handleRemove = (idToRemove) => {
        onChange(safeValue.filter(id => String(id) !== String(idToRemove)));
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div className="flex flex-wrap gap-1 mb-2">
                {selectedOptions.map(opt => (
                    <span key={opt.id} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                        {opt.name}
                        <button type="button" onClick={() => handleRemove(opt.id)} className="text-indigo-500 hover:text-indigo-900 focus:outline-none ml-1">&times;</button>
                    </span>
                ))}
            </div>
            <input
                type="text"
                className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder={placeholder}
                value={searchTerm}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
            />
            {isOpen && (
                <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5">
                    {filteredOptions.length === 0 ? (
                        <li className="px-3 py-2 text-gray-500">No results found</li>
                    ) : (
                        filteredOptions.map((opt) => (
                            <li
                                key={opt.id}
                                className="cursor-pointer px-3 py-2 hover:bg-indigo-600 hover:text-white transition-colors truncate"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    setSearchTerm("");
                                    onChange([...safeValue, opt.id]);
                                    setIsOpen(false);
                                }}
                            >
                                {opt.name}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
};

const SortIcon = ({ active, direction }) => {
    if (!active) return <svg className="w-3 h-3 text-gray-400 opacity-50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
    return direction === 'asc' ? (
        <svg className="w-3 h-3 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
    ) : (
        <svg className="w-3 h-3 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
    );
};

export default function ApprovalBoard({ auth, requests, currentView, userBranches = [], suppliers = [], products = [], branches = [], departments = [], employees = [] }) {
    const sidebarLinks = getPRPOLinks(auth);

    const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const userRole = auth.user.role?.name?.toLowerCase().trim() || "";
    const isEVP = userRole.includes("evp") || userRole.includes("president") || auth.user.role_id === 9;

    const canManagePO = ["procurement tl", "executive vice president", "evp", "president", "admin"].includes(userRole);
    const isInvTL = userRole === "inventory tl" || userRole === "admin" || isEVP;
    const isOpsManager = userRole.includes("operations") || userRole.includes("ops manager") || userRole === "admin" || isEVP;
    const isUnrestricted = userRole === "admin" || userRole.includes("procurement") || isEVP;
    const isProcurementAssist = userRole.includes("procurement assist") || userRole === "admin" || isEVP;
    const isProcurementTL = userRole.includes("procurement tl") || userRole.includes("procurement team leader") || userRole === "admin" || isEVP;

    const requestList = Array.isArray(requests?.data) ? requests.data : Array.isArray(requests) ? requests : [];
    const [searchQuery, setSearchQuery] = useState("");
    const [filterBranch, setFilterBranch] = useState("");
    const [filterPriority, setFilterPriority] = useState("");
    const [filterStatus, setFilterStatus] = useState("");

    const uniqueBranches = useMemo(() => [...new Set(requestList.map((req) => req.branch).filter(Boolean))].sort(), [requestList]);
    const uniquePriorities = useMemo(() => [...new Set(requestList.map((req) => req.priority).filter(Boolean))].sort(), [requestList]);
    const uniqueStatuses = useMemo(() => [...new Set(requestList.map((req) => req.status).filter(Boolean))].sort(), [requestList]);

    const filteredRequests = useMemo(() => {
        const filtered = requestList.filter((req) => {
            const searchLower = searchQuery.toLowerCase().trim();
            const prId = (req.pr_number || "").toLowerCase();
            const preparedBy = (req.user?.name || "").toLowerCase();
            const matchesSearch = !searchLower || prId.includes(searchLower) || preparedBy.includes(searchLower);
            const matchesBranch = !filterBranch || req.branch === filterBranch;
            const matchesPriority = !filterPriority || req.priority === filterPriority;
            const matchesStatus = !filterStatus || req.status === filterStatus;
            return matchesSearch && matchesBranch && matchesPriority && matchesStatus;
        });

        return filtered.sort((a, b) => {
            let valA, valB;
            if (sortConfig.key === 'id') {
                valA = a.pr_number || "";
                valB = b.pr_number || "";

                const numA = parseInt(valA.replace(/\D/g, ''), 10) || a.id || 0;
                const numB = parseInt(valB.replace(/\D/g, ''), 10) || b.id || 0;

                return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
            } else if (sortConfig.key === 'date') {
                valA = new Date(a.date_needed || 0).getTime();
                valB = new Date(b.date_needed || 0).getTime();
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }
            return 0;
        });
    }, [requestList, searchQuery, filterBranch, filterPriority, filterStatus, sortConfig]);


    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterBranch, filterPriority, filterStatus, currentView]);

    const paginatedRequests = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredRequests.slice(start, start + itemsPerPage);
    }, [filteredRequests, currentPage]);

    const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: "", message: "", confirmText: "", confirmColor: "", onConfirm: () => {} });
    const closeConfirmModal = () => setConfirmDialog({ ...confirmDialog, isOpen: false });
    const [selectedPR, setSelectedPR] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const { data: editData, setData: setEditData, put: submitEditPR, processing: isEditing, errors: editErrors } = useForm({
        branch: "", department: "", date_prepared: "", request_type: "", priority: "", date_needed: "", budget_status: "", budget_ref: "", purpose_of_request: "", impact_if_not_procured: "", cc_users: [], items: []
    });
    const [actionModal, setActionModal] = useState({ isOpen: false, prId: null, actionType: "", reason: "" });

    const openActionModal = (id, type) => setActionModal({ isOpen: true, prId: id, actionType: type, reason: "" });
    const closeActionModal = () => setActionModal({ isOpen: false, prId: null, actionType: "", reason: "" });

    const submitActionModal = () => {
        router.patch(route("prpo.purchase-requests.update-status", actionModal.prId), { action: actionModal.actionType, rejection_reason: actionModal.reason }, {
            preserveScroll: true,
            onSuccess: () => { closeActionModal(); closeModal(); },
        });
    };

    const canApprove = (pr) => {
        if (!pr) return false;
        const hasBranchAccess = userRole === "admin" || isEVP || userBranches.includes(pr.branch);
        if (pr.status === "pending_inv_tl" && (isInvTL || isEVP) && hasBranchAccess) return true;
        if (pr.status === "pending_ops_manager" && (isOpsManager || isEVP) && hasBranchAccess) return true;
        if ((pr.status === "pr_generated" || pr.status === "pending_procurement") && (isProcurementAssist || isEVP)) return true;
        return false;
    };

    const canEditPR = (pr) => {
        if (!pr) return false;
        const hasBranchAccess = userRole === "admin" || isEVP || userBranches.includes(pr.branch);
        if (userRole === "admin" || isEVP) return true;
        if (pr.status === "returned" && pr.user_id === auth.user.id) return true;
        if (pr.status === "pending_inv_tl" && (isInvTL || isEVP) && hasBranchAccess) return true;
        if (pr.status === "pending_ops_manager" && (isOpsManager || isEVP) && hasBranchAccess) return true;
        return false;
    };

    const formatStatus = (rawStatus) => {

        let status = rawStatus;
        if (status === 'pending_approval') status = 'pending_evp_final';
        if (status === 'drafted') status = 'po_generated';


        const statusMap = {
            pending_inv_tl: { label: "Pending Approval: Inventory Team Leader", color: "bg-yellow-100 text-yellow-800" },
            pending_ops_manager: { label: "PR Generation & Approval: Operations Manager", color: "bg-orange-100 font-bold text-orange-800" },
            pr_generated: { label: "Purchase Request Generated", color: "bg-blue-100 font-bold text-blue-800" },
            pending_procurement: { label: "PR Review & Endorsement: Procurement Assistant", color: "bg-purple-100 text-purple-800" },
            pending_procurement_tl: { label: "Purchase Order Generation: Procurement TL", color: "bg-purple-100 font-bold text-purple-800" },
            po_generated: { label: "Purchase Order Generated", color: "bg-green-100 font-bold text-green-800" },
            pending_evp_final: { label: "Pending EVP Final Approval", color: "bg-yellow-100 text-yellow-800" },
            approved: { label: "Purchase Order Approved", color: "bg-green-100 font-bold text-green-800" },
            rejected: { label: "REJECTED", color: "bg-red-100 font-bold text-red-800" },
            cancelled: { label: "CANCELLED", color: "bg-gray-100 font-bold text-gray-500" },
        };

        const mapped = statusMap[status] || { label: status, color: "bg-gray-100 font-bold text-gray-800" };

        return (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${mapped.color}`}>
                {mapped.label}
            </span>
        );
    };

    const handleAction = (id, actionType) => {
        if (["reject", "return_to_inv_tl", "return_to_creator"].includes(actionType)) {
            openActionModal(id, actionType);
            return;
        }


        if (actionType === 'review_pr') {
            const pdfWindow = window.open('', '_blank'); // Open immediately to bypass popup blocker
            router.patch(route("prpo.purchase-requests.update-status", id), { action: actionType }, {
                preserveScroll: true,
                onSuccess: () => {
                    closeModal();
                    if (pdfWindow) pdfWindow.location.href = route("prpo.purchase-requests.print", id);
                },
                onError: () => {
                    if (pdfWindow) pdfWindow.close();
                }
            });
            return;
        }

        let title = "Approve Request";
        let message = "Are you sure you want to approve this purchase request?";
        let confirmText = "Approve";
        let confirmColor = "bg-green-600 hover:bg-green-500";

        if (actionType === 'generate_pr_as_om_fallback') {
            title = "OM Fallback: Generate PR";
            message = "Generate Purchase Request on behalf of the Operations Manager?";
            confirmText = "EVP: Generate PR";
            confirmColor = "bg-blue-600 hover:bg-blue-500";
        } else if (actionType === 'generate_pr') {
            title = "Generate PR";
            message = "Approve and generate the Purchase Request document?";
            confirmText = "Generate PR";
            confirmColor = "bg-blue-600 hover:bg-blue-500";
        } else if (actionType === 'endorse') {
            title = "Endorse Request";
            message = "Endorse this Purchase Request to the Procurement Team Leader?";
            confirmText = "Endorse PR";
            confirmColor = "bg-purple-600 hover:bg-purple-500";
        } else if (actionType === 'cancel') {
            title = "Cancel Request";
            message = "Are you sure you want to cancel this purchase request?";
            confirmText = "Cancel";
            confirmColor = "bg-gray-600 hover:bg-gray-500";
        }

        setConfirmDialog({
            isOpen: true,
            title,
            message,
            confirmText,
            confirmColor,
            onConfirm: () => {
                router.patch(route("prpo.purchase-requests.update-status", id), { action: actionType }, {
                    preserveScroll: true,
                    onSuccess: () => { closeConfirmModal(); closeModal(); },
                });
            },
        });
    };

    const handleGeneratePO = (id) => {
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

    const openModal = (pr) => { setSelectedPR(pr); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setTimeout(() => setSelectedPR(null), 200); };
    const availableBranches = isUnrestricted ? branches : branches.filter((b) => userBranches.includes(b.name));
    const branchEmployees = employees.filter((emp) => { if (!editData.branch) return false; return emp.branches?.some((b) => b.name === editData.branch); });

    const openEditModal = () => {
        setEditData({
            branch: selectedPR.branch || "", department: selectedPR.department || "", date_prepared: selectedPR.date_prepared || "", request_type: selectedPR.request_type || "", priority: selectedPR.priority || "", date_needed: selectedPR.date_needed || "", budget_status: selectedPR.budget_status || "", budget_ref: selectedPR.budget_ref || "", purpose_of_request: selectedPR.purpose_of_request || "", impact_if_not_procured: selectedPR.impact_if_not_procured || "", cc_users: Array.isArray(selectedPR.cc_users) ? selectedPR.cc_users : (typeof selectedPR.cc_users === 'string' ? JSON.parse(selectedPR.cc_users || '[]') : []),
            items: selectedPR.items.map((item) => ({ ...item, historical_product_name: item.product?.name || item.product_name || "Unknown Product", historical_supplier_name: item.supplier?.name || "Unknown Supplier" })),
        });
        setIsModalOpen(false);
        setTimeout(() => setIsEditModalOpen(true), 200);
    };

    const addEditItemRow = () => setEditData("items", [...editData.items, { product_id: "", specifications: "", unit: "", qty_requested: "", qty_on_hand: "", reorder_level: "", supplier_id: "", est_unit_cost: "", total_cost: 0 }]);
    const removeEditItemRow = (index) => { const newItems = [...editData.items]; newItems.splice(index, 1); setEditData("items", newItems); };
    const handleEditItemChange = (index, field, value) => {
        const newItems = [...editData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        if (field === "product_id") {
            const selectedProduct = products.find((p) => String(p.id) === String(value));
            if (selectedProduct) {
                newItems[index].supplier_id = selectedProduct.supplier_id || "";
                newItems[index].unit = selectedProduct.unit || "";
                newItems[index].est_unit_cost = selectedProduct.price || 0;
                newItems[index].total_cost = (parseFloat(newItems[index].qty_requested) || 0) * (parseFloat(newItems[index].est_unit_cost) || 0);
            }
        }
        if (field === "qty_requested" || field === "est_unit_cost") {
            newItems[index].total_cost = (parseFloat(newItems[index].qty_requested) || 0) * (parseFloat(newItems[index].est_unit_cost) || 0);
        }
        setEditData("items", newItems);
    };

    const handleSaveEdit = (e) => {
        e.preventDefault();
        submitEditPR(route("prpo.purchase-requests.update", selectedPR.id), { preserveScroll: true, onSuccess: () => { setIsEditModalOpen(false); setSelectedPR(null); } });
    };

    const getHeaderContent = () => {
        switch (currentView) {
            case "my_requests": return { title: "My Purchase Requests", desc: "Track the status of PRs you have submitted." };
            case "for_approval": return { title: "Purchase Requests For Approval", desc: "Review and manage purchase requests awaiting your approval." };
            case "for_generation": return { title: "Purchase Orders To Generate", desc: "Generate purchase orders for endorsed purchase requests." };
            case "po_generated": return { title: "PO Generated", desc: "View purchase requests that have already been converted into purchase orders." };
            case "history": return { title: "Purchase Request History", desc: "View completed and historical purchase requests." };
            default: return { title: "My Purchase Requests", desc: "Track the status of PRs you have submitted." };
        }
    };
    const headerContent = getHeaderContent();

    return (
        <SidebarLayout activeModule="PR/PO Module" sidebarLinks={sidebarLinks}>
            <Head title={headerContent.title} />
            <div className="mx-auto max-w-[95%] py-6 relative">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{headerContent.title}</h2>
                        <p className="mt-1 text-sm text-gray-500">{headerContent.desc}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
                    <Link href={route("prpo.approval-board", { view: "my_requests" })} className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${currentView === "my_requests" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"}`}>My Requests</Link>
                    {(canApprove({}) || isUnrestricted || isEVP || isOpsManager || isInvTL) && (
                        <Link href={route("prpo.approval-board", { view: "for_approval" })} className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${currentView === "for_approval" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"}`}>For Approval</Link>
                    )}


                    <Link href={route("prpo.approval-board", { view: "history" })} className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${currentView === "history" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"}`}>Purchase Request History</Link>
                </div>

                <div className="mb-6 bg-white p-5 rounded-xl shadow-sm border border-gray-200 mt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="relative">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Search Request</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                                <input type="text" placeholder="PR ID or Prepared By..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" />
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
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status</label>
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors">
                                <option value="">All Statuses</option>
                                {uniqueStatuses.map((status, idx) => {
                                    let raw = status;
                                    if (raw === 'pending_approval') raw = 'pending_evp_final';
                                    if (raw === 'drafted') raw = 'po_generated';

                                    const statusMap = {
                                        pending_inv_tl: "Pending Approval: Inventory Team Leader",
                                        pending_ops_manager: "PR Generation & Approval: Operations Manager",
                                        pr_generated: "Purchase Request Generated",
                                        pending_procurement: "PR Review & Endorsement: Procurement Assistant",
                                        pending_procurement_tl: "Purchase Order Generation: Procurement TL",
                                        po_generated: "Purchase Order Generated",
                                        pending_evp_final: "Pending EVP Final Approval",
                                        approved: "Purchase Order Approved",
                                        rejected: "REJECTED",
                                        cancelled: "CANCELLED",
                                    };

                                    return <option key={idx} value={status}>{statusMap[raw] || raw.replace(/_/g, ' ').toUpperCase()}</option>;
                                })}
                            </select>
                        </div>
                    </div>
                    {(searchQuery || filterBranch || filterPriority || filterStatus) && (
                        <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
                            <button onClick={() => { setSearchQuery(""); setFilterBranch(""); setFilterPriority(""); setFilterStatus(""); }} className="text-sm text-gray-500 hover:text-gray-800 font-semibold bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-md transition-colors">Clear Filters</button>
                        </div>
                    )}
                </div>

                <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 font-semibold text-gray-900 whitespace-nowrap cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('id')}>
                                    <div className="flex items-center justify-center gap-1">
                                        Purchase Request ID
                                        <SortIcon active={sortConfig.key === 'id'} direction={sortConfig.direction} />
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-center font-semibold text-gray-900 whitespace-nowrap">Prepared By</th>
                                <th className="px-6 py-3 text-center font-semibold text-gray-900 whitespace-nowrap">Branch & Department</th>
                                <th className="px-6 py-3 text-center font-semibold text-gray-900 whitespace-nowrap">Priority</th>
                                <th className="px-6 py-3 font-semibold text-gray-900 whitespace-nowrap cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('date')}>
                                    <div className="flex items-center justify-center gap-1">
                                        Date Needed
                                        <SortIcon active={sortConfig.key === 'date'} direction={sortConfig.direction} />
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-center font-semibold text-gray-900 whitespace-nowrap">Items Count</th>
                                <th className="px-6 py-3 text-center font-semibold text-gray-900 whitespace-nowrap">Status</th>
                                <th className="px-6 py-3 text-center font-semibold text-gray-900 whitespace-nowrap">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {paginatedRequests.length === 0 ? (
                                <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500">No requests found for this view.</td></tr>
                            ) : (
                                paginatedRequests.map((pr) => (
                                    <tr key={pr.id} onClick={() => openModal(pr)} className="hover:bg-gray-50 transition cursor-pointer">
                                        <td className="px-6 py-2 text-center font-medium text-indigo-600 hover:text-indigo-900">{pr.pr_number || `PR-${pr.id}`}</td>
                                        <td className="px-6 py-2 text-center">{pr.user?.name || "Unknown"}</td>
                                        <td className="px-6 py-2 text-center">{pr.branch} <br /><span className="text-xs text-center text-gray-500">{pr.department}</span></td>
                                        <td className="text-center px-6 py-4">
                                            {pr.priority ? (
                                                <span className={`inline-flex items-center rounded-md px-2 py-1 text-center text-xs font-bold ring-1 ring-inset ${pr.priority === "High" ? "bg-red-100 text-red-800 ring-red-500/30" : pr.priority === "Normal" ? "bg-blue-100 text-blue-800 ring-blue-500/30" : "bg-green-100 text-green-800 ring-green-500/30"}`}>{pr.priority}</span>
                                            ) : (<span className="text-gray-400 text-center text-xs italic">N/A</span>)}
                                        </td>
                                        <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">{pr.date_needed ? new Date(pr.date_needed).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "N/A"}</td>
                                        <td className="px-6 py-2 text-center font-medium">{pr.items?.length || 0} Items</td>
                                        <td className="px-6 py-2 text-center">{formatStatus(pr.status)}</td>
                                        <td className="whitespace-nowrap px-6 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => openModal(pr)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100 hover:text-indigo-800 border border-indigo-200">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> View Purchase Request
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center border-t border-gray-200 bg-gray-50 px-6 py-4">
                            <span className="text-sm text-gray-600">Showing <span className="font-bold text-gray-900">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-bold text-gray-900">{Math.min(currentPage * itemsPerPage, filteredRequests.length)}</span> of <span className="font-bold text-gray-900">{filteredRequests.length}</span> entries</span>
                            <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-0">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-sm font-semibold rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">Prev</button>

                                <div className="flex flex-wrap items-center gap-1">
                                    {(totalPages <= 5
                                        ? Array.from({ length: totalPages }, (_, i) => i + 1)
                                        : currentPage <= 3
                                            ? [1, 2, 3, '...', totalPages]
                                            : currentPage >= totalPages - 2
                                                ? [1, '...', totalPages - 2, totalPages - 1, totalPages]
                                                : [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
                                    ).map((page, index) => {
                                        if (page === '...') {
                                            return <span key={`ellipsis-${index}`} className="px-2 text-gray-400">...</span>;
                                        }
                                        return (
                                            <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1.5 text-sm font-semibold rounded-md border ${currentPage === page ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 transition-colors'}`}>
                                                {page}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 text-sm font-semibold rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">Next</button>

                                <div className="flex items-center gap-2 border-l border-gray-300 pl-2 sm:pl-4 ml-1 sm:ml-2">
                                    <span className="text-sm font-medium text-gray-600 hidden sm:block">Go to:</span>
                                    <input
                                        key={currentPage}
                                        type="number"
                                        min="1"
                                        max={totalPages}
                                        defaultValue={currentPage}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = parseInt(e.target.value);
                                                if (val >= 1 && val <= totalPages) setCurrentPage(val);
                                            }
                                        }}
                                        className="w-14 rounded-md border-gray-300 py-1.5 text-sm text-center shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            const val = parseInt(e.currentTarget.previousElementSibling.value);
                                            if (val >= 1 && val <= totalPages) setCurrentPage(val);
                                        }}
                                        className="px-3 py-1.5 text-sm font-semibold rounded-md border border-gray-300 text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors shadow-sm"
                                    >
                                        Go
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {isModalOpen && selectedPR && (
                    <div onClick={closeModal} className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-gray-900 bg-opacity-60 backdrop-blur-sm p-4 sm:p-6">
                        <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-6xl rounded-2xl bg-white shadow-2xl transition-all flex flex-col max-h-[90vh]">
                            <div className="flex items-center justify-between border-b px-6 py-2 shrink-0">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{selectedPR.pr_number}</h3>
                                    <p className="text-sm text-gray-500">Prepared by {selectedPR.user?.name} on {selectedPR.date_prepared}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {['pr_generated', 'pending_procurement', 'pending_procurement_tl', 'po_generated', 'pending_evp_final', 'approved'].includes(selectedPR.status) && (
                                        <a href={route('prpo.purchase-requests.print', selectedPR.id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-800 border border-blue-200">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> View PR PDF
                                        </a>
                                    )}
                                    <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                                </div>
                            </div>

                            <div className="overflow-y-auto px-6 py-2 flex-grow">
                                <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 rounded-lg bg-gray-50 p-4 text-sm border border-gray-100">
                                    <div>
                                        <span className="block font-semibold text-gray-900">Carbon Copy (CC)</span>
                                        {(() => {
                                            let ccArray = [];
                                            try {
                                                const raw = selectedPR.cc_users;
                                                if (Array.isArray(raw)) ccArray = raw;
                                                else if (typeof raw === 'string') {
                                                    const parsed = JSON.parse(raw);
                                                    ccArray = Array.isArray(parsed) ? parsed : (typeof parsed === 'string' ? JSON.parse(parsed) : []);
                                                }
                                            } catch(e) { ccArray = []; }

                                            if (!Array.isArray(ccArray)) ccArray = [];
                                            const names = ccArray.map(id => employees?.find(e => String(e.id) === String(id))?.name).filter(Boolean);
                                            return names.length > 0 ? names.join(', ') : "N/A";
                                        })()}
                                    </div>
                                    <div><span className="block font-semibold text-gray-900">Branch</span> {selectedPR.branch}</div>
                                    <div><span className="block font-semibold text-gray-900">Department</span> {selectedPR.department}</div>
                                    <div><span className="block font-semibold text-gray-900">Request Type</span> {selectedPR.request_type || "N/A"}</div>
                                    <div><span className="block font-semibold text-gray-900">Priority</span> {selectedPR.priority || "N/A"}</div>
                                    <div><span className="block font-semibold text-gray-900">Date Needed</span> <span className="text-red-600 font-bold">{selectedPR.date_needed}</span></div>
                                    <div><span className="block font-semibold text-gray-900">Budget Status</span> {selectedPR.budget_status || "N/A"}</div>
                                    <div><span className="block font-semibold text-gray-900">Status</span> {formatStatus(selectedPR.status)}</div>
                                    {selectedPR.purpose_of_request && (
                                        <div className="col-span-2 sm:col-span-4 mt-2">
                                            <span className="block font-semibold text-gray-900">Purpose of Request</span>
                                            <p className="text-gray-600 break-words break-all whitespace-pre-wrap">{selectedPR.purpose_of_request}</p>
                                        </div>
                                    )}
                                </div>

                                {selectedPR.status === "rejected" && selectedPR.rejection_reason && (
                                    <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-100">
                                        <span className="block font-bold text-red-800 text-sm mb-1">Reason for Rejection:</span>
                                        <p className="text-red-700 text-sm whitespace-pre-wrap">{selectedPR.rejection_reason}</p>
                                    </div>
                                )}
                                {selectedPR.status === "pending_inv_tl" && selectedPR.rejection_reason && (
                                    <div className="mb-6 rounded-lg bg-orange-50 p-4 border border-orange-200">
                                        <span className="font-bold text-orange-800 text-sm mb-1 flex items-center gap-1.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                            Returned by Operations Manager
                                        </span>
                                        <p className="text-orange-700 text-sm whitespace-pre-wrap font-medium">"{selectedPR.rejection_reason}"</p>
                                        <p className="text-orange-600 text-xs mt-2 italic">Please edit the request below then submit when ready.</p>
                                    </div>
                                )}

                                <h4 className="mb-2 font-bold text-gray-900 border-b pb-1">Requested Items</h4>
                                <div className="overflow-x-auto rounded-lg border mb-6">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm text-left table-fixed">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="px-4 py-2 font-semibold w-1/4">Product Name</th>
                                                <th className="px-4 py-2 font-semibold w-1/4">Supplier Name</th>
                                                <th className="px-4 py-2 font-semibold w-1/5">Description</th>
                                                <th className="px-4 py-2 font-semibold text-center w-20">Quantity</th>
                                                <th className="px-4 py-2 font-semibold text-center w-20">Unit</th>
                                                <th className="px-4 py-2 font-semibold text-right w-24">Estimated Cost</th>
                                                <th className="px-4 py-2 font-semibold text-right w-24">Total Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {selectedPR.items.map((item, idx) => (
                                                <tr key={item.id || idx}>
                                                    <td className="px-4 py-3 font-medium text-gray-900 truncate" title={item.product?.name}>{item.product?.name}</td>
                                                    <td className="px-4 py-3 text-gray-500 truncate">{item.supplier?.name || "-"}</td>
                                                    <td className="px-4 py-3 text-gray-500 max-w-xs break-words">{item.specifications || "-"}</td>
                                                    <td className="px-4 py-3 text-center font-bold">{parseFloat(item.qty_requested)}</td>
                                                    <td className="px-4 py-3 text-center text-gray-500">{item.unit || "-"}</td>
                                                    <td className="px-4 py-3 text-right">₱{Number(item.est_unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-indigo-700">₱{Number(item.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-4 sm:px-12">
                                    <TrackingStepper currentStatus={selectedPR.status} type="PR" branch={selectedPR.branch} pr={selectedPR} />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 rounded-b-xl border-t bg-gray-50 px-6 py-4 shrink-0">
    <button onClick={closeModal} className="text-sm font-semibold text-gray-700 hover:text-gray-900 px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-100 flex items-center justify-center gap-1.5">
        Close Window
    </button>

    {canEditPR(selectedPR) && (
        <button onClick={openEditModal} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors">
            {/* Pencil Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
            </svg>
            Edit Request
        </button>
    )}

    {canApprove(selectedPR) && (canUserBypassViewMode(auth, "purchase_requests") || currentView === "for_approval") && (
        <>
            {selectedPR.status === "pending_ops_manager" && (
                <button onClick={() => openActionModal(selectedPR.id, !selectedPR.reviewed_by_id ? "return_to_creator" : "return_to_inv_tl")} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-400 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                    </svg>
                    {!selectedPR.reviewed_by_id ? "Return to Inv Assistant" : "Return to Inv TL"}
                </button>
            )}
            <button onClick={() => handleAction(selectedPR.id, "reject")} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 transition-colors">
                {/* Cross/X Icon */}
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject Request
            </button>

            {selectedPR.status === "pending_inv_tl" && (
                <button onClick={() => handleAction(selectedPR.id, "approve")} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 transition-colors">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Approve Request
                </button>
            )}

            {selectedPR.status === "pending_ops_manager" && (
                <button
                    onClick={() => handleAction(selectedPR.id, isEVP ? "generate_pr_as_om_fallback" : "generate_pr")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
                >
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    Generate PR
                </button>
            )}
            {selectedPR.status === "pr_generated" && (
                <button onClick={() => handleAction(selectedPR.id, "review_pr")} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-500 transition-colors">
                    {/* Eye/Review Icon */}
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View PDF & Start Review
                </button>
            )}

            {selectedPR.status === "pending_procurement" && (
                <button onClick={() => handleAction(selectedPR.id, "endorse")} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-500 transition-colors">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Endorse to Proc TL
                </button>
            )}
        </>
    )}
</div>
                        </div>
                    </div>
                )}

                {isEditModalOpen && selectedPR && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-gray-900 bg-opacity-70 p-4 sm:p-0">
                        <div className="relative w-full max-w-6xl rounded-2xl bg-white shadow-2xl transition-all flex flex-col max-h-[90vh]">
                            <div className="flex items-center justify-between border-b px-6 py-2 shrink-0 bg-blue-50 rounded-t-2xl">
                                <div>
                                    <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
                                        Edit Purchase Request: {selectedPR.pr_number}
                                    </h3>
                                    <p className="text-sm text-blue-700 mt-1">Make necessary adjustments before approving.</p>
                                </div>
                                <button onClick={() => setIsEditModalOpen(false)} className="text-blue-400 hover:text-blue-600"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                            <form onSubmit={handleSaveEdit} className="overflow-y-auto flex-grow flex flex-col">
                                <div className="px-6 py-6 flex-grow">
                                    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3 mb-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Branch <span className="text-red-500">*</span></label>
                                            <select value={editData.branch} onChange={e => setEditData('branch', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" required>
                                                <option value="" disabled>Select Branch...</option>
                                                {(typeof availableBranches !== 'undefined' ? availableBranches : []).map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-red-500">*</span></label>
                                            <select value={editData.department} onChange={e => setEditData('department', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" required>
                                                <option value="" disabled>Select Department...</option>
                                                {(typeof departments !== 'undefined' ? departments : []).map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Date Prepared</label>
                                            <input type="date" value={editData.date_prepared || ''} className="block w-full rounded-md border-gray-300 bg-gray-50 text-gray-500 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm cursor-not-allowed" readOnly />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Request Type</label>
                                            <select value={editData.request_type} onChange={e => setEditData('request_type', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                                                <option value="">Select Type...</option>
                                                <option value="Capital Expenditure">Capital Expenditure</option>
                                                <option value="Operating Expenditure">Operating Expenditure</option>
                                                <option value="Inventory">Inventory</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Priority <span className="text-red-500">*</span></label>
                                            <select value={editData.priority} onChange={e => setEditData('priority', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" required>
                                                <option value="" disabled>Select Priority...</option>
                                                <option value="Low">Low</option>
                                                <option value="Normal">Normal</option>
                                                <option value="High">High</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Date Needed <span className="text-red-500">*</span></label>
                                            <input type="date" value={editData.date_needed} onChange={e => setEditData('date_needed', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" required />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Budget Status</label>
                                            <select value={editData.budget_status} onChange={e => setEditData('budget_status', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                                                <option value="">Select Status...</option>
                                                <option value="Budgeted">Budgeted</option>
                                                <option value="Unbudgeted">Unbudgeted</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Budget Reference</label>
                                            <input type="text" value={editData.budget_ref} onChange={e => setEditData('budget_ref', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="Enter Ref..." />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Carbon Copy</label>
                                            <CCMultiSelect
    options={typeof branchEmployees !== 'undefined' ? branchEmployees : []}
    value={editData.cc_users}
    onChange={(val) => setEditData('cc_users', val)}
    placeholder={!editData.branch ? "Select branch first..." : "Search employees..."}
/>
                                        </div>


                                        <div className="sm:col-span-3">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Purpose of Request</label>
                                            <textarea rows={2} value={editData.purpose_of_request} onChange={e => setEditData('purpose_of_request', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                                        </div>
                                        <div className="sm:col-span-3">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Impact if Not Procured</label>
                                            <textarea rows={2} value={editData.impact_if_not_procured} onChange={e => setEditData('impact_if_not_procured', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                                        <h4 className="font-bold text-gray-900">Items</h4>
                                        <button type="button" onClick={addEditItemRow} className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded transition shadow-sm">Add Item</button>
                                    </div>

                                    <div className="overflow-x-auto rounded-lg border border-gray-200 pb-24">
                                        <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 font-semibold">Product Name</th>
                                                    <th className="px-3 py-2 font-semibold">Description</th>
                                                    <th className="px-3 py-2 font-semibold text-center w-20">Qty Req.</th>
                                                    <th className="px-3 py-2 font-semibold text-center w-20">Stock</th>
                                                    <th className="px-3 py-2 font-semibold text-center w-20">Reorder</th>
                                                    <th className="px-3 py-2 font-semibold">Supplier</th>
                                                    <th className="px-3 py-2 font-semibold text-right w-24">Est. Cost</th>
                                                    <th className="px-3 py-2 font-semibold text-right w-28">Total</th>
                                                    <th className="px-3 py-2 font-semibold text-center w-12"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 bg-white">
                                                {editData.items.map((item, idx) => {
                                                    const availableProducts = item.supplier_id ? (typeof products !== 'undefined' ? products : []).filter(p => String(p.supplier_id) === String(item.supplier_id)) : (typeof products !== 'undefined' ? products : []);
                                                    const availableSuppliers = item.product_id ? (typeof suppliers !== 'undefined' ? suppliers : []).filter(s => {
                                                        const linkedProduct = (typeof products !== 'undefined' ? products : []).find(p => String(p.id) === String(item.product_id));
                                                        return linkedProduct && String(linkedProduct.supplier_id) === String(s.id);
                                                    }) : (typeof suppliers !== 'undefined' ? suppliers : []);

                                                    return (
                                                        <tr key={idx} className="hover:bg-gray-50">
                                                            <td className="px-2 py-2 min-w-[200px]">
                                                                <SearchableDropdown options={availableProducts} value={item.product_id} onChange={(val) => handleEditItemChange(idx, 'product_id', val)} placeholder="Search Product..." />
                                                            </td>
                                                            <td className="px-2 py-2 min-w-[150px]">
                                                                <input type="text" value={item.specifications || ''} onChange={(e) => handleEditItemChange(idx, 'specifications', e.target.value)} className="block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                                                            </td>
                                                            <td className="px-2 py-2 min-w-[70px]">
                                                                <input type="number" min="1" value={item.qty_requested || ''} onChange={(e) => handleEditItemChange(idx, 'qty_requested', e.target.value)} className="block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-center" />
                                                            </td>
                                                            <td className="px-2 py-2 min-w-[70px]">
                                                                <input type="number" min="0" value={item.qty_on_hand || ''} onChange={(e) => handleEditItemChange(idx, 'qty_on_hand', e.target.value)} className="block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-center" />
                                                            </td>
                                                            <td className="px-2 py-2 min-w-[70px]">
                                                                <input type="number" min="0" value={item.reorder_level || ''} onChange={(e) => handleEditItemChange(idx, 'reorder_level', e.target.value)} className="block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-center" />
                                                            </td>
                                                            <td className="px-2 py-2 min-w-[200px]">
                                                                <SearchableDropdown options={availableSuppliers} value={item.supplier_id} onChange={(val) => handleEditItemChange(idx, 'supplier_id', val)} placeholder="Search Supplier..." />
                                                            </td>
                                                            <td className="px-2 py-2 min-w-[100px]">
                                                                <input type="number" step="0.01" value={item.est_unit_cost ?? ''} onChange={(e) => handleEditItemChange(idx, 'est_unit_cost', e.target.value)} className="block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-right" />
                                                            </td>
                                                            <td className="px-2 py-2 text-right font-bold text-indigo-700 min-w-[100px] whitespace-nowrap">
                                                                ₱{Number(item.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="px-2 py-2 text-center">
                                                                {editData.items.length > 1 && (
                                                                    <button type="button" onClick={() => removeEditItemRow(idx)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="px-6 py-2 bg-gray-50 border-t flex justify-end gap-3 shrink-0 rounded-b-2xl">
                                    <button type="button" onClick={() => setIsEditModalOpen(false)} className="bg-white border border-gray-300 px-4 py-2 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-100 shadow-sm transition">Cancel Edit</button>
                                    <button type="submit" disabled={isEditing} className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-bold shadow-sm hover:bg-blue-500 transition disabled:opacity-50">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {actionModal.isOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                            <div className={`px-6 py-2 border-b border-gray-200 ${actionModal.actionType === "reject" ? "bg-red-50" : "bg-orange-50"}`}>
                                <h3 className={`text-lg font-bold ${actionModal.actionType === "reject" ? "text-red-900" : "text-orange-900"}`}>
                                    {actionModal.actionType === "reject" ? "Reject Purchase Request" : actionModal.actionType === "return_to_creator" ? "Return Request to Inventory Assistant" : "Return Request to Inventory TL"}
                                </h3>
                            </div>
                            <div className="p-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {actionModal.actionType === "reject" ? "Please provide a reason for rejection:" : actionModal.actionType === "return_to_creator" ? "Please provide notes/corrections for the Inventory Assistant:" : "Please provide notes/corrections for the Inventory TL:"}
                                </label>
                                <textarea className={`w-full border-gray-300 rounded-md shadow-sm sm:text-sm ${actionModal.actionType === "reject" ? "focus:ring-red-500 focus:border-red-500" : "focus:ring-orange-500 focus:border-orange-500"}`} rows="4" value={actionModal.reason} onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })} placeholder={actionModal.actionType === "reject" ? "Explain why this request is being rejected..." : "Explain what needs to be fixed..."} autoFocus></textarea>
                            </div>
                            <div className="px-6 py-2 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                                <button onClick={closeActionModal} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100">Cancel</button>
                                <button onClick={submitActionModal} className={`px-6 py-2 text-sm font-bold text-white rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${actionModal.actionType === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-orange-500 hover:bg-orange-600"}`} disabled={!actionModal.reason.trim()}>
                                    {actionModal.actionType === "reject" ? "Submit Rejection" : "Confirm Return"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
            <ConfirmModal show={confirmDialog.isOpen} onClose={closeConfirmModal} title={confirmDialog.title} message={confirmDialog.message} confirmText={confirmDialog.confirmText} confirmColor={confirmDialog.confirmColor} onConfirm={confirmDialog.onConfirm} />
        </SidebarLayout>
    );
}
