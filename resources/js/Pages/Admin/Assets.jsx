import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Head, useForm, router, usePage, Link } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import InputLabel from '@/Components/InputLabel';
import InputError from '@/Components/InputError';
import { getAssetLinks } from '@/Config/navigation'; 

const getArray = (val) => {
    if (Array.isArray(val)) return val;
    if (val && Array.isArray(val.data)) return val.data;
    return [];
};

const getSafeStr = (val) => {
    if (val === null || val === undefined) return '';
    return String(val).toLowerCase().trim();
};

export default function Assets({ auth, assets, suppliers, branches, users, departments }) {
    const assetLinks = typeof getAssetLinks === 'function' ? getAssetLinks(auth) : []; 
    const { system } = usePage().props;
    
    // SECURE ROLE CHECKING
    const userRole = getSafeStr(auth?.user?.role?.name || auth?.user?.role);
    const userPosition = getSafeStr(auth?.user?.position?.name || auth?.user?.position);
    const userDepartment = getSafeStr(auth?.user?.department?.name || auth?.user?.department);
    const userName = getSafeStr(auth?.user?.name);
    const userId = String(auth?.user?.id || '');
    
    const isSuperAdmin = ['admin', 'super admin', 'director of corporate services and operations'].includes(userRole);
    const isAudit = userRole.includes('audit') || userPosition.includes('audit') || userDepartment.includes('audit') || userRole.includes('view only');
    const canManageAssets = isSuperAdmin; 
    const isAllowedToView = isSuperAdmin || !isAudit; 

    // SAFE DATA ARRAYS
    const rawAssets = getArray(assets);
    const safeUsers = getArray(users);
    const safeSuppliers = getArray(suppliers);
    const safeDepartments = getArray(departments); 
    
    let safeBranches = getArray(branches);
    if (safeBranches.length === 0) safeBranches = getArray(system?.branches);
    if (safeBranches.length === 0) safeBranches = ['Makati', 'Greenhills', 'Alabang'];

    const allDepartments = [...new Set([
        ...safeDepartments.map(d => typeof d === 'object' ? d.name : d),
        ...rawAssets.map(a => a?.department),
        ...safeUsers.map(u => typeof u?.department === 'object' ? u?.department?.name : u?.department)
    ].filter(Boolean))]
    .filter(dept => String(dept).toUpperCase() !== 'IT')
    .sort();

    const existingCategories = [...new Set(rawAssets.map(a => a?.category).filter(Boolean))];
    const [customCategories, setCustomCategories] = useState([]);
    const allCategories = [...new Set([...existingCategories, ...customCategories])].sort();

    // GET ALL UNIQUE PERSONNEL FOR FILTER
    const allPersonnel = [...new Set(rawAssets.map(a => a?.user?.name || a?.assigned_personnel).filter(Boolean))].sort();

    // DYNAMIC AREA STATE WITH TARGETED ASSIGNMENT UTILITIES
    const existingAreas = [...new Set(rawAssets.map(a => a?.area).filter(Boolean))];
    const [customAreas, setCustomAreas] = useState([]);
    const allAreas = [...new Set([...existingAreas, ...customAreas])].sort();

    // CUSTOM CONFIRMATION DIALOG STATE
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false, title: '', message: '', actionType: 'danger', onConfirm: null,
    });
    const triggerConfirm = (title, message, onConfirm, actionType = 'danger') => {
        setConfirmDialog({ isOpen: true, title, message, actionType, onConfirm });
    };
    const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

    // CUSTOM SYSTEM ALERT MODAL STATE 
    const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'success' });
    const closeAlert = () => setAlertDialog(prev => ({ ...prev, isOpen: false }));

    const safeAssets = isSuperAdmin 
        ? rawAssets 
        : rawAssets.filter(asset => {
            if (!asset) return false;
            
            const assetDept = getSafeStr(asset.department);
            const assetPersonnel = getSafeStr(asset.assigned_personnel);
            const assetUserId = String(asset.user_id || '');

            let assignedUserDept = '';
            if (assetUserId !== '') {
                const assignedUser = safeUsers.find(u => String(u.id) === assetUserId);
                if (assignedUser) assignedUserDept = getSafeStr(assignedUser.department?.name || assignedUser.department);
            } else if (assetPersonnel !== '') {
                const assignedUser = safeUsers.find(u => getSafeStr(u.name) === assetPersonnel || assetPersonnel.includes(getSafeStr(u.name)));
                if (assignedUser) assignedUserDept = getSafeStr(assignedUser.department?.name || assignedUser.department);
            }

            const isMyDepartment = (deptToCheck) => {
                if (!deptToCheck || !userDepartment) return false;
                if (deptToCheck === userDepartment) return true;
                const isCheckingIT = deptToCheck === 'it' || deptToCheck === 'information technology';
                const amIIT = userDepartment === 'it' || userDepartment === 'information technology';
                if (isCheckingIT && amIIT) return true;
                return false;
            };

            if (isMyDepartment(assetDept)) return true;
            if (isMyDepartment(assignedUserDept)) return true;
            if (assetUserId !== '' && assetUserId === userId) return true;
            if (assetPersonnel !== '' && userName !== '' && (assetPersonnel.includes(userName) || userName.includes(assetPersonnel))) return true;

            return false;
        });

    const [showColumnDropdown, setShowColumnDropdown] = useState(false);
    const dropdownRef = useRef(null);
    const [visibleColumns, setVisibleColumns] = useState({
        assetTag: true, serialNo: true, modelNo: true, color: true, category: true,
        status: true, condition: true, assignedPersonnel: true, department: true,
        branch: true, area: true, supplier: true, purchasedDate: true, warrantyExp: true,
        depreciationMonths: true, qty: true, unitValue: true, totalValue: true, depreciation: true,  
        currentValue: true,  
    });
    
    const [tempVisibleColumns, setTempVisibleColumns] = useState(visibleColumns);

    const columnLabels = {
        assetTag: 'Asset Tag', serialNo: 'Serial No.', modelNo: 'Model No.', color: 'Color',
        category: 'Category', status: 'Status', condition: 'Condition', assignedPersonnel: 'Assigned Personnel',
        department: 'Department', branch: 'Branch', area: 'Area', supplier: 'Supplier',
        purchasedDate: 'Purchased Date', warrantyExp: 'Warranty Exp.', depreciationMonths: 'Depreciation (Months)', 
        qty: 'Qty', unitValue: 'Unit Value', totalValue: 'Total Value', depreciation: 'Acc. Depreciation', 
        currentValue: 'Current Book Value', 
    };

    const openColumnDropdown = () => {
        setTempVisibleColumns(visibleColumns);
        setShowColumnDropdown(true);
    };

    const allColumnsSelected = Object.keys(tempVisibleColumns).length > 0 && Object.values(tempVisibleColumns).every(Boolean);
    const toggleAllColumns = () => {
        const next = {};
        Object.keys(tempVisibleColumns).forEach(k => next[k] = !allColumnsSelected);
        setTempVisibleColumns(next);
    };

    const applyColumnFilters = () => {
        setVisibleColumns(tempVisibleColumns);
        setShowColumnDropdown(false);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setShowColumnDropdown(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const classifications = ['Capex', 'Non-Capex', 'Consumable'];
    const conditions = ['Good', 'Broken', 'For Repair', 'Missing'];

    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterBranch, setFilterBranch] = useState(''); 
    const [filterCondition, setFilterCondition] = useState(''); 
    const [filterWarranty, setFilterWarranty] = useState(''); 
    const [filterPersonnel, setFilterPersonnel] = useState('');
    const [dateRangeType, setDateRangeType] = useState('All Time');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    
    const [selectedAssets, setSelectedAssets] = useState([]);
    const [showOnlySelected, setShowOnlySelected] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingAsset, setViewingAsset] = useState(null);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isBulkTransferModalOpen, setIsBulkTransferModalOpen] = useState(false);
    
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [importError, setImportError] = useState('');

    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
    const [imagePreview, setImagePreview] = useState(null);

    const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    
    const [isAddAreaModalOpen, setIsAddAreaModalOpen] = useState(false);
    const [newAreaName, setNewAreaName] = useState('');
    
    const { data, setData, post, put, delete: destroy, processing, reset, clearErrors, errors, setError } = useForm({
        id: '', name: '', asset_tag: '', category: '', classification: '', department: '',
        branch: '', user_id: '', assigned_personnel: '', area: '', purchase_date: '', supplier_id: '', supplier_name: '',
        warranty_expiration: '', condition: 'Good', unit_value: 0, qty: 1, asset_status: 'New', 
        model_no: '', serial_no: '', color: '', image: null 
    });

    const bulkTransferForm = useForm({
        ids: [], user_id: '', assigned_personnel: '', department: '', branch: '', area: '', asset_status: 'Assigned',
    });

    const handleAddCategory = (e) => {
        e.preventDefault();
        const cat = newCategoryName.trim();
        if (!cat) return;
        setCustomCategories(prev => [...new Set([...prev, cat])]);
        setData('category', cat);
        setIsAddCategoryModalOpen(false);
        setNewCategoryName('');
    };

    const handleDeleteCategory = (catName) => {
        if (!catName) return;
        triggerConfirm(
            'Delete Category',
            `⚠️ Are you sure you want to remove the category "${catName}" from the selection options?`,
            () => {
                setCustomCategories(prev => prev.filter(c => c !== catName));
                if (data.category === catName) setData('category', '');
            },
            'danger'
        );
    };

    const handleAddArea = (e) => {
        e.preventDefault();
        const area = newAreaName.trim();
        if (!area) return;
        setCustomAreas(prev => [...new Set([...prev, area])]);
        setData('area', area);
        setIsAddAreaModalOpen(false);
        setNewAreaName('');
    };

    const handleDeleteArea = (areaName) => {
        if (!areaName) return;
        triggerConfirm(
            'Delete Area',
            `⚠️ Are you sure you want to remove the area "${areaName}" from the selection options?`,
            () => {
                setCustomAreas(prev => prev.filter(a => a !== areaName));
                if (data.area === areaName) setData('area', '');
            },
            'danger'
        );
    };

    const safeFormatDate = (dateString) => {
        if (!dateString) return '-';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    };

    const isWarrantyExpired = (dateString) => {
        if (!dateString) return false;
        const parts = String(dateString).split('-');
        if (parts.length === 3) {
            const [year, month, day] = parts.map(Number);
            const d = new Date(year, month - 1, day);
            return !isNaN(d.getTime()) && d < new Date();
        }
        return false;
    };

    const calculateDepreciationMonths = (dateString) => {
        if (!dateString) return '-';
        const pDate = new Date(dateString);
        const today = new Date();
        if (isNaN(pDate.getTime())) return '-';
        
        const diffDays = Math.floor((today.getTime() - pDate.getTime()) / (1000 * 3600 * 24));
        if (diffDays <=30) return '0 Months';
        
        const months = Math.floor(diffDays / 30); 
        return `${Math.max(0, months)} Months`;
    };

    const getDepreciationData = (asset) => {
        const originalValue = parseFloat(asset?.total_value || (asset?.unit_value * asset?.qty)) || 0;
        if (!asset?.purchase_date || originalValue === 0) return { accumulated: 0, current: originalValue };
        
        const pDate = new Date(asset.purchase_date);
        const today = new Date();
        if (isNaN(pDate.getTime())) return { accumulated: 0, current: originalValue };

        const usefulLifeMonths = 60; 
        const diffDays = Math.floor((today.getTime() - pDate.getTime()) / (1000 * 3600 * 24));
        
        let monthsAlive = diffDays < 30 ? 0 : Math.floor(diffDays / 30);
        monthsAlive = Math.max(0, monthsAlive); 
        
        const depreciationRatio = Math.min(monthsAlive / usefulLifeMonths, 1);
        const accumulated = originalValue * depreciationRatio;
        const current = originalValue - accumulated;

        return { accumulated, current };
    };

    const getBranchValue = (branchData) => {
        if (!branchData) return '';
        if (typeof branchData === 'object' && branchData.name) return branchData.name;
        return String(branchData);
    };

    const getSelectedUserName = (userId) => {
        if (!userId) return '';
        const user = safeUsers.find(u => String(u?.id) === String(userId));
        return user ? String(user?.name || '') : '';
    };

    const isDateInRange = (asset, type, start, end) => {
        if (type === 'All Time') return true;
        const rawDate = asset?.purchase_date || asset?.created_at;
        if (!rawDate) return false;

        const dateString = String(rawDate).split('T')[0].split(' ')[0];
        const parts = dateString.split('-');
        if (parts.length !== 3) return false;
        const [year, month, day] = parts.map(Number);
        if (!year || !month || !day) return false;

        const assetDate = new Date(year, month - 1, day);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (type === 'Today') return assetDate.getTime() === today.getTime();
        if (type === 'This Week') {
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay()); 
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6); 
            return assetDate >= startOfWeek && assetDate <= endOfWeek;
        }
        if (type === 'This Month') return assetDate.getMonth() === today.getMonth() && assetDate.getFullYear() === today.getFullYear();
        if (type === 'This Year') return assetDate.getFullYear() === today.getFullYear();
        if (type === 'Custom Range') {
            const s = start ? new Date(start.split('-')[0], start.split('-')[1] - 1, start.split('-')[2]) : null;
            const e = end ? new Date(end.split('-')[0], end.split('-')[1] - 1, end.split('-')[2]) : null;
            if (s && e) return assetDate >= s && assetDate <= e;
            if (s) return assetDate >= s;
            if (e) return assetDate <= e;
            return true; 
        }
        return true;
    };

    const stats = useMemo(() => {
        let totalItems = 0; let totalValue = 0; let needsMaintenance = 0; let totalCurrentValue = 0; let totalAccumulatedDepreciation = 0;
        const branchBreakdown = {};
        const conditionBreakdown = { 'Good': 0, 'Broken': 0, 'For Repair': 0, 'Missing': 0 };
        const uniquePersonnel = new Set();

        safeBranches.forEach(b => {
            const bName = typeof b === 'object' ? (b?.name || '') : String(b);
            if (bName) branchBreakdown[bName] = { items: 0, value: 0, currentValue: 0 };
        });

        safeAssets.forEach(asset => {
            if (!asset) return; 

            const matchesBranch = filterBranch ? getBranchValue(asset?.branch) === filterBranch : true;
            const matchesCategory = filterCategory ? asset?.category === filterCategory : true;
            const matchesDept = filterDept ? asset?.department === filterDept : true;
            const matchesCondition = filterCondition ? asset?.condition === filterCondition : true;
            const matchesDate = isDateInRange(asset, dateRangeType, customStartDate, customEndDate);
            
            let matchesWarranty = true;
            if (filterWarranty === 'Valid') { matchesWarranty = asset.warranty_expiration && !isWarrantyExpired(asset.warranty_expiration); } 
            else if (filterWarranty === 'Expired') { matchesWarranty = isWarrantyExpired(asset.warranty_expiration); }

            const safeAssetPersonnel = getSafeStr(asset?.user?.name || asset?.assigned_personnel);
            const matchesPersonnel = filterPersonnel ? safeAssetPersonnel === getSafeStr(filterPersonnel) : true;

            if (!(matchesBranch && matchesCategory && matchesDept && matchesDate && matchesCondition && matchesWarranty && matchesPersonnel)) return;

            const qty = Number(asset?.qty || 1);
            let val = 0;
            if (asset?.total_value) val = parseFloat(asset.total_value);
            else if (asset?.unit_value) val = parseFloat(asset.unit_value) * qty;
            if (isNaN(val)) val = 0;
            
            const depData = getDepreciationData(asset);
            
            totalItems += qty;
            totalValue += val;
            totalCurrentValue += depData.current;
            totalAccumulatedDepreciation += depData.accumulated;
            
            if (asset?.user_id) uniquePersonnel.add(`id_${asset.user_id}`);
            else if (asset?.assigned_personnel) uniquePersonnel.add(`name_${getSafeStr(asset.assigned_personnel)}`);

            if (['Broken', 'For Repair', 'Missing'].includes(asset?.condition)) needsMaintenance++;

            const branchKey = getBranchValue(asset?.branch) || 'Unassigned';
            if (!branchBreakdown[branchKey]) branchBreakdown[branchKey] = { items: 0, value: 0, currentValue: 0 };
            branchBreakdown[branchKey].items += qty;
            branchBreakdown[branchKey].value += val;
            branchBreakdown[branchKey].currentValue += depData.current;

            const cond = asset?.condition || 'Good';
            conditionBreakdown[cond] = (conditionBreakdown[cond] || 0) + qty;
        });

        const assignedCount = uniquePersonnel.size;

        return { totalItems, totalValue, totalCurrentValue, totalAccumulatedDepreciation, assignedCount, needsMaintenance, branchBreakdown, conditionBreakdown };
    }, [safeAssets, safeBranches, filterBranch, filterCategory, filterDept, filterWarranty, dateRangeType, customStartDate, customEndDate, filterCondition, filterPersonnel]);

    const filteredAssets = useMemo(() => {
        return safeAssets.filter(asset => {
            if (!asset) return false; 
            
            const searchTerm = getSafeStr(search);
            const safeName = getSafeStr(asset?.name);
            const safeTag = getSafeStr(asset?.asset_tag);
            const safeSerial = getSafeStr(asset?.serial_no);
            const safeModel = getSafeStr(asset?.model_no);
            const safePersonnel = getSafeStr(asset?.user?.name || asset?.assigned_personnel);

            const matchesSearch = safeName.includes(searchTerm) || 
                                  safeTag.includes(searchTerm) || 
                                  safeSerial.includes(searchTerm) || 
                                  safeModel.includes(searchTerm) || 
                                  safePersonnel.includes(searchTerm);
                                  
            const matchesCategory = filterCategory ? asset?.category === filterCategory : true;
            const matchesDept = filterDept ? asset?.department === filterDept : true;
            const matchesBranch = filterBranch ? getBranchValue(asset?.branch) === filterBranch : true;
            const matchesCondition = filterCondition ? asset?.condition === filterCondition : true;
            const matchesDate = isDateInRange(asset, dateRangeType, customStartDate, customEndDate);
            const matchesPersonnel = filterPersonnel ? safePersonnel === getSafeStr(filterPersonnel) : true;
            
            let matchesWarranty = true;
            if (filterWarranty === 'Valid') { matchesWarranty = asset.warranty_expiration && !isWarrantyExpired(asset.warranty_expiration); } 
            else if (filterWarranty === 'Expired') { matchesWarranty = isWarrantyExpired(asset.warranty_expiration); }

            return matchesSearch && matchesCategory && matchesDept && matchesBranch && matchesDate && matchesCondition && matchesWarranty && matchesPersonnel;
        });
    }, [safeAssets, search, filterCategory, filterDept, filterBranch, filterWarranty, dateRangeType, customStartDate, customEndDate, filterCondition, filterPersonnel]);

    const displayedAssets = useMemo(() => {
        let processed = [...filteredAssets];
        if (showOnlySelected) {
            processed = processed.filter(a => selectedAssets.includes(a.id));
        }
        processed.sort((a, b) => {
            const aSel = selectedAssets.includes(a.id);
            const bSel = selectedAssets.includes(b.id);
            if (aSel && !bSel) return -1;
            if (!aSel && bSel) return 1;
            return 0; 
        });
        return processed;
    }, [filteredAssets, selectedAssets, showOnlySelected]);

    const handleToggleSelectAll = () => {
        if (selectedAssets.length > 0) {
            setSelectedAssets([]);
            setShowOnlySelected(false);
        } else {
            setSelectedAssets(displayedAssets.map(a => a?.id).filter(Boolean));
        }
    };

    const handleSelectAll = () => setSelectedAssets(displayedAssets.map(a => a?.id).filter(Boolean));
    const handleDeselectAll = () => { setSelectedAssets([]); setShowOnlySelected(false); };
    const handleSelectOne = (e, id) => setSelectedAssets(prev => e.target.checked ? [...prev, id] : prev.filter(item => item !== id));

    const openBulkTransferModal = () => { bulkTransferForm.reset(); bulkTransferForm.clearErrors(); bulkTransferForm.setData('ids', selectedAssets); setIsBulkTransferModalOpen(true); };
    const closeBulkTransferModal = () => { setIsBulkTransferModalOpen(false); bulkTransferForm.reset(); };
    
    const handleBulkTransferSubmit = (e) => { 
        e.preventDefault(); 
        router.post(route('admin.assets.bulk-transfer'), 
            { ids: selectedAssets, user_id: bulkTransferForm.data.user_id, branch: bulkTransferForm.data.branch, department: bulkTransferForm.data.department }, 
            { preserveScroll: true, onSuccess: () => { closeBulkTransferModal(); setSelectedAssets([]); setShowOnlySelected(false); } }
        ); 
    };
    
    const handleBulkDelete = () => { 
        triggerConfirm(
            'Bulk Delete Asset Records',
            `Are you sure you want to delete ${selectedAssets.length} selected asset(s)?`,
            () => {
                router.post(route('admin.assets.bulk-delete'), { ids: selectedAssets }, { preserveScroll: true, onSuccess: () => { setSelectedAssets([]); setShowOnlySelected(false); } });
            },
            'danger'
        );
    };

    const openAddModal = () => { setIsEditMode(false); reset(); setImagePreview(null); clearErrors(); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setImagePreview(null); reset(); };
    const openViewModal = (asset) => { setViewingAsset(asset); setIsViewModalOpen(true); };
    const closeViewModal = () => { setIsViewModalOpen(false); setTimeout(() => setViewingAsset(null), 300); };
    const closeTransferModal = () => { setIsTransferModalOpen(false); reset(); };

    const openEditModal = (asset) => {
        setIsEditMode(true); clearErrors();
        setData({ 
            ...asset, supplier_id: asset?.supplier_id || '', user_id: asset?.user_id || '', branch: getBranchValue(asset?.branch), image: null 
        });
        setImagePreview(asset.image_path ? `/storage/${asset.image_path}` : null);
        
        if (asset.category && !allCategories.includes(asset.category)) {
            setCustomCategories(prev => [...prev, asset.category]);
        }
        
        if (asset.area && !allAreas.includes(asset.area)) {
            setCustomAreas(prev => [...prev, asset.area]);
        }

        setIsModalOpen(true);
    };

    const openTransferModal = (asset) => {
        clearErrors();
        setData({ ...asset, user_id: '', assigned_personnel: '', department: '', branch: '', area: '', asset_status: 'Assigned', supplier_id: asset?.supplier_id || '' });
        setIsTransferModalOpen(true);
    };

    const handleTransferSubmit = (e) => { e.preventDefault(); put(route('admin.assets.update', data.id), { onSuccess: () => closeTransferModal() }); };
    
    const handleSubmit = (e) => { 
        e.preventDefault(); 
        
        if (data.purchase_date && data.warranty_expiration) {
            const pDate = new Date(data.purchase_date);
            const wDate = new Date(data.warranty_expiration);
            if (wDate < pDate) {
                setError('warranty_expiration', 'Warranty cannot be earlier than purchase date.');
                return;
            }
        }
        clearErrors('warranty_expiration');

        if (isEditMode) {
            router.post(route('admin.assets.update', data.id), { _method: 'put', ...data }, { forceFormData: true, onSuccess: () => closeModal() });
        } else {
            post(route('admin.assets.store'), { forceFormData: true, onSuccess: () => closeModal() }); 
        }
    };
    
    const handleDelete = (id) => { 
        triggerConfirm(
            'Delete Asset',
            'Are you sure you want to delete this asset?',
            () => destroy(route('admin.assets.destroy', id)),
            'danger'
        );
    };

    const openImportModal = () => { setImportFile(null); setImportError(''); setIsImportModalOpen(true); };
    const closeImportModal = () => { setIsImportModalOpen(false); setImportFile(null); setImportError(''); setIsUploading(false); };

    const handleImportSubmit = (e) => {
        e.preventDefault();
        setImportError('');
        if (!importFile) {
            setAlertDialog({ isOpen: true, title: 'Upload Required', message: 'Please select a file to upload first.', type: 'error' });
            return;
        }

        const proceedWithImport = () => {
            setIsUploading(true);
            const formData = new FormData();
            formData.append('file', importFile);

            const uploadTimeout = setTimeout(() => { setIsUploading(false); }, 10000);

            router.post(route('admin.assets.import'), formData, {
                forceFormData: true, preserveScroll: true,
                onSuccess: () => { 
                    clearTimeout(uploadTimeout); 
                    closeImportModal(); 
                    setAlertDialog({ isOpen: true, title: 'Success', message: 'Your assets have been successfully imported!', type: 'success' }); 
                },
                onError: (err) => { clearTimeout(uploadTimeout); setImportError(err.file || "Import failed."); setIsUploading(false); },
                onFinish: () => { clearTimeout(uploadTimeout); setIsUploading(false); }
            });
        };

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                
                if (lines.length > 1) {
                    const parseCSVLine = (line) => {
                        const result = [];
                        let cur = '';
                        let inQuotes = false;
                        for (let i = 0; i < line.length; i++) {
                            if (line[i] === '"') inQuotes = !inQuotes;
                            else if (line[i] === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; }
                            else cur += line[i];
                        }
                        result.push(cur.trim());
                        return result;
                    };

                    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/^"|"$/g, ''));
                    const tagIndex = headers.findIndex(h => h === 'asset tag' || h === 'assettag');
                    
                    if (tagIndex !== -1) {
                        let duplicateCount = 0;
                        const existingTags = safeAssets.map(a => getSafeStr(a.asset_tag)).filter(Boolean);
                        
                        for (let i = 1; i < lines.length; i++) {
                            const cols = parseCSVLine(lines[i]);
                            if (cols.length > tagIndex) {
                                const tagVal = getSafeStr(cols[tagIndex].replace(/^"|"$/g, ''));
                                if (tagVal && existingTags.includes(tagVal)) {
                                    duplicateCount++;
                                }
                            }
                        }
                        
                        if (duplicateCount > 0) {
                            triggerConfirm(
                                'Duplicate Assets Detected',
                                `Warning: ${duplicateCount} duplicate asset(s) were found in your import file. Proceeding will update the existing records instead of creating new ones. Do you wish to continue?`,
                                () => proceedWithImport(),
                                'danger'
                            );
                            return; 
                        }
                    }
                }
                proceedWithImport();
            } catch (err) {
                // Fallback to normal upload if parsing fails
                proceedWithImport();
            }
        };
        reader.onerror = () => proceedWithImport();
        reader.readAsText(importFile);
    };

    const handleExport = () => {
        if (displayedAssets.length === 0) {
            setAlertDialog({ isOpen: true, title: 'Export Failed', message: 'No assets found for the current view.', type: 'error' });
            return;
        }
        
        const headers = [
            'Asset Name', 'Asset Tag', 'Serial No.', 'Model No.', 'Color', 'Category', 'Status', 'Condition', 'Assigned Personnel', 
            'Department', 'Branch', 'Area', 'Supplier', 'Purchased Date', 'Warranty Exp.', 'Depreciation (Months)', 'Qty', 'Unit Value', 'Total Value',
            'Acc. Depreciation', 'Current Book Value'
        ];
        const csvRows = [headers.join(',')];
        displayedAssets.forEach(asset => {
            if (!asset) return;
            const personnel = asset?.user?.name ? asset.user.name : (asset?.assigned_personnel || '-');
            const branch = getBranchValue(asset?.branch) || '-';
            const depData = getDepreciationData(asset);
            const escapeCSV = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
            const row = [
                escapeCSV(asset?.name), escapeCSV(asset?.asset_tag), escapeCSV(asset?.serial_no), escapeCSV(asset?.model_no),
                escapeCSV(asset?.color), escapeCSV(asset?.category), escapeCSV(asset?.asset_status || 'New'), escapeCSV(asset?.condition || 'Good'),
                escapeCSV(personnel), escapeCSV(asset?.department), escapeCSV(branch), escapeCSV(asset?.area),
                escapeCSV(asset?.supplier_name), escapeCSV(safeFormatDate(asset?.purchase_date)), escapeCSV(safeFormatDate(asset?.warranty_expiration)),
                escapeCSV(calculateDepreciationMonths(asset?.purchase_date)), asset?.qty || 1, asset?.unit_value || 0, asset?.total_value || (asset?.unit_value * (asset?.qty || 1)) || 0,
                depData.accumulated.toFixed(2), depData.current.toFixed(2)      
            ];
            csvRows.push(row.join(','));
        });
        const csvBlob = new Blob(["\uFEFF" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(csvBlob);
        link.setAttribute("download", `Filtered_Assets_Export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);

        if (isSuperAdmin) {
            try {
                router.post(route('admin.assets.log-export'), {}, { preserveScroll: true, preserveState: true });
            } catch (e) { console.log('Export logged locally'); }
        }
    };

    if (!isAllowedToView) {
        return (
            <SidebarLayout activeModule="Assets" sidebarLinks={assetLinks}>
                <div className="flex justify-center items-center h-full pt-32">
                    <div className="bg-red-50 text-red-700 p-8 rounded-lg shadow-sm font-bold text-center max-w-lg">
                        <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-lg mb-4">You do not have permission to view the Asset Management module.</p>
                    </div>
                </div>
            </SidebarLayout>
        );
    }

    return (
        <SidebarLayout 
            activeModule="Assets" 
            sidebarLinks={assetLinks} 
            onTriggerAddModal={canManageAssets ? openAddModal : null} 
            header={
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center w-full gap-4">
                    <h2 className="font-semibold text-xl text-gray-800 leading-tight">
                        {isSuperAdmin ? 'Accountability Module' : 'My Accountability'} 
                        {!canManageAssets && <span className="text-xs ml-2 bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full uppercase tracking-wider">{userDepartment || 'Department'} View</span>}
                    </h2>
                    
                    <div className="flex flex-col lg:flex-row items-center gap-3 w-full xl:w-auto">
                        <div className="flex items-center bg-white border border-gray-300 rounded-md shadow-sm px-3 py-1.5 w-full lg:w-auto">
                            <svg className="w-4 h-4 text-indigo-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <select className="border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 bg-transparent pr-8 cursor-pointer" value={dateRangeType} onChange={e => { setDateRangeType(e.target.value); if (e.target.value !== 'Custom Range') { setCustomStartDate(''); setCustomEndDate(''); }}}>
                                <option value="All Time">All Time</option><option value="Today">Today</option><option value="This Week">This Week</option><option value="This Month">This Month</option><option value="This Year">This Year</option><option value="Custom Range">Custom Range</option>
                            </select>
                        </div>
                        {dateRangeType === 'Custom Range' && (
                            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-md shadow-sm px-2 py-1.5 w-full lg:w-auto animate-fade-in-down">
                                <input type="date" className="border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 bg-transparent w-32" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} />
                                <span className="text-gray-300 font-black">-</span>
                                <input type="date" className="border-none p-0 text-sm font-bold text-gray-700 focus:ring-0 bg-transparent w-32" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} />
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto mt-2 sm:mt-0 relative">
                            <div ref={dropdownRef} className="relative">
                                <SecondaryButton onClick={openColumnDropdown} className="!border-gray-300 text-gray-700 bg-white hover:bg-gray-50 shadow-sm py-2 justify-center gap-2 whitespace-nowrap h-full">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
                                    Columns
                                </SecondaryButton>
                                
                                {showColumnDropdown && (
                                    <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-xl z-50 p-2 max-h-[32rem] flex flex-col">
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2 pb-1 border-b flex justify-between items-center">
                                            <span>Display Columns</span>
                                            <button 
                                                type="button" 
                                                onClick={toggleAllColumns} 
                                                className={`text-[10px] uppercase tracking-wider font-bold ${allColumnsSelected ? 'text-gray-500 hover:text-gray-700' : 'text-indigo-600 hover:text-indigo-800'}`}
                                            >
                                                {allColumnsSelected ? 'Deselect All' : 'Select All'}
                                            </button>
                                        </div>
                                        <div className="overflow-y-auto flex-1">
                                            {Object.keys(tempVisibleColumns).map(col => (
                                                <label key={col} className="flex items-center px-2 py-1.5 hover:bg-indigo-50 rounded cursor-pointer text-sm text-gray-700 font-medium transition-colors">
                                                    <input 
                                                        type="checkbox" 
                                                        className="rounded border-gray-300 text-indigo-600 shadow-sm mr-3 focus:ring-indigo-500 h-4 w-4" 
                                                        checked={tempVisibleColumns[col]} 
                                                        onChange={() => setTempVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }))} 
                                                    />
                                                    {columnLabels[col]}
                                                </label>
                                            ))}
                                        </div>
                                        <div className="border-t border-gray-200 pt-2 mt-2 px-2">
                                            <PrimaryButton type="button" onClick={applyColumnFilters} className="w-full justify-center !py-1.5 text-xs font-black uppercase tracking-wider">Confirm Filter</PrimaryButton>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {canManageAssets && (
                                <>
                                    <a href="/asset_template.xlsx" download="Asset_Template.xlsx" className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 rounded-md font-bold text-[10px] text-gray-700 uppercase tracking-widest shadow-sm hover:bg-gray-50 focus:outline-none transition ease-in-out duration-150 justify-center gap-2 whitespace-nowrap">
                                        <svg className="w-4 h-4 text-indigo-300" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 110 2H7z" clipRule="evenodd" /></svg>
                                        Download Template
                                    </a>
                                    <button onClick={openImportModal} className="inline-flex items-center px-4 py-2 bg-white border border-emerald-300 rounded-md font-bold text-[10px] text-emerald-700 uppercase tracking-widest shadow-sm hover:bg-emerald-50 focus:outline-none transition ease-in-out duration-150 justify-center gap-2 whitespace-nowrap">
                                        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                                        Import Assets
                                    </button>
                                </>
                            )}
                            <SecondaryButton onClick={handleExport} className="!border-gray-300 text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 shadow-sm py-2 justify-center gap-2 whitespace-nowrap">
                                <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                Export
                            </SecondaryButton>
                        </div>
                    </div>
                </div>
            }
        >
            <Head title={isSuperAdmin ? "Accountability Module" : "My Accountability"} />
            <div className="py-6 sm:py-12">
                <div className="max-w-[100rem] mx-auto sm:px-6 lg:px-8">

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-6">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg></div>
                            <div><p className="text-[11px] font-black text-gray-500 uppercase tracking-tighter">Total Assets</p><p className="text-2xl font-black text-gray-900">{stats.totalItems}</p></div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-emerald-50 p-6 flex items-center gap-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                            <div><p className="text-[11px] font-black text-gray-500 uppercase tracking-tighter">Original Value</p><p className="text-xl font-black text-gray-900">₱ {stats.totalValue.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p></div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6 flex items-center gap-4 relative overflow-hidden">
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                            </div>
                            <div className="z-10">
                                <p className="text-[11px] font-black text-gray-500 uppercase tracking-tighter">Acc. Depreciation</p>
                                <p className="text-xl font-black text-gray-900">₱ {stats.totalAccumulatedDepreciation.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
                            </div>
                        </div>
                        
                        <div className="bg-white rounded-xl shadow-sm border border-emerald-300 p-6 flex items-center gap-4 relative overflow-hidden">
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-50 rounded-full opacity-50"></div>
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg></div>
                            <div className="z-10"><p className="text-[11px] font-black text-emerald-600 uppercase tracking-tighter">Current Book Value</p><p className="text-xl font-black text-gray-900">₱ {stats.totalCurrentValue.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p></div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM16 16a5 5 0 10-10 0" /></svg></div>
                            <div><p className="text-[11px] font-black text-gray-500 uppercase tracking-tighter">Assigned Personnel</p><p className="text-2xl font-black text-gray-900">{stats.assignedCount}</p></div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center relative">
                            <div className="flex items-center gap-4 mb-3">
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                                <div><p className="text-[11px] font-black text-gray-500 uppercase tracking-tighter">Needs Action</p><p className="text-2xl font-black text-gray-900">{stats.needsMaintenance}</p></div>
                            </div>
                            <div className="flex gap-3 text-[9px] font-black uppercase tracking-widest border-t border-gray-50 pt-2">
                                <span className="text-red-500">Broken: {stats.conditionBreakdown?.['Broken'] || 0}</span>
                                <span className="text-yellow-600">Repair: {stats.conditionBreakdown?.['For Repair'] || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-50 pb-2">
                                {filterBranch ? `${filterBranch} Summary` : "Assets & Current Value Per Branch"} 
                                {dateRangeType !== 'All Time' && <span className="text-indigo-500 ml-1">({dateRangeType})</span>}
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {Object.entries(stats.branchBreakdown).map(([branch, itemData]) => (
                                    <div key={branch} className="bg-gray-50 rounded-lg p-4 border border-gray-100 relative overflow-hidden">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-bold text-gray-700 text-sm truncate">{branch}</span>
                                        </div>
                                        <div className="flex justify-between items-end mt-1">
                                            <div><span className="text-xs text-gray-500">Items: </span><span className="font-bold text-gray-900">{itemData.items}</span></div>
                                            <div className="text-right">
                                                <span className="block text-[9px] text-gray-400 uppercase font-bold">Orig: ₱{itemData.value.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits:0})}</span>
                                                <span className="font-bold text-emerald-600 text-sm leading-none">₱{itemData.currentValue.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits:0})}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-50 pb-2">Condition Tracker</h3>
                            <div className="space-y-4">
                                {Object.entries(stats.conditionBreakdown).map(([cond, count]) => {
                                    const percent = stats.totalItems > 0 ? Math.round((count / stats.totalItems) * 100) : 0;
                                    const colorClass = cond === 'Good' ? 'bg-emerald-500' : cond === 'Broken' ? 'bg-red-500' : cond === 'For Repair' ? 'bg-yellow-500' : 'bg-gray-500';
                                    return (
                                        <div key={cond} className="relative">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-bold text-gray-700">{cond}</span>
                                                <span className="font-bold text-gray-700">{count} <span className="text-gray-400">({percent}%)</span></span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2"><div className={`${colorClass} h-2 rounded-full`} style={{ width: `${percent}%` }}></div></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]"><InputLabel value="Search Assets" className="font-black tracking-tighter text-xs" /><TextInput className="w-full mt-1 text-xs font-bold" placeholder="Search by name, tag, serial, model, or personnel..." value={search} onChange={e => setSearch(e.target.value)} /></div>

                        <div className="w-36">
                            <InputLabel value="Assigned To" className="font-black tracking-tighter text-xs" />
                            <select className="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-xs font-bold py-2" value={filterPersonnel} onChange={e => setFilterPersonnel(e.target.value)}>
                                <option value="">All Personnel</option>
                                {allPersonnel.map((p, idx) => <option key={idx} value={p}>{p}</option>)}
                            </select>
                        </div>

                        <div className="w-36">
                            <InputLabel value="Warranty" className="font-black tracking-tighter text-xs" />
                            <select className="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-xs font-bold py-2" value={filterWarranty} onChange={e => setFilterWarranty(e.target.value)}>
                                <option value="">All</option>
                                <option value="Valid">Valid Warranty</option>
                                <option value="Expired">Expired</option>
                            </select>
                        </div>
                        
                        <div className="w-36"><InputLabel value="Condition" className="font-black tracking-tighter text-xs" /><select className="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-xs font-bold py-2" value={filterCondition} onChange={e => setFilterCondition(e.target.value)}><option value="">All</option><option value="Good">Good</option><option value="Broken">Broken</option><option value="For Repair">For Repair</option><option value="Missing">Missing</option></select></div>
                        <div className="w-36"><InputLabel value="Branch" className="font-black tracking-tighter text-xs" /><select className="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-xs font-bold py-2" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}><option value="">All Branches</option>{safeBranches.map((b, idx) => { if (!b) return null; const bn = typeof b === 'object' ? (b.name || '') : String(b); return bn ? <option key={idx} value={bn}>{bn}</option> : null; })}</select></div>
                        <div className="w-36"><InputLabel value="Category" className="font-black tracking-tighter text-xs" /><select className="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-xs font-bold py-2" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}><option value="">All Categories</option>{allCategories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                        
                        {isSuperAdmin && (
                            <div className="w-36">
                                <InputLabel value="Department" className="font-black tracking-tighter text-xs" />
                                <select className="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-xs font-bold py-2" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                                    <option value="">All Depts</option>
                                    {allDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 mb-6 mt-2 border-b border-gray-200 pb-4">
                        {!isAudit && (
                            <>
                                <button type="button" onClick={handleToggleSelectAll} className="text-xs font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-4 py-2 rounded shadow-sm border border-indigo-200">
                                    {selectedAssets.length > 0 ? 'Deselect All' : 'Select All'}
                                </button>
                                
                                {selectedAssets.length > 0 && (
                                    <button 
                                        type="button" 
                                        onClick={() => setShowOnlySelected(!showOnlySelected)} 
                                        className={`ml-auto text-xs font-black uppercase tracking-wider px-5 py-2 rounded-lg shadow-sm border transition-all ${
                                            showOnlySelected 
                                            ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700' 
                                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                        }`}
                                    >
                                        {showOnlySelected ? 'Show All Assets' : `Isolate Selected (${selectedAssets.length})`}
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {!isAudit && selectedAssets.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-6 flex justify-between items-center animate-fade-in-down">
                            <div className="flex items-center gap-4"><span className="font-bold text-indigo-800 text-sm px-2">{selectedAssets.length} asset(s) selected</span><div className="h-6 w-px bg-indigo-200"></div><div className="flex gap-2"><PrimaryButton onClick={openBulkTransferModal} className="bg-indigo-600 hover:bg-indigo-700 !py-1.5 !px-3 text-xs">Bulk Transfer</PrimaryButton><SecondaryButton onClick={handleBulkDelete} className="!border-red-200 !text-red-600 hover:!bg-red-50 !py-1.5 !px-3 text-xs font-bold">Bulk Delete</SecondaryButton></div></div>
                            <button onClick={handleDeselectAll} className="text-sm text-indigo-400 hover:text-indigo-600 font-medium px-2">Clear Selection</button>
                        </div>
                    )}

                    {/* 🟢 FIXED-HEIGHT SCROLLABLE TABLE CONTAINER */}
                    <div className="bg-white rounded-lg shadow border border-gray-200 w-full flex flex-col mb-6 overflow-hidden">
                        <div className="overflow-auto max-h-[550px] w-full relative">
                            <table className="min-w-full table-auto divide-y divide-gray-200 relative">
                                <thead className="bg-gray-100 sticky top-0 z-20 shadow-sm border-b border-gray-200">
                                    <tr>
                                        {canManageAssets && (
                                            <th className="px-4 py-4 text-center w-6 whitespace-nowrap border-r border-gray-200"><input type="checkbox" className="rounded border-gray-300 text-indigo-600 shadow-sm h-4 w-4" checked={displayedAssets.length > 0 && selectedAssets.length === displayedAssets.length} onChange={(e) => e.target.checked ? handleSelectAll() : handleDeselectAll()} /></th>
                                        )}
                                        <th className="px-4 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap pl-4">Asset Name</th>
                                        {visibleColumns.assetTag && <th className="px-4 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Asset Tag</th>}
                                        {visibleColumns.serialNo && <th className="px-4 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Serial No.</th>}
                                        {visibleColumns.modelNo && <th className="px-4 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Model No.</th>}
                                        {visibleColumns.color && <th className="px-4 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Color</th>}
                                        {visibleColumns.category && <th className="px-4 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Category</th>}
                                        {visibleColumns.status && <th className="px-4 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Status</th>}
                                        {visibleColumns.condition && <th className="px-4 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Condition</th>}
                                        {visibleColumns.assignedPersonnel && <th className="px-4 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Assigned Personnel</th>}
                                        {visibleColumns.department && <th className="px-4 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Department</th>}
                                        {visibleColumns.branch && <th className="px-4 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Branch</th>}
                                        {visibleColumns.area && <th className="px-4 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Area</th>}
                                        {visibleColumns.supplier && <th className="px-4 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Supplier</th>}
                                        {visibleColumns.purchasedDate && <th className="px-4 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Purchased</th>}
                                        {visibleColumns.warrantyExp && <th className="px-4 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Warranty</th>}
                                        {visibleColumns.depreciationMonths && <th className="px-4 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Depreciation (Months)</th>}
                                        {visibleColumns.qty && <th className="px-4 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Qty</th>}
                                        {visibleColumns.unitValue && <th className="px-4 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Unit Value</th>}
                                        {visibleColumns.totalValue && <th className="px-4 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Total Value</th>}
                                        
                                        {visibleColumns.depreciation && <th className="px-4 py-4 text-right text-xs font-black text-red-500 uppercase tracking-tighter whitespace-nowrap">Acc. Depreciation</th>}
                                        {visibleColumns.currentValue && <th className="px-4 py-4 text-right text-xs font-black text-emerald-600 uppercase tracking-tighter whitespace-nowrap bg-emerald-50 pr-4">Current Book Value</th>}

                                        {canManageAssets && (
                                            <th className="px-6 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap bg-gray-50 border-l border-gray-200">Actions</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {(!Array.isArray(displayedAssets) || displayedAssets.length === 0) ? (
                                        <tr>
                                            <td colSpan="24" className="px-4 py-12 text-center">
                                                <p className="font-bold text-gray-700 text-lg mb-2">No assets found for the selected view configuration.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedAssets.map((asset, index) => {
                                            if (!asset) return null;
                                            
                                            const depData = getDepreciationData(asset);
                                            const isExpired = isWarrantyExpired(asset?.warranty_expiration);
                                            const isSelected = selectedAssets.includes(asset.id);

                                            return (
                                            <tr key={asset?.id || index} className={`hover:bg-indigo-50/50 transition-colors text-sm text-gray-800 ${isSelected ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}>
                                                
                                                {canManageAssets && (
                                                    <td className="px-4 py-4 text-center whitespace-nowrap border-r border-gray-100"><input type="checkbox" className="rounded border-gray-300 text-indigo-600 shadow-sm h-4 w-4" checked={isSelected} onChange={(e) => handleSelectOne(e, asset.id)} /></td>
                                                )}

                                                <td className="px-4 py-4 whitespace-nowrap pl-4"><button type="button" onClick={() => openViewModal(asset)} className="font-black text-indigo-700 hover:text-indigo-900 hover:underline">{asset?.name}</button></td>
                                                {visibleColumns.assetTag && <td className="px-4 py-4 font-mono whitespace-nowrap text-gray-600 font-bold">{asset?.asset_tag}</td>}
                                                {visibleColumns.serialNo && <td className="px-4 py-4 font-mono whitespace-nowrap text-gray-600 font-bold">{asset?.serial_no || '-'}</td>}
                                                {visibleColumns.modelNo && <td className="px-4 py-4 whitespace-nowrap">{asset?.model_no || '-'}</td>}
                                                {visibleColumns.color && <td className="px-4 py-4 whitespace-nowrap">{asset?.color || '-'}</td>}
                                                {visibleColumns.category && <td className="px-4 py-4 whitespace-nowrap">{asset?.category || '-'}</td>}
                                                {visibleColumns.status && <th className="px-4 py-4 font-black whitespace-nowrap text-gray-900">{asset?.asset_status || 'New'}</th>}
                                                
                                                {visibleColumns.condition && (
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <span className={`px-2.5 py-1 inline-flex text-[10px] font-black tracking-widest uppercase rounded border ${
                                                            asset?.condition === 'Good' ? 'bg-green-50 text-green-700 border-green-200' : 
                                                            asset?.condition === 'Broken' ? 'bg-red-50 text-red-700 border-red-200' : 
                                                            asset?.condition === 'For Repair' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                                                            asset?.condition === 'Missing' ? 'bg-gray-100 text-gray-700 border-gray-300' : 
                                                            'bg-gray-50 text-gray-700 border-gray-200'
                                                        }`}>
                                                            {asset?.condition || 'Unknown'}
                                                        </span>
                                                    </td>
                                                )}

                                                {visibleColumns.assignedPersonnel && (
                                                    <td className="px-4 py-4 whitespace-nowrap font-black text-indigo-700">
                                                        {asset?.user?.name ? <span>{asset.user.name}</span> : (asset?.assigned_personnel ? <span>{asset.assigned_personnel}</span> : <span className="text-gray-400">-</span>)}
                                                    </td>
                                                )}

                                                {visibleColumns.department && <td className="px-4 py-4 whitespace-nowrap">{asset?.department || '-'}</td>}
                                                {visibleColumns.branch && <td className="px-4 py-4 whitespace-nowrap font-black text-indigo-600">{getBranchValue(asset?.branch) || '-'}</td>}
                                                {visibleColumns.area && <td className="px-4 py-4 whitespace-nowrap">{asset?.area || '-'}</td>}
                                                {visibleColumns.supplier && <td className="px-4 py-4 whitespace-nowrap">{asset?.supplier_name || '-'}</td>}

                                                {visibleColumns.purchasedDate && (
                                                    <td className="px-4 py-4 whitespace-nowrap text-gray-600">
                                                        {safeFormatDate(asset?.purchase_date)}
                                                    </td>
                                                )}

                                                {visibleColumns.warrantyExp && (
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <span className={`${isExpired ? 'text-red-600 font-black' : 'text-gray-600'}`}>
                                                            {safeFormatDate(asset?.warranty_expiration)}
                                                            {isExpired && <span className="ml-2 text-[10px] uppercase tracking-wider text-red-500">(Expired)</span>}
                                                        </span>
                                                    </td>
                                                )}

                                                {visibleColumns.depreciationMonths && (
                                                    <td className="px-4 py-4 whitespace-nowrap text-indigo-700 font-black text-center bg-gray-50/50">
                                                        {calculateDepreciationMonths(asset?.purchase_date)}
                                                    </td>
                                                )}

                                                {visibleColumns.qty && <td className="px-4 py-4 text-center font-black whitespace-nowrap text-gray-900">{asset?.qty || 1}</td>}

                                                {visibleColumns.unitValue && (
                                                    <td className="px-4 py-4 text-right font-black text-emerald-600 whitespace-nowrap">
                                                        ₱{parseFloat(asset?.unit_value || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                                    </td>
                                                )}

                                                {visibleColumns.totalValue && (
                                                    <td className="px-4 py-4 text-right font-black text-emerald-600 whitespace-nowrap">
                                                        ₱{parseFloat(asset?.total_value || (asset?.unit_value * asset?.qty) || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                                    </td>
                                                )}

                                                {visibleColumns.depreciation && (
                                                    <td className="px-4 py-4 text-right font-black text-red-500 whitespace-nowrap">
                                                        - ₱{depData.accumulated.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                                    </td>
                                                )}
                                                {visibleColumns.currentValue && (
                                                    <td className="px-4 py-4 text-right font-black text-emerald-700 whitespace-nowrap bg-emerald-50/50 pr-4">
                                                        ₱{depData.current.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                                    </td>
                                                )}
                                                
                                                {canManageAssets && (
                                                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                                                        <div className="flex justify-end items-center gap-3">
                                                            <button onClick={() => openTransferModal(asset)} className="text-emerald-600 hover:text-emerald-900 font-bold text-xs">Trans</button>
                                                            <button onClick={() => openEditModal(asset)} className="text-indigo-600 hover:text-indigo-900 font-bold text-xs">Edit</button>
                                                            <button onClick={() => handleDelete(asset?.id)} className="text-red-600 hover:text-red-900 font-bold text-xs">Del</button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        )})
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* 🟢 NEW: SCROLL FOOTER */}
                        <div className="bg-white px-5 py-3 border-t border-gray-200 flex items-center justify-between">
                            <p className="text-sm text-gray-500 font-medium">
                                Showing all <span className="font-bold text-gray-900">{displayedAssets.length}</span> results. <span className="text-gray-400 text-xs ml-2">(Scroll vertically to view)</span>
                            </p>
                        </div>
                    </div>
                    
                </div>
            </div>

            <Modal show={confirmDialog.isOpen} onClose={closeConfirm} maxWidth="sm">
                <div className="p-6">
                    <h2 className="text-lg font-black text-gray-900 uppercase tracking-wider">
                        {confirmDialog.title}
                    </h2>
                    <p className="mt-2 text-sm text-gray-500">
                        {confirmDialog.message}
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton onClick={closeConfirm} className="font-black uppercase tracking-wider text-xs">
                            Cancel
                        </SecondaryButton>
                        {confirmDialog.actionType === 'danger' ? (
                            <button 
                                onClick={() => { confirmDialog.onConfirm(); closeConfirm(); }} 
                                className="inline-flex items-center px-4 py-2 bg-red-600 border border-transparent rounded-md font-black text-xs text-white uppercase tracking-wider hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition ease-in-out duration-150"
                            >
                                Confirm
                            </button>
                        ) : (
                            <PrimaryButton 
                                onClick={() => { confirmDialog.onConfirm(); closeConfirm(); }} 
                                className="bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-wider text-xs"
                            >
                                Confirm
                            </PrimaryButton>
                        )}
                    </div>
                </div>
            </Modal>

            <Modal show={isModalOpen} onClose={closeModal} maxWidth="5xl">
                <form onSubmit={handleSubmit} className="p-8">
                    <h2 className="text-2xl font-black text-gray-900 mb-6 border-b pb-4">
                        {isEditMode ? 'Edit Asset Record' : 'Register New Asset'}
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest border-b border-indigo-100 pb-2">Basic Info</h3>
                            <div><InputLabel value="Asset Name" /><TextInput className="w-full mt-1 text-sm font-bold" value={data.name || ''} onChange={e => setData('name', e.target.value)} required /></div>
                            <div><InputLabel value="Asset Tag" /><TextInput className="w-full mt-1 text-sm font-mono font-bold bg-gray-50 text-gray-500" value={data.asset_tag || ''} onChange={e => setData('asset_tag', e.target.value)} required /></div>
                            
                            <div>
                                <InputLabel value="Category" />
                                <div className="flex gap-2 items-center mt-1">
                                    <select className="w-full border-gray-300 rounded-md shadow-sm text-sm font-bold py-2" value={data.category || ''} onChange={e => setData('category', e.target.value)}>
                                        <option value="">Select Category</option>
                                        {allCategories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                                    </select>
                                    <SecondaryButton type="button" onClick={() => setIsAddCategoryModalOpen(true)} className="!px-3 !py-2 h-[38px]" title="Add New Category">➕</SecondaryButton>
                                    <SecondaryButton 
                                        type="button" 
                                        onClick={() => handleDeleteCategory(data.category)} 
                                        className="!px-3 !py-2 h-[38px] !text-red-600 hover:!bg-red-50" 
                                        title="Delete Selected Category"
                                        disabled={!data.category}
                                    >
                                        🗑️
                                    </SecondaryButton>
                                </div>
                            </div>
                            
                            <div><InputLabel value="Classification" /><TextInput className="w-full mt-1 text-sm font-bold" value={data.classification || ''} onChange={e => setData('classification', e.target.value)} placeholder="e.g. Laptop, Chair" /></div>
                            <div>
                                <InputLabel value="Condition" />
                                <select className="w-full mt-1 border-gray-300 rounded-md shadow-sm text-sm font-bold py-2" value={data.condition || 'Good'} onChange={e => setData('condition', e.target.value)}>
                                    <option value="Good">Good</option>
                                    <option value="Broken">Broken</option>
                                    <option value="For Repair">For Repair</option>
                                    <option value="Missing">Missing</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest border-b border-emerald-100 pb-2">Identification</h3>
                            <div><InputLabel value="Model No." /><TextInput className="w-full mt-1 text-sm font-bold" value={data.model_no || ''} onChange={e => setData('model_no', e.target.value)} /></div>
                            <div><InputLabel value="Serial No." /><TextInput className="w-full mt-1 text-sm font-mono font-bold" value={data.serial_no || ''} onChange={e => setData('serial_no', e.target.value)} /></div>
                            <div><InputLabel value="Color" /><TextInput className="w-full mt-1 text-sm font-bold" value={data.color || ''} onChange={e => setData('color', e.target.value)} /></div>
                            <div>
                                <InputLabel value="Asset Status" />
                                <select className="w-full mt-1 border-gray-300 rounded-md shadow-sm text-sm font-bold py-2" value={data.asset_status || 'New'} onChange={e => setData('asset_status', e.target.value)}>
                                    <option value="New">New</option>
                                    <option value="Assigned">Assigned</option>
                                    <option value="In Storage">In Storage</option>
                                    <option value="Disposed">Disposed</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><InputLabel value="Quantity" /><TextInput type="number" min="1" className="w-full mt-1 text-sm text-center font-bold" value={data.qty || ''} onChange={e => setData('qty', e.target.value)} /></div>
                                <div><InputLabel value="Unit Value (₱)" /><TextInput type="number" step="0.01" className="w-full mt-1 text-sm text-right font-bold text-emerald-600" value={data.unit_value || ''} onChange={e => setData('unit_value', e.target.value)} /></div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest border-b border-amber-100 pb-2">Location & Records</h3>
                            <div className="relative">
                                <InputLabel value="Assigned Personnel" />
                                <div className="relative mt-1">
                                    <input
                                        type="text"
                                        className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm text-sm py-2 pl-3 pr-10 cursor-pointer bg-white font-bold"
                                        placeholder="Search personnel..."
                                        value={isUserDropdownOpen ? userSearchTerm : (getSelectedUserName(data.user_id) || '')}
                                        onClick={() => { setIsUserDropdownOpen(true); setUserSearchTerm(''); }}
                                        onChange={(e) => { setUserSearchTerm(e.target.value); setIsUserDropdownOpen(true); }}
                                        onBlur={() => setTimeout(() => setIsUserDropdownOpen(false), 200)}
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                    </div>
                                </div>
                                {isUserDropdownOpen && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                                        <ul className="py-1 text-sm text-gray-700">
                                            <li className={`px-4 py-2 cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 ${!data.user_id ? 'bg-indigo-50 font-bold text-indigo-700' : ''}`}
                                                onMouseDown={(e) => { e.preventDefault(); setData('user_id', ''); setIsUserDropdownOpen(false); }}>
                                                - None -
                                            </li>
                                            {safeUsers.filter(u => u && u.id && getSafeStr(u.name).includes(getSafeStr(userSearchTerm))).map((u) => (
                                                <li key={u.id} className={`px-4 py-2 cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 ${String(data.user_id) === String(u.id) ? 'bg-indigo-50 font-bold text-indigo-700' : ''}`}
                                                    onMouseDown={(e) => { e.preventDefault(); setData('user_id', u.id); setIsUserDropdownOpen(false); }}>
                                                    {u.name}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <div>
                                <InputLabel value="Branch" />
                                <select className="w-full mt-1 border-gray-300 rounded-md shadow-sm text-sm font-bold py-2" value={data.branch || ''} onChange={e => setData('branch', e.target.value)}>
                                    <option value="">Select Branch</option>
                                    {safeBranches.map((b, idx) => { if(!b) return null; const bn = typeof b === 'object' ? (b.name || '') : String(b); return bn ? <option key={idx} value={bn}>{bn}</option> : null; })}
                                </select>
                            </div>
                            
                            <div>
                                <InputLabel value="Department" />
                                <select className="w-full mt-1 border-gray-300 rounded-md shadow-sm text-sm font-bold py-2" value={data.department || ''} onChange={e => setData('department', e.target.value)}>
                                    <option value="">Select Department</option>
                                    {allDepartments.map((dept, idx) => <option key={idx} value={dept}>{dept}</option>)}
                                </select>
                            </div>

                            <div>
                                <InputLabel value="Area" className="font-black text-xs" />
                                <div className="flex gap-2 items-center mt-1">
                                    <select className="block w-full border-gray-300 rounded-md shadow-sm text-sm font-bold flex-1" value={data.area || ''} onChange={e => setData('area', e.target.value)}>
                                        <option value="">Select Area</option>
                                        {allAreas.map((area, idx) => <option key={idx} value={area}>{area}</option>)}
                                    </select>
                                    <SecondaryButton type="button" onClick={() => setIsAddAreaModalOpen(true)} className="!px-3 !py-2 h-[38px]" title="Add New Area">➕</SecondaryButton>
                                    <SecondaryButton 
                                        type="button" 
                                        onClick={() => handleDeleteArea(data.area)} 
                                        className="!px-3 !py-2 h-[38px] !text-red-600 hover:!bg-red-50" 
                                        title="Delete Selected Area"
                                        disabled={!data.area}
                                    >
                                        🗑️
                                    </SecondaryButton>
                                </div>
                            </div>

                            <div><InputLabel value="Supplier Name" /><TextInput className="w-full mt-1 text-sm font-bold" value={data.supplier_name || ''} onChange={e => setData('supplier_name', e.target.value)} placeholder="e.g. PC Express" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-1"><InputLabel value="Purchased Date" /><TextInput type="date" className="w-full mt-1 text-xs font-bold" value={data.purchase_date || ''} onChange={e => setData('purchase_date', e.target.value)} /></div>
                                <div className="col-span-1">
                                    <InputLabel value="Warranty Exp." />
                                    <TextInput type="date" className="w-full mt-1 text-xs font-bold" value={data.warranty_expiration || ''} onChange={e => setData('warranty_expiration', e.target.value)} />
                                    {errors.warranty_expiration && <InputError message={errors.warranty_expiration} className="mt-2" />}
                                </div>
                            </div>
                            <div><InputLabel value="Depreciation (Months)" /><TextInput className="w-full mt-1 text-xs font-bold bg-gray-100 text-gray-500 cursor-not-allowed" value={calculateDepreciationMonths(data.purchase_date)} readOnly placeholder="Auto-calc" /></div>
                        </div>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <InputLabel value="Asset Image (Optional)" className="mb-2" />
                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                            <div className="w-full sm:w-1/3">
                                <input 
                                    type="file" accept="image/*"
                                    onChange={e => {
                                        setData('image', e.target.files[0]);
                                        if(e.target.files[0]) setImagePreview(URL.createObjectURL(e.target.files[0]));
                                    }}
                                    className="w-full block text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer border border-gray-200 rounded" 
                                />
                                {errors.image && <InputError message={errors.image} className="mt-2" />}
                            </div>
                            <div className="w-full sm:w-2/3">
                                <div className="w-full h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center">
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="Preview" className="h-full w-full object-contain p-2" />
                                    ) : (
                                        <div className="text-center">
                                            <svg className="mx-auto h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            <span className="mt-2 block text-xs font-medium text-gray-400">No Image Uploaded</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-6">
                        <SecondaryButton type="button" onClick={closeModal} className="font-black uppercase tracking-wider text-xs">Cancel</SecondaryButton>
                        <PrimaryButton type="submit" disabled={processing} className="font-black uppercase tracking-wider text-xs bg-indigo-600 hover:bg-indigo-700">
                            {isEditMode ? 'Update Asset Data' : 'Save New Asset'}
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            <Modal show={isViewModalOpen} onClose={closeViewModal} maxWidth="3xl">
                {viewingAsset && (
                    <div className="p-8">
                        <div className="flex justify-between items-start mb-6 border-b pb-4">
                            <div className="flex gap-6 items-center">
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900">{viewingAsset?.name}</h2>
                                    <p className="text-sm font-bold text-indigo-600 mt-1 uppercase tracking-wider">{viewingAsset?.asset_tag}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className={`px-4 py-1.5 inline-flex text-[10px] font-black uppercase tracking-widest rounded-full border ${
                                    viewingAsset?.condition === 'Good' ? 'bg-green-50 text-green-700 border-green-200' : 
                                    viewingAsset?.condition === 'Broken' ? 'bg-red-50 text-red-700 border-red-200' : 
                                    viewingAsset?.condition === 'For Repair' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                                    viewingAsset?.condition === 'Missing' ? 'bg-gray-100 text-gray-700 border-gray-300' : 
                                    'bg-gray-50 text-gray-700 border-gray-200'
                                }`}>
                                    {viewingAsset?.condition || 'Unknown'}
                                </span>
                                <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">
                                    Status: <span className="text-gray-700">{viewingAsset?.asset_status || 'Assigned'}</span>
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-sm">
                            <div className="space-y-4 bg-gray-50 p-5 rounded-lg border border-gray-100">
                                <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">Specifications</h4>
                                <div className="flex justify-between border-b border-gray-200 pb-2"><span className="text-gray-500 font-bold text-xs">Category:</span> <span className="font-black text-gray-900 text-xs">{viewingAsset?.category || 'N/A'}</span></div>
                                <div className="flex justify-between border-b border-gray-200 pb-2"><span className="text-gray-500 font-bold text-xs">Classification:</span> <span className="font-black text-gray-900 text-xs">{viewingAsset?.classification || 'N/A'}</span></div>
                                <div className="flex justify-between border-b border-gray-200 pb-2"><span className="text-gray-500 font-bold text-xs">Model No:</span> <span className="font-black text-gray-900 text-xs">{viewingAsset?.model_no || 'N/A'}</span></div>
                                <div className="flex justify-between border-b border-gray-200 pb-2"><span className="text-gray-500 font-bold text-xs">Serial No:</span> <span className="font-black font-mono text-gray-900 text-xs">{viewingAsset?.serial_no || 'N/A'}</span></div>
                                <div className="flex justify-between pb-1"><span className="text-gray-500 font-bold text-xs">Color:</span> <span className="font-black text-gray-900 text-xs">{viewingAsset?.color || 'N/A'}</span></div>
                            </div>

                            <div className="space-y-4 bg-indigo-50/50 p-5 rounded-lg border border-indigo-50">
                                <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-wider mb-2">Assignment Details</h4>
                                <div className="flex justify-between border-b border-indigo-100 pb-2">
                                    <span className="text-gray-500 font-bold text-xs">Assigned To:</span> 
                                    <span className="font-black text-indigo-700 text-xs text-right">
                                        {viewingAsset?.user ? viewingAsset?.user?.name : (viewingAsset?.assigned_personnel || '-')}
                                    </span>
                                </div>
                                <div className="flex justify-between border-b border-indigo-100 pb-2"><span className="text-gray-500 font-bold text-xs">Branch:</span> <span className="font-black text-gray-900 text-xs">{getBranchValue(viewingAsset?.branch) || 'N/A'}</span></div>
                                <div className="flex justify-between border-b border-indigo-100 pb-2"><span className="text-gray-500 font-bold text-xs">Department:</span> <span className="font-black text-gray-900 text-xs">{viewingAsset?.department || 'N/A'}</span></div>
                                <div className="flex justify-between pb-1"><span className="text-gray-500 font-bold text-xs">Area:</span> <span className="font-black text-gray-900 text-xs">{viewingAsset?.area || 'N/A'}</span></div>
                            </div>

                            <div className="space-y-4 bg-emerald-50/50 p-5 rounded-lg border border-emerald-50 md:col-span-2">
                                <h4 className="text-[11px] font-black text-emerald-500 uppercase tracking-wider mb-2">Procurement & Financials</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                    <div className="flex justify-between border-b border-emerald-100 pb-2"><span className="text-gray-500 font-bold text-xs">Supplier:</span> <span className="font-black text-gray-900 text-xs">{viewingAsset?.supplier_name || 'N/A'}</span></div>
                                    <div className="flex justify-between border-b border-emerald-100 pb-2"><span className="text-gray-500 font-bold text-xs">Purchase Date:</span> <span className="font-black text-gray-900 text-xs">{safeFormatDate(viewingAsset?.purchase_date)}</span></div>
                                    <div className="flex justify-between border-b border-emerald-100 pb-2">
                                        <span className="text-gray-500 font-bold text-xs">Warranty Exp:</span> 
                                        <span className={`font-black text-xs ${isWarrantyExpired(viewingAsset?.warranty_expiration) ? 'text-red-600' : 'text-gray-900'}`}>
                                            {safeFormatDate(viewingAsset?.warranty_expiration)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between border-b border-emerald-100 pb-2">
                                        <span className="text-gray-500 font-bold text-xs">Depreciation Time:</span> 
                                        <span className="font-black text-gray-900 text-xs">{calculateDepreciationMonths(viewingAsset?.purchase_date)}</span>
                                    </div>
                                    
                                    <div className="flex justify-between border-b border-emerald-100 pb-2 mt-2">
                                        <span className="text-gray-500 font-bold text-xs">Original Value (Qty {viewingAsset?.qty || 1}):</span> 
                                        <span className="font-black text-gray-900 text-xs">₱{parseFloat(viewingAsset?.total_value || (viewingAsset?.unit_value * viewingAsset?.qty) || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-emerald-100 pb-2">
                                        <span className="text-gray-500 font-bold text-xs">Accumulated Depreciation:</span> 
                                        <span className="font-black text-red-500 text-xs">- ₱{getDepreciationData(viewingAsset).accumulated.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                                    </div>
                                    <div className="flex justify-between pb-1 pt-2 bg-emerald-100/50 px-2 rounded -mx-2">
                                        <span className="text-emerald-800 font-black text-xs uppercase">Current Book Value:</span> 
                                        <span className="font-black text-emerald-700 text-sm">₱{getDepreciationData(viewingAsset).current.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {viewingAsset?.image_path && (
                            <div className="mt-8 pt-6 border-t border-gray-100">
                                <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-4">Attached Image</h4>
                                <div className="w-full bg-gray-100 rounded-xl border border-gray-200 overflow-hidden flex items-center justify-center shadow-inner p-2">
                                    <img 
                                        src={viewingAsset.image_path.startsWith('http') ? viewingAsset.image_path : `/storage/${viewingAsset.image_path}`} 
                                        alt={viewingAsset?.name} 
                                        className="w-full h-auto max-h-[800px] object-contain rounded-lg" 
                                        onError={(e) => {
                                            e.target.onerror = null; 
                                            e.target.src = "https://placehold.co/800x400/eeeeee/999999?text=Image+Not+Found+-+Run+storage:link";
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="mt-8 flex justify-end">
                            <PrimaryButton type="button" onClick={closeViewModal} className="font-black tracking-widest uppercase text-xs">Close</PrimaryButton>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal show={isAddCategoryModalOpen} onClose={() => setIsAddCategoryModalOpen(false)} maxWidth="sm">
                <form onSubmit={handleAddCategory} className="p-6">
                    <h2 className="text-lg font-black text-gray-900 mb-4 uppercase tracking-wider">Add New Category</h2>
                    <div>
                        <InputLabel value="Category Name" className="font-black text-xs" />
                        <TextInput 
                            className="w-full mt-1 text-sm font-bold" 
                            value={newCategoryName} 
                            onChange={e => setNewCategoryName(e.target.value)} 
                            placeholder="e.g. IT Equipment, Vehicles..." 
                            required autoFocus
                        />
                        <p className="text-[10px] text-gray-500 mt-2 font-bold">
                            Typing a category here allows you to immediately assign it to an asset. 
                        </p>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton type="button" onClick={() => setIsAddCategoryModalOpen(false)} className="font-black uppercase tracking-wider text-xs">Cancel</SecondaryButton>
                        <PrimaryButton type="submit" className="font-black uppercase tracking-wider text-xs">Apply Category</PrimaryButton>
                    </div>
                </form>
            </Modal>

            <Modal show={isAddAreaModalOpen} onClose={() => setIsAddAreaModalOpen(false)} maxWidth="sm">
                <form onSubmit={handleAddArea} className="p-6">
                    <h2 className="text-lg font-black text-gray-900 mb-4 uppercase tracking-wider">Add New Area</h2>
                    <div>
                        <InputLabel value="Area Name" className="font-black text-xs" />
                        <TextInput 
                            className="w-full mt-1 text-sm font-bold" 
                            value={newAreaName} 
                            onChange={e => setNewAreaName(e.target.value)} 
                            placeholder="e.g. IT Office, Warehouse..." 
                            required autoFocus
                        />
                        <p className="text-[10px] text-gray-500 mt-2 font-bold">
                            Typing an area here allows you to immediately assign it to an asset. 
                        </p>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton type="button" onClick={() => setIsAddAreaModalOpen(false)} className="font-black uppercase tracking-wider text-xs">Cancel</SecondaryButton>
                        <PrimaryButton type="submit" className="font-black uppercase tracking-wider text-xs">Apply Area</PrimaryButton>
                    </div>
                </form>
            </Modal>

            <Modal show={isBulkTransferModalOpen} onClose={closeBulkTransferModal} maxWidth="md">
                <form onSubmit={handleBulkTransferSubmit} className="p-6">
                    <h2 className="text-xl font-black text-gray-900 mb-6 uppercase tracking-wider">Bulk Transfer Assets</h2>
                    <div className="space-y-4">
                        <div className="relative">
                            <InputLabel value="New Assigned Personnel" className="font-black text-xs" />
                            <div className="relative mt-1">
                                <input
                                    type="text"
                                    className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm text-sm font-bold py-2 pl-3 pr-10 cursor-pointer bg-white"
                                    placeholder="Search personnel..."
                                    value={isUserDropdownOpen ? userSearchTerm : (getSelectedUserName(bulkTransferForm.data.user_id) || '')}
                                    onClick={() => { setIsUserDropdownOpen(true); setUserSearchTerm(''); }}
                                    onChange={(e) => { setUserSearchTerm(e.target.value); setIsUserDropdownOpen(true); }}
                                    onBlur={() => setTimeout(() => setIsUserDropdownOpen(false), 200)}
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </div>
                            </div>
                            {isUserDropdownOpen && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                                    <ul className="py-1 text-sm font-bold text-gray-700">
                                        <li className={`px-4 py-2 cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 ${!bulkTransferForm.data.user_id ? 'bg-indigo-50 font-black text-indigo-700' : ''}`}
                                            onMouseDown={(e) => { e.preventDefault(); bulkTransferForm.setData('user_id', ''); setIsUserDropdownOpen(false); }}>
                                            - None -
                                        </li>
                                        {safeUsers.filter(u => u && u.id && getSafeStr(u.name).includes(getSafeStr(userSearchTerm))).map((u) => (
                                            <li key={u.id} className={`px-4 py-2 cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 ${String(bulkTransferForm.data.user_id) === String(u.id) ? 'bg-indigo-50 font-black text-indigo-700' : ''}`}
                                                onMouseDown={(e) => { e.preventDefault(); bulkTransferForm.setData('user_id', u.id); setIsUserDropdownOpen(false); }}>
                                                {u.name}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div>
                            <InputLabel value="New Branch" className="font-black text-xs" />
                            <select className="w-full mt-1 border-gray-300 rounded-md shadow-sm text-sm font-bold py-2" value={bulkTransferForm.data.branch || ''} onChange={e => bulkTransferForm.setData('branch', e.target.value)}>
                                <option value="">Select Branch</option>
                                {safeBranches.map((b, idx) => { if(!b) return null; const bn = typeof b === 'object' ? (b.name || '') : String(b); return bn ? <option key={idx} value={bn}>{bn}</option> : null; })}
                            </select>
                        </div>
                        
                        <div>
                            <InputLabel value="New Department" className="font-black text-xs" />
                            <select className="w-full mt-1 border-gray-300 rounded-md shadow-sm text-sm font-bold py-2" value={bulkTransferForm.data.department || ''} onChange={e => bulkTransferForm.setData('department', e.target.value)}>
                                <option value="">Select Department</option>
                                {allDepartments.map((dept, idx) => <option key={idx} value={dept}>{dept}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="mt-8 flex justify-end gap-3 border-t pt-4">
                        <SecondaryButton type="button" onClick={closeBulkTransferModal} className="font-black uppercase tracking-wider text-xs">Cancel</SecondaryButton>
                        <PrimaryButton type="submit" disabled={bulkTransferForm.processing} className="font-black uppercase tracking-wider text-xs">Apply Action</PrimaryButton>
                    </div>
                </form>
            </Modal>

            <Modal show={isTransferModalOpen} onClose={closeTransferModal} maxWidth="md">
                <form onSubmit={handleTransferSubmit} className="p-6">
                    <h2 className="text-xl font-black text-gray-900 mb-6 uppercase tracking-wider">Transfer Asset</h2>
                    <div className="space-y-4">
                        <div className="relative">
                            <InputLabel value="New Assigned Personnel" className="font-black text-xs" />
                            <div className="relative mt-1">
                                <input
                                    type="text"
                                    className="w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm text-sm font-bold py-2 pl-3 pr-10 cursor-pointer bg-white"
                                    placeholder="Search personnel..."
                                    value={isUserDropdownOpen ? userSearchTerm : (getSelectedUserName(data.user_id) || '')}
                                    onClick={() => { setIsUserDropdownOpen(true); setUserSearchTerm(''); }}
                                    onChange={(e) => { setUserSearchTerm(e.target.value); setIsUserDropdownOpen(true); }}
                                    onBlur={() => setTimeout(() => setIsUserDropdownOpen(false), 200)}
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </div>
                            </div>
                            {isUserDropdownOpen && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                                    <ul className="py-1 text-sm font-bold text-gray-700">
                                        <li className={`px-4 py-2 cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 ${!data.user_id ? 'bg-indigo-50 font-black text-indigo-700' : ''}`}
                                            onMouseDown={(e) => { e.preventDefault(); setData('user_id', ''); setIsUserDropdownOpen(false); }}>
                                            - None -
                                        </li>
                                        {safeUsers.filter(u => u && u.id && getSafeStr(u.name).includes(getSafeStr(userSearchTerm))).map((u) => (
                                            <li key={u.id} className={`px-4 py-2 cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 ${String(data.user_id) === String(u.id) ? 'bg-indigo-50 font-black text-indigo-700' : ''}`}
                                                onMouseDown={(e) => { e.preventDefault(); setData('user_id', u.id); setIsUserDropdownOpen(false); }}>
                                                {u.name}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div>
                            <InputLabel value="New Branch" className="font-black text-xs" />
                            <select className="w-full mt-1 border-gray-300 rounded-md shadow-sm text-sm font-bold py-2" value={data.branch || ''} onChange={e => setData('branch', e.target.value)}>
                                <option value="">Select Branch</option>
                                {safeBranches.map((b, idx) => { if(!b) return null; const bn = typeof b === 'object' ? (b.name || '') : String(b); return bn ? <option key={idx} value={bn}>{bn}</option> : null; })}
                            </select>
                        </div>
                        
                        <div>
                            <InputLabel value="New Department" className="font-black text-xs" />
                            <select className="w-full mt-1 border-gray-300 rounded-md shadow-sm text-sm font-bold py-2" value={data.department || ''} onChange={e => setData('department', e.target.value)}>
                                <option value="">Select Department</option>
                                {allDepartments.map((dept, idx) => <option key={idx} value={dept}>{dept}</option>)}
                            </select>
                        </div>
                        
                        <div>
                            <InputLabel value="Area" className="font-black text-xs" />
                            <div className="flex gap-2 items-center mt-1">
                                <select className="block w-full border-gray-300 rounded-md shadow-sm text-sm font-bold flex-1" value={data.area || ''} onChange={e => setData('area', e.target.value)}>
                                    <option value="">Select Area</option>
                                    {allAreas.map((area, idx) => <option key={idx} value={area}>{area}</option>)}
                                </select>
                                <SecondaryButton type="button" onClick={() => setIsAddAreaModalOpen(true)} className="!px-3 !py-2 h-[38px]" title="Add New Area">➕</SecondaryButton>
                                <SecondaryButton 
                                    type="button" 
                                    onClick={() => handleDeleteArea(data.area)} 
                                    className="!px-3 !py-2 h-[38px] !text-red-600 hover:!bg-red-50" 
                                    title="Delete Selected Area"
                                    disabled={!data.area}
                                >
                                    🗑️
                                </SecondaryButton>
                            </div>
                        </div>

                    </div>

                    <div className="mt-8 flex justify-end gap-3 border-t pt-4">
                        <SecondaryButton type="button" onClick={closeTransferModal} className="font-black uppercase tracking-wider text-xs">Cancel</SecondaryButton>
                        <PrimaryButton type="submit" disabled={processing} className="font-black uppercase tracking-wider text-xs">Confirm</PrimaryButton>
                    </div>
                </form>
            </Modal>

            <Modal show={isImportModalOpen} onClose={closeImportModal} maxWidth="md">
                <form onSubmit={handleImportSubmit} className="p-6">
                    <h2 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-wider">Upload Asset File</h2>
                    <p className="text-sm font-bold text-gray-500 mb-4">Please upload your completed Asset Template in CSV format.</p>
                    
                    {importError && (
                        <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-200">
                            <strong>Upload Failed:</strong> {importError}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <InputLabel value="Select CSV File" className="font-black text-xs" />
                            <input 
                                type="file" 
                                className="w-full mt-2 block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer border border-gray-300 rounded-md" 
                                accept=".csv" 
                                onChange={e => setImportFile(e.target.files[0])} 
                                required 
                            />
                        </div>
                    </div>
                    
                    <div className="mt-8 flex justify-end gap-3 border-t pt-4">
                        <SecondaryButton type="button" onClick={closeImportModal} className="font-black uppercase tracking-wider text-xs">Cancel</SecondaryButton>
                        <PrimaryButton type="submit" disabled={isUploading} className="bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-wider text-xs">
                            {isUploading ? 'Uploading...' : 'Upload File'}
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            {/* CUSTOM SYSTEM ALERT MODAL */}
            <Modal show={alertDialog.isOpen} onClose={closeAlert} maxWidth="sm">
                <div className="p-6 text-center">
                    <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${alertDialog.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {alertDialog.type === 'success' ? (
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        )}
                    </div>
                    <h2 className="text-lg font-black text-gray-900 uppercase tracking-wider mb-2">
                        {alertDialog.title}
                    </h2>
                    <p className="text-sm text-gray-500 mb-6">
                        {alertDialog.message}
                    </p>
                    <div className="flex justify-center">
                        <PrimaryButton onClick={closeAlert} className={`font-black uppercase tracking-wider text-xs ${alertDialog.type === 'success' ? '!bg-emerald-600 hover:!bg-emerald-700' : '!bg-red-600 hover:!bg-red-700'}`}>
                            Okay
                        </PrimaryButton>
                    </div>
                </div>
            </Modal>

        </SidebarLayout>
    );
}