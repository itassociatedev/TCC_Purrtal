import Modal from '@/Components/Modal';
import { getAdminLinks, canEditModule, canDeleteModule, canViewModule } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';

export default function OrgChartAdmin({ auth, members, orgChartSvg = null, structure }) {
    const adminLinks = getAdminLinks(auth);
    const canManageOrgChart = canEditModule(auth, 'org_chart');
    const canDeleteOrgChart = canDeleteModule(auth, 'org_chart');
    const canViewOrgChart = canViewModule(auth, 'org_chart');
    
    // Core Member & UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [localMembers, setLocalMembers] = useState([]);
    const [openSections, setOpenSections] = useState({});
    const [previewUrl, setPreviewUrl] = useState(null);

    // Dynamic Branch, Position & Settings States from JSON
    const [dynamicBranches, setDynamicBranches] = useState(structure?.branches || []);
    const [dynamicPositions, setDynamicPositions] = useState(structure?.positions || {});
    const [branchSettings, setBranchSettings] = useState(structure?.branchSettings || {}); // Per-branch display settings
    
    // Manager Modals State
    const [isBranchManagerOpen, setIsBranchManagerOpen] = useState(false);
    const [isPositionManagerOpen, setIsPositionManagerOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');

    // Member Drag and Drop States
    const [draggedId, setDraggedId] = useState(null);
    const [dragOverId, setDragOverId] = useState(null);
    const [dropPosition, setDropPosition] = useState(null); // 'before', 'after', or 'swap'

    // Branch Drag and Drop States
    const [draggedBranch, setDraggedBranch] = useState(null);
    const [dragOverBranch, setDragOverBranch] = useState(null);
    const [branchDropPosition, setBranchDropPosition] = useState(null); // 'before', 'after', or 'swap'

    // 3-Dot Menu Dropdown State
    const [activeDropdown, setActiveDropdown] = useState(null);

    useEffect(() => {
        setLocalMembers(members || []);
    }, [members]);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const {
        data, setData, post, put, processing, errors, reset, clearErrors,
    } = useForm({
        name: '', position: '', branch: dynamicBranches[0] || '', image: null,
    });

    const {
        data: orgChartData, setData: setOrgChartData, post: postOrgChart, processing: orgChartProcessing, errors: orgChartErrors, reset: resetOrgChart, clearErrors: clearOrgChartErrors,
    } = useForm({
        org_chart_file: null,
    });

    const selectedBranchPositions = dynamicPositions[data.branch] || [];

    useEffect(() => {
        if (data.position && !selectedBranchPositions.includes(data.position)) {
            setData('position', '');
        }
    }, [data.branch]);

    // Database Sync Helper
    const saveStructureToBackend = (newBranches, newPositions, newBranchSettings) => {
        router.post(route('admin.org-chart.structure.save'), {
            branches: newBranches,
            positions: newPositions,
            branchSettings: newBranchSettings !== undefined ? newBranchSettings : branchSettings
        }, { preserveScroll: true });
    };

    // Handler to immediately update view mode and save to database
    const handleUpdateBranchViewMode = (branch, mode) => {
        const newSettings = { ...branchSettings, [branch]: mode };
        setBranchSettings(newSettings);
        saveStructureToBackend(dynamicBranches, dynamicPositions, newSettings);
    };

    // ==========================================
    // SORTING & GROUPING
    // ==========================================
    const sortMembersByBranchHierarchy = (branchName, membersInBranch) => {
        return [...membersInBranch].sort((a, b) => {
            const orderA = a.sort_order ?? 9999;
            const orderB = b.sort_order ?? 9999;
            
            if (orderA !== orderB) return orderA - orderB;
            
            const positionOrder = dynamicPositions[branchName] || [];
            const orderMap = new Map(positionOrder.map((position, index) => [position, index]));
            
            const aIndex = orderMap.has(a.position) ? orderMap.get(a.position) : 999;
            const bIndex = orderMap.has(b.position) ? orderMap.get(b.position) : 999;
            
            if (aIndex !== bIndex) return aIndex - bIndex;

            return a.name.localeCompare(b.name);
        });
    };

    // ==========================================
    // BRANCH DRAG AND DROP HANDLERS
    // ==========================================
    const handleBranchDragStart = (e, branchName) => {
        setDraggedBranch(branchName);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/branch', branchName);
    };

    const handleBranchDragOver = (e, branchName) => {
        e.preventDefault();
        e.stopPropagation(); 
        if (!draggedBranch) return; 

        e.dataTransfer.dropEffect = 'move';
        
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top; 
        const height = rect.height;
        
        let position = 'swap'; 
        
        if (y < height * 0.3) {
            position = 'before';
        } else if (y > height * 0.7) {
            position = 'after';
        }

        if (dragOverBranch !== branchName) setDragOverBranch(branchName);
        if (branchDropPosition !== position) setBranchDropPosition(position);
    };

    const handleBranchDragLeave = (e) => {
        e.preventDefault();
        setDragOverBranch(null);
        setBranchDropPosition(null);
    };

    const handleBranchDrop = (e, targetBranchName) => {
        e.preventDefault();
        e.stopPropagation();
        
        const finalPosition = branchDropPosition;
        setDragOverBranch(null);
        setBranchDropPosition(null);

        if (!draggedBranch || draggedBranch === targetBranchName) {
            setDraggedBranch(null);
            return;
        }

        const newBranches = [...dynamicBranches];
        const draggedIndex = newBranches.indexOf(draggedBranch);
        const targetIndex = newBranches.indexOf(targetBranchName);

        if (draggedIndex === -1 || targetIndex === -1) {
            setDraggedBranch(null);
            return;
        }

        if (finalPosition === 'swap') {
            const temp = newBranches[draggedIndex];
            newBranches[draggedIndex] = newBranches[targetIndex];
            newBranches[targetIndex] = temp;
        } else {
            newBranches.splice(draggedIndex, 1);
            let actualTargetIndex = targetIndex;
            if (draggedIndex < targetIndex) {
                actualTargetIndex -= 1;
            }
            
            const insertIndex = finalPosition === 'after' ? actualTargetIndex + 1 : actualTargetIndex;
            newBranches.splice(insertIndex, 0, draggedBranch);
        }

        setDynamicBranches(newBranches);
        setDraggedBranch(null);
        
        saveStructureToBackend(newBranches, dynamicPositions);
    };

    const handleBranchDragEnd = () => {
        setDraggedBranch(null);
        setDragOverBranch(null);
        setBranchDropPosition(null);
    };

    // ==========================================
    // MEMBER DRAG AND DROP HANDLERS 
    // ==========================================
    const handleDragStart = (e, id) => {
        e.stopPropagation(); 
        if (activeDropdown) {
            e.preventDefault();
            return;
        }
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id); 
    };

    const handleDragOver = (e, id) => {
        e.preventDefault(); 
        e.stopPropagation(); 
        if (!draggedId) return; 

        e.dataTransfer.dropEffect = 'move';
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left; 
        const width = rect.width;
        
        let position = 'swap';
        
        if (x < width * 0.3) {
            position = 'before';
        } else if (x > width * 0.7) {
            position = 'after';
        }

        if (dragOverId !== id) setDragOverId(id);
        if (dropPosition !== position) setDropPosition(position);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setDragOverId(null);
        setDropPosition(null);
    };

    const handleDrop = (e, targetId, branchName) => {
        e.preventDefault();
        e.stopPropagation();

        const finalPosition = dropPosition;
        setDragOverId(null);
        setDropPosition(null);

        if (!draggedId || draggedId === targetId) {
            setDraggedId(null);
            return;
        }

        const branchMembers = sortMembersByBranchHierarchy(branchName, localMembers.filter(m => m.branch === branchName));
        
        const draggedIndex = branchMembers.findIndex(m => m.id === draggedId);
        const targetIndex = branchMembers.findIndex(m => m.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) {
            setDraggedId(null);
            return;
        }

        if (finalPosition === 'swap') {
            const temp = branchMembers[draggedIndex];
            branchMembers[draggedIndex] = branchMembers[targetIndex];
            branchMembers[targetIndex] = temp;
        } else {
            const [draggedMember] = branchMembers.splice(draggedIndex, 1);
            let actualTargetIndex = targetIndex;
            if (draggedIndex < targetIndex) actualTargetIndex -= 1;
            
            const insertIndex = finalPosition === 'after' ? actualTargetIndex + 1 : actualTargetIndex;
            branchMembers.splice(insertIndex, 0, draggedMember);
        }

        const otherMembers = localMembers.filter(m => m.branch !== branchName);
        const newMasterList = [...branchMembers, ...otherMembers];
        const updatedMembers = newMasterList.map((m, i) => ({ ...m, sort_order: i }));

        setLocalMembers(updatedMembers);
        setDraggedId(null);

        const orderedIds = updatedMembers.map(m => m.id);
        router.post(route('admin.org-chart.reorder'), { orderedIds }, { preserveScroll: true });
    };

    const handleDragEnd = () => {
        setDraggedId(null);
        setDragOverId(null);
        setDropPosition(null);
    };


    // ==========================================
    // BRANCH CRUD FUNCTIONS
    // ==========================================
    const addBranch = () => {
        const name = newItemName.trim();
        if (!name || dynamicBranches.includes(name)) return;
        
        const newBranches = [...dynamicBranches, name];
        const newPositions = { ...dynamicPositions, [name]: [] };

        setDynamicBranches(newBranches);
        setDynamicPositions(newPositions);
        setNewItemName('');
        saveStructureToBackend(newBranches, newPositions, branchSettings);
    };

    const updateBranch = (oldName) => {
        const newName = prompt("Enter new branch/department name:", oldName);
        if (!newName || newName.trim() === '' || newName === oldName) return;
        
        const trimmedNewName = newName.trim();
        const newBranches = dynamicBranches.map(b => b === oldName ? trimmedNewName : b);
        
        const newPositions = { ...dynamicPositions };
        newPositions[trimmedNewName] = newPositions[oldName];
        delete newPositions[oldName];

        const newSettings = { ...branchSettings };
        if (newSettings[oldName]) {
            newSettings[trimmedNewName] = newSettings[oldName];
            delete newSettings[oldName];
        }

        setDynamicBranches(newBranches);
        setDynamicPositions(newPositions);
        setBranchSettings(newSettings);
        setLocalMembers(prev => prev.map(member => 
            member.branch === oldName ? { ...member, branch: trimmedNewName } : member
        ));

        saveStructureToBackend(newBranches, newPositions, newSettings);
    };

    const deleteBranch = (branch) => {
        if (!confirm(`Are you sure you want to delete ${branch}? Members in this branch will also be hidden.`)) return;
        
        const newBranches = dynamicBranches.filter(b => b !== branch);
        const newPositions = { ...dynamicPositions };
        delete newPositions[branch];

        const newSettings = { ...branchSettings };
        delete newSettings[branch];

        setDynamicBranches(newBranches);
        setDynamicPositions(newPositions);
        setBranchSettings(newSettings);
        setLocalMembers(prev => prev.filter(member => member.branch !== branch));

        saveStructureToBackend(newBranches, newPositions, newSettings);
    };

    // ==========================================
    // POSITION CRUD FUNCTIONS
    // ==========================================
    const addPosition = (branch) => {
        const name = newItemName.trim();
        if (!name || !branch) return;
        
        const newPositions = { ...dynamicPositions };
        const branchPos = newPositions[branch] || [];
        
        if (!branchPos.includes(name)) {
            newPositions[branch] = [...branchPos, name];
            setDynamicPositions(newPositions);
            setNewItemName('');
            saveStructureToBackend(dynamicBranches, newPositions);
        }
    };

    const updatePosition = (branch, oldPos) => {
        const newPos = prompt("Enter new position title:", oldPos);
        if (!newPos || newPos.trim() === '' || newPos === oldPos) return;
        
        const newPositions = {
            ...dynamicPositions,
            [branch]: dynamicPositions[branch].map(p => p === oldPos ? newPos.trim() : p)
        };
        
        setDynamicPositions(newPositions);
        saveStructureToBackend(dynamicBranches, newPositions);
    };

    const deletePosition = (branch, position) => {
        if (!confirm(`Are you sure you want to delete ${position}?`)) return;
        
        const newPositions = {
            ...dynamicPositions,
            [branch]: dynamicPositions[branch].filter(p => p !== position)
        };

        setDynamicPositions(newPositions);
        saveStructureToBackend(dynamicBranches, newPositions);
    };


    // ==========================================
    // MEMBER FUNCTIONS
    // ==========================================
    const toggleSection = (sectionName) => {
        setOpenSections((prev) => ({ ...prev, [sectionName]: !prev[sectionName] }));
    };

    const openModal = (member = null) => {
        clearErrors();
        if (member && member.id) {
            setEditingMember(member);
            setData({
                name: member.name || '',
                position: member.position || '',
                branch: member.branch || dynamicBranches[0] || '',
                image: null,
            });
        } else {
            setEditingMember(null);
            setData({
                name: '',
                position: '',
                branch: dynamicBranches[0] || '', 
                image: null,
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setTimeout(() => {
            setEditingMember(null);
            reset();
            clearErrors();
        }, 300);
    };

    const submit = (e) => {
        e.preventDefault();
        if (editingMember) {
            put(route('admin.org-chart.update', editingMember.id), { forceFormData: true, onSuccess: () => closeModal() });
        } else {
            post(route('admin.org-chart.store'), { forceFormData: true, onSuccess: () => closeModal() });
        }
    };

    const submitOrgChartSvg = (e) => {
        e.preventDefault();
        if (!orgChartData.org_chart_file) return;
        postOrgChart(route('admin.org-chart.asset.store'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                resetOrgChart();
                clearOrgChartErrors();
                setPreviewUrl(null); 
            },
        });
    };

    const deleteMemberAction = (id) => {
        if (confirm('Are you sure you want to remove this member? This action cannot be undone.')) {
            router.delete(route('admin.org-chart.destroy', id), { preserveScroll: true, onSuccess: () => closeModal() });
        }
    };


    // Execute Final Grouping
    const groupedMembers = dynamicBranches.reduce((acc, branch) => {
        const peopleInThisBranch = localMembers.filter((m) => m.branch === branch);
        acc[branch] = sortMembersByBranchHierarchy(branch, peopleInThisBranch);
        return acc;
    }, {});

    const otherMembers = localMembers.filter((m) => !dynamicBranches.includes(m.branch));
    if (otherMembers.length > 0) {
        groupedMembers['Other Staff'] = otherMembers;
    }

    const normalizedOrgChartSvg =
        orgChartSvg && orgChartSvg.startsWith('/') ? orgChartSvg : orgChartSvg ? `/${orgChartSvg}` : null;
    const displaySvg = previewUrl || normalizedOrgChartSvg;


    return (
        <SidebarLayout
            activeModule="Admin"
            sidebarLinks={adminLinks}
            header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Employee Directory Management</h2>}
        >
            <Head title="Manage Directory" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    
                    {/* ORG CHART SVG MANAGEMENT */}
                    <div className="mb-8 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                        <div className="flex flex-col gap-4 border-b border-gray-100 p-6 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Organization Chart SVG</h3>
                                <p className="mt-1 text-sm text-gray-500">Upload one SVG file only. Uploading a new file will replace the current org chart.</p>
                                <p className="mt-1 text-xs text-gray-400">Allowed file type: .svg only</p>
                            </div>

                            {normalizedOrgChartSvg && (
                                <a href={normalizedOrgChartSvg} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                                    View Current Saved SVG
                                </a>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
                            <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                                <div className="border-b border-gray-200 px-4 py-3">
                                    <h4 className="text-sm font-bold uppercase tracking-wide text-gray-700">
                                        {previewUrl ? 'Preview of Selected File' : 'Current Org Chart Preview'}
                                    </h4>
                                </div>

                                <div className="flex min-h-[280px] items-center justify-center p-4">
                                    {displaySvg ? (
                                        <img src={displaySvg} alt="Organizational Chart Preview" className="max-h-[420px] w-full object-contain" />
                                    ) : (
                                        <div className="text-center">
                                            <p className="text-base font-medium text-gray-700">No org chart uploaded yet.</p>
                                            <p className="mt-1 text-sm text-gray-500">Upload your first SVG file to show it here.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl border border-gray-200 bg-white p-5">
                                <form onSubmit={submitOrgChartSvg} className="space-y-4">
                                    <div>
                                        <label className="mb-1 block text-sm font-bold text-gray-700">
                                            {normalizedOrgChartSvg ? 'Replace SVG File' : 'Upload SVG File'}
                                        </label>
                                        <input
                                            type="file"
                                            accept=".svg,image/svg+xml"
                                            disabled={!canManageOrgChart}
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                setOrgChartData('org_chart_file', file || null);
                                                if (file) { setPreviewUrl(URL.createObjectURL(file)); } 
                                                else { setPreviewUrl(null); }
                                            }}
                                            className={`block w-full text-sm ${canManageOrgChart ? 'text-gray-500 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100' : 'text-gray-300 file:bg-gray-200 file:text-gray-400 cursor-not-allowed'} file:mr-4 file:rounded-md file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold transition-colors`}
                                            title={!canManageOrgChart ? 'Edit permission required' : ''}
                                        />
                                        {orgChartErrors.org_chart_file && <p className="mt-1 text-xs text-red-500">{orgChartErrors.org_chart_file}</p>}
                                        <p className="mt-2 text-xs text-gray-500">
                                            The file will be stored in <span className="font-semibold">public/storage/org_chart</span>.
                                        </p>
                                    </div>

                                    {orgChartData.org_chart_file && (
                                        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-gray-700">
                                            <span className="font-semibold">Selected file:</span> {orgChartData.org_chart_file.name}
                                        </div>
                                    )}

                                    <div className="flex justify-end">
                                        <button
                                            type="submit"
                                            disabled={orgChartProcessing || !orgChartData.org_chart_file || !canManageOrgChart}
                                            title={!canManageOrgChart ? 'Edit permission required' : ''}
                                            className={`rounded-lg px-4 py-2 text-sm font-bold text-white shadow transition-colors ${canManageOrgChart ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-gray-300 cursor-not-allowed'} disabled:opacity-50`}
                                        >
                                            {orgChartProcessing ? 'Uploading...' : normalizedOrgChartSvg ? 'Replace Org Chart' : 'Upload Org Chart'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* DIRECTORY */}
                    <div className="mb-10 flex flex-col items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:flex-row">
                        <div>
                            <h3 className="mb-1 text-xl font-bold text-gray-900">The Cat Clinic People Directory</h3>
                            <p className="text-sm text-gray-500">Add members, assign departments, and manage them. <strong className="text-indigo-600 font-bold">Drag and Drop</strong> cards and departments to permanently reorder their visual sequence.</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={!canManageOrgChart}
                                onClick={() => canManageOrgChart && setIsBranchManagerOpen(true)}
                                title={!canManageOrgChart ? 'Edit permission required' : ''}
                                className={`flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-bold shadow-sm transition-colors ${canManageOrgChart ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50' : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                            >
                                + Add Branch
                            </button>
                            <button
                                type="button"
                                disabled={!canManageOrgChart}
                                onClick={() => canManageOrgChart && openModal()}
                                title={!canManageOrgChart ? 'Edit permission required' : ''}
                                className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold shadow transition-colors ${canManageOrgChart ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                            >
                                + Add Member
                            </button>
                        </div>
                    </div>

                    <div className="space-y-5">
                        {Object.keys(groupedMembers).map((branchName) => {
                            const membersInBranch = groupedMembers[branchName];
                            const isOpen = !!openSections[branchName];
                            const isDraggableBranch = branchName !== 'Other Staff' && canManageOrgChart;
                            const currentMode = branchSettings[branchName] || 'carousel';

                            return (
                                <div 
                                    key={branchName} 
                                    draggable={isDraggableBranch}
                                    onDragStart={(e) => isDraggableBranch && handleBranchDragStart(e, branchName)}
                                    onDragOver={(e) => isDraggableBranch && handleBranchDragOver(e, branchName)}
                                    onDragLeave={handleBranchDragLeave}
                                    onDrop={(e) => isDraggableBranch && handleBranchDrop(e, branchName)}
                                    onDragEnd={handleBranchDragEnd}
                                    className={`overflow-hidden rounded-2xl bg-white shadow-sm transition-all
                                        ${dragOverBranch === branchName && branchDropPosition === 'before' ? 'border-t-4 border-t-indigo-600 scale-[1.02] shadow-lg' : ''}
                                        ${dragOverBranch === branchName && branchDropPosition === 'after' ? 'border-b-4 border-b-indigo-600 scale-[1.02] shadow-lg' : ''}
                                        ${dragOverBranch === branchName && branchDropPosition === 'swap' ? 'border-4 border-indigo-500 scale-[1.02] ring-4 ring-indigo-100' : 'border border-gray-200'}
                                        ${draggedBranch === branchName ? 'opacity-40 scale-[0.98] border-dashed border-indigo-400' : ''}
                                    `}
                                >
                                    {/* ACCORDION HEADER (Minimal Redesign) */}
                                    <div 
                                        className={`flex w-full items-center justify-between px-6 py-4 transition hover:bg-gray-50 ${isDraggableBranch ? 'cursor-move' : ''}`}
                                    >
                                        {/* Left Side: Drag Handle & Title */}
                                        <div 
                                            className="flex flex-1 items-center gap-3 cursor-pointer"
                                            onClick={() => toggleSection(branchName)}
                                        >
                                            {isDraggableBranch && (
                                                <div className="text-gray-300 transition-colors hover:text-gray-500">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                                                    </svg>
                                                </div>
                                            )}
                                            <div>
                                                <h4 className="text-lg font-bold text-gray-800">{branchName}</h4>
                                                <p className="mt-0.5 text-sm text-gray-500">{membersInBranch.length} {membersInBranch.length === 1 ? 'member' : 'members'}</p>
                                            </div>
                                        </div>

                                        {/* Right Side: Toggles, Edit, Delete */}
                                        <div className="flex items-center gap-3">
                                            {/* View Mode Toggle */}
                                            {isDraggableBranch && (
                                                <div className="flex items-center gap-0.5 rounded-md border border-gray-200 bg-gray-50 p-0.5 shadow-inner" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateBranchViewMode(branchName, 'carousel')}
                                                        title="Grouped Carousel View"
                                                        className={`rounded px-2 py-1.5 transition-all ${currentMode === 'carousel' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 011.875 1.875v1.5a1.875 1.875 0 01-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875v-1.5c0-1.036.84-1.875 1.875-1.875z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateBranchViewMode(branchName, 'grid')}
                                                        title="Standard Grid View"
                                                        className={`rounded px-2 py-1.5 transition-all ${currentMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}

                                            {/* Edit & Delete Actions */}
                                            {isDraggableBranch && (
                                                <div className="flex items-center gap-1 border-l border-gray-200 pl-3" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        disabled={!canManageOrgChart}
                                                        onClick={() => canManageOrgChart && updateBranch(branchName)}
                                                        title={!canManageOrgChart ? 'Edit permission required' : 'Edit Department Name'}
                                                        className={`p-1.5 rounded-md transition-colors ${canManageOrgChart ? 'text-gray-400 hover:bg-blue-50 hover:text-blue-600' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={!canDeleteOrgChart}
                                                        onClick={() => canDeleteOrgChart && deleteBranch(branchName)}
                                                        title={!canDeleteOrgChart ? 'Full permission required to delete department' : 'Delete Department'}
                                                        className={`p-1.5 rounded-md transition-colors ${canDeleteOrgChart ? 'text-gray-400 hover:bg-red-50 hover:text-red-600' : 'bg-gray-100 text-red-300 cursor-not-allowed'}`}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}

                                            {/* Chevron Toggle */}
                                            <button 
                                                type="button"
                                                onClick={() => toggleSection(branchName)}
                                                className="p-1.5 text-gray-400 hover:text-gray-800 transition ml-1"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                                                    <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 01-1.06 0l-6-6a.75.75 0 111.06-1.06L12 14.69l5.47-5.47a.75.75 0 111.06 1.06l-6 6z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {isOpen && (
                                        <div className="border-t border-gray-200 px-6 py-6 bg-gray-50/50 cursor-default" onDragOver={(e) => e.stopPropagation()} onDrop={(e) => e.stopPropagation()}>
                                            {membersInBranch.length === 0 ? (
                                                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
                                                    <h5 className="text-base font-medium text-gray-900">No members yet</h5>
                                                    <p className="mt-1 text-sm text-gray-500">Add a member to this department to get started.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                                    {membersInBranch.map((member) => (
                                                        <div 
                                                            key={member.id} 
                                                            draggable
                                                            onDragStart={(e) => handleDragStart(e, member.id)}
                                                            onDragOver={(e) => handleDragOver(e, member.id)}
                                                            onDragLeave={handleDragLeave}
                                                            onDrop={(e) => handleDrop(e, member.id, branchName)}
                                                            onDragEnd={handleDragEnd}
                                                            className={`group relative flex flex-col items-center rounded-2xl border bg-white p-6 shadow-sm transition-all cursor-move
                                                                ${dragOverId === member.id && dropPosition === 'before' ? 'border-l-4 border-l-indigo-600 scale-105 shadow-lg opacity-90' : ''}
                                                                ${dragOverId === member.id && dropPosition === 'after' ? 'border-r-4 border-r-indigo-600 scale-105 shadow-lg opacity-90' : ''}
                                                                ${dragOverId === member.id && dropPosition === 'swap' ? 'border-indigo-500 scale-105 ring-4 ring-indigo-100 opacity-90' : ''}
                                                                ${dragOverId !== member.id ? 'border-gray-100 hover:border-indigo-300 hover:shadow-xl' : ''}
                                                                ${draggedId === member.id ? 'opacity-40 scale-95 border-dashed border-indigo-400' : ''}
                                                            `}
                                                        >
                                                            {/* Member Drag Handle Icon */}
                                                            <div className="absolute left-4 top-4 text-gray-300 transition-colors group-hover:text-gray-500">
                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                                                                </svg>
                                                            </div>

                                                            {/* 3-Dot Actions Dropdown */}
                                                            <div className="absolute right-4 top-4 z-20">
                                                                <button
                                                                    onMouseDown={(e) => e.stopPropagation()} 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveDropdown(activeDropdown === member.id ? null : member.id);
                                                                    }}
                                                                    className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-gray-100 focus:outline-none"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                                                                    </svg>
                                                                </button>

                                                                {activeDropdown === member.id && (
                                                                    <>
                                                                        <div 
                                                                            className="fixed inset-0 z-10" 
                                                                            onMouseDown={(e) => { e.stopPropagation(); setActiveDropdown(null); }}
                                                                            onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); }}
                                                                        ></div>
                                                                        
                                                                        <div className="absolute right-0 top-full mt-1 w-40 z-20 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                                                                            <div className="py-1">
                                                                                <button
                                                                                    onMouseDown={(e) => e.stopPropagation()}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setActiveDropdown(null);
                                                                                        canManageOrgChart && openModal(member);
                                                                                    }}
                                                                                    disabled={!canManageOrgChart}
                                                                                    title={!canManageOrgChart ? 'Edit permission required' : ''}
                                                                                    className={`flex w-full items-center px-4 py-2.5 text-sm font-medium ${canManageOrgChart ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-400 cursor-not-allowed bg-gray-50'}`}
                                                                                >
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-2.5 text-gray-500">
                                                                                        <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                                                                                    </svg>
                                                                                    Edit Info
                                                                                </button>
                                                                                <button
                                                                                    onMouseDown={(e) => e.stopPropagation()}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setActiveDropdown(null);
                                                                                        canDeleteOrgChart && deleteMemberAction(member.id);
                                                                                    }}
                                                                                    disabled={!canDeleteOrgChart}
                                                                                    title={!canDeleteOrgChart ? 'Full permission required to remove member' : ''}
                                                                                    className={`flex w-full items-center px-4 py-2.5 text-sm font-medium ${canDeleteOrgChart ? 'text-red-600 hover:bg-red-50' : 'text-red-300 cursor-not-allowed bg-red-50'}`}
                                                                                >
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-2.5">
                                                                                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                                                                                    </svg>
                                                                                    Remove Member
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>

                                                            <div className="relative z-10 mb-4 h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-white bg-gray-100 shadow-md transition-colors group-hover:border-indigo-100">
                                                                {member.image_path ? (
                                                                    <img src={`/storage/${member.image_path}`} alt={member.name} className="h-full w-full object-cover pointer-events-none" />
                                                                ) : (
                                                                    <svg className="h-full w-full bg-gray-50 p-6 text-black pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                                                                        <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                                                                    </svg>
                                                                )}
                                                            </div>

                                                            <div className="relative z-10 w-full text-center pointer-events-none">
                                                                <h4 className="px-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-indigo-900">{member.name}</h4>
                                                                <div className="mt-2 inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-indigo-700 transition-colors group-hover:bg-indigo-100">
                                                                    {member.position}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* MEMBER MODAL */}
            <Modal show={isModalOpen} onClose={closeModal} maxWidth="md">
                <div className="p-6">
                    <div className="mb-6 flex items-center justify-between border-b pb-4">
                        <h2 className="text-xl font-bold text-gray-900">{editingMember ? 'Edit Team Member' : 'Add New Member'}</h2>
                        <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <form onSubmit={submit} className="space-y-4">
                        {editingMember && editingMember.image_path && (
                            <div className="mb-3 flex flex-col items-center justify-center rounded-lg border border-gray-100 bg-gray-50 p-3">
                                <span className="mb-2 text-xs font-semibold text-gray-500">Current Photo</span>
                                <img src={`/storage/${editingMember.image_path}`} alt="Current member" className="h-20 w-20 rounded-full border-4 border-white object-cover shadow-md" />
                            </div>
                        )}

                        <div>
                            <label className="mb-1 block text-sm font-bold text-gray-700">Display Name</label>
                            <input type="text" value={data.name} onChange={(e) => setData('name', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="e.g. Dr. Jane Doe" required />
                            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                        </div>

                        <div>
                            <div className="mb-1 flex items-center justify-between">
                                <label className="block text-sm font-bold text-gray-700">Department / Branch</label>
                            </div>
                            <select value={data.branch} onChange={(e) => setData('branch', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" required>
                                {dynamicBranches.map((branch) => (
                                    <option key={branch} value={branch}>{branch}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <div className="mb-1 flex items-center justify-between">
                                <label className="block text-sm font-bold text-gray-700">Position / Title</label>
                                <button
                                    type="button"
                                    onClick={() => canManageOrgChart && setIsPositionManagerOpen(true)}
                                    disabled={!canManageOrgChart}
                                    title={!canManageOrgChart ? 'Edit permission required' : ''}
                                    className={`text-xs font-semibold transition-colors ${canManageOrgChart ? 'text-indigo-600 hover:text-indigo-800' : 'text-gray-400 cursor-not-allowed'}`}
                                >
                                    Manage
                                </button>
                            </div>
                            <select value={data.position} onChange={(e) => setData('position', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" required>
                                <option value="">Select position</option>
                                {selectedBranchPositions.map((position) => (
                                    <option key={position} value={position}>{position}</option>
                                ))}
                            </select>
                            {errors.position && <p className="mt-1 text-xs text-red-500">{errors.position}</p>}
                            <p className="mt-1 text-xs text-gray-500">Positions are limited to the roles available under the selected section.</p>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-bold text-gray-700">{editingMember ? 'Replace Photo (Optional)' : 'Upload Photo (Optional)'}</label>
                            <input type="file" onChange={(e) => setData('image', e.target.files[0] || null)} className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 transition-colors hover:file:bg-indigo-100" accept="image/*" />
                            {errors.image && <p className="mt-1 text-xs text-red-500">{errors.image}</p>}
                        </div>

                        <div className={`mt-8 flex gap-3 border-t pt-4 justify-end`}>
                            <button type="button" onClick={closeModal} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">Cancel</button>
                            <button type="submit" disabled={processing} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow transition-colors hover:bg-indigo-500 disabled:opacity-50">
                                {editingMember ? 'Save Changes' : 'Save Member'}
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>

            {/* ==========================================
                BRANCH MANAGER MODAL (Now only used for ADDING new branches)
                ========================================== */}
            <Modal show={isBranchManagerOpen} onClose={() => { setIsBranchManagerOpen(false); setNewItemName(''); }} maxWidth="md">
                <div className="p-6">
                    <div className="mb-4 flex items-center justify-between border-b pb-4">
                        <h2 className="text-xl font-bold text-gray-900">Add New Branch</h2>
                        <button onClick={() => setIsBranchManagerOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                    
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            placeholder="Type new branch name..."
                            className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                        <button onClick={() => { addBranch(); setIsBranchManagerOpen(false); }} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500 shrink-0">Add Branch</button>
                    </div>
                </div>
            </Modal>

            {/* ==========================================
                POSITION MANAGER MODAL
                ========================================== */}
            <Modal show={isPositionManagerOpen} onClose={() => { setIsPositionManagerOpen(false); setNewItemName(''); }} maxWidth="md">
                <div className="p-6">
                    <div className="mb-4 flex items-center justify-between border-b pb-4">
                        <h2 className="text-xl font-bold text-gray-900">Manage Positions</h2>
                        <button onClick={() => setIsPositionManagerOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                    </div>

                    <p className="mb-2 text-xs font-semibold text-gray-500">Currently managing positions for:</p>
                    <div className="mb-4 rounded-lg bg-indigo-50 p-3 text-sm font-bold text-indigo-700">
                        {data.branch || "Please select a branch in the main form first."}
                    </div>
                    
                    <div className="mb-4 flex gap-2">
                        <input
                            type="text"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            disabled={!data.branch}
                            placeholder="New position title..."
                            className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100"
                        />
                        <button
                            onClick={() => addPosition(data.branch)}
                            disabled={!data.branch || !canManageOrgChart}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!canManageOrgChart ? 'Edit permission required' : ''}
                        >Add</button>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2">
                        {(dynamicPositions[data.branch] || []).map((pos) => (
                            <div key={pos} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 border border-gray-100">
                                <span className="text-sm font-medium text-gray-800">{pos}</span>
                                <div className="flex gap-3 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => canManageOrgChart && updatePosition(data.branch, pos)}
                                        disabled={!canManageOrgChart}
                                        className="text-blue-600 hover:underline disabled:text-gray-400 disabled:hover:underline-none disabled:cursor-not-allowed"
                                        title={!canManageOrgChart ? 'Edit permission required' : ''}
                                    >Edit</button>
                                    <button
                                        type="button"
                                        onClick={() => canManageOrgChart && deletePosition(data.branch, pos)}
                                        disabled={!canManageOrgChart}
                                        className="text-red-600 hover:underline disabled:text-red-300 disabled:hover:underline-none disabled:cursor-not-allowed"
                                        title={!canManageOrgChart ? 'Full permission required to delete position' : ''}
                                    >Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

        </SidebarLayout>
    );
}