import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import Modal from '@/Components/Modal';
import TextInput from '@/Components/TextInput';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
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

export default function MyAssets({ auth, myAssets }) {
    const assetLinks = typeof getAssetLinks === 'function' ? getAssetLinks(auth) : []; 
    const departmentName = auth?.user?.department?.name || auth?.user?.department || 'Your Department';
    const isSuperAdmin = ['admin', 'super admin', 'director of corporate services and operations'].includes(String(auth?.user?.role?.name || auth?.user?.role || '').toLowerCase().trim());
    
    // SAFE DATA ARRAYS
    const rawAssets = getArray(myAssets);

    const getBranchValue = (branchData) => {
        if (!branchData) return '';
        if (typeof branchData === 'object' && branchData.name) return branchData.name;
        return String(branchData);
    };

    const safeBranches = [...new Set(rawAssets.map(a => getBranchValue(a?.branch)).filter(Boolean))].sort();
    const allCategories = [...new Set(rawAssets.map(a => a?.category).filter(Boolean))].sort();

    // 🟢 CUSTOM CONFIRMATION DIALOG STATE
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false, title: '', message: '', actionType: 'danger', onConfirm: null,
    });
    const triggerConfirm = (title, message, onConfirm, actionType = 'danger') => {
        setConfirmDialog({ isOpen: true, title, message, actionType, onConfirm });
    };
    const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

    // 🟢 NEW: CUSTOM SYSTEM ALERT MODAL STATE
    const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'success' });
    const closeAlert = () => setAlertDialog(prev => ({ ...prev, isOpen: false }));

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

    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterBranch, setFilterBranch] = useState(''); 
    const [filterCondition, setFilterCondition] = useState(''); 
    const [filterWarranty, setFilterWarranty] = useState(''); 
    const [dateRangeType, setDateRangeType] = useState('All Time');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    
    // 🟢 SELECTION STATE
    const [selectedAssets, setSelectedAssets] = useState([]);
    const [showOnlySelected, setShowOnlySelected] = useState(false);

    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingAsset, setViewingAsset] = useState(null);

    const openViewModal = (asset) => { setViewingAsset(asset); setIsViewModalOpen(true); };
    const closeViewModal = () => { setIsViewModalOpen(false); setTimeout(() => setViewingAsset(null), 300); };

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
        let totalItems = 0; let totalValue = 0; let assignedCount = 0; let needsMaintenance = 0; let totalCurrentValue = 0; let totalAccumulatedDepreciation = 0;
        const branchBreakdown = {};
        const conditionBreakdown = { 'Good': 0, 'Broken': 0, 'For Repair': 0, 'Missing': 0 };

        safeBranches.forEach(b => {
            const bName = typeof b === 'object' ? (b?.name || '') : String(b);
            if (bName) branchBreakdown[bName] = { items: 0, value: 0, currentValue: 0 };
        });

        rawAssets.forEach(asset => {
            if (!asset) return; 

            const matchesBranch = filterBranch ? getBranchValue(asset?.branch) === filterBranch : true;
            const matchesCategory = filterCategory ? asset?.category === filterCategory : true;
            const matchesCondition = filterCondition ? asset?.condition === filterCondition : true;
            const matchesDate = isDateInRange(asset, dateRangeType, customStartDate, customEndDate);
            
            let matchesWarranty = true;
            if (filterWarranty === 'Valid') { matchesWarranty = asset.warranty_expiration && !isWarrantyExpired(asset.warranty_expiration); } 
            else if (filterWarranty === 'Expired') { matchesWarranty = isWarrantyExpired(asset.warranty_expiration); }

            if (!(matchesBranch && matchesCategory && matchesDate && matchesCondition && matchesWarranty)) return;

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
            
            if (asset?.user_id || asset?.assigned_personnel || asset?.asset_status === 'Assigned') assignedCount++;
            if (['Broken', 'For Repair', 'Missing'].includes(asset?.condition)) needsMaintenance++;

            const branchKey = getBranchValue(asset?.branch) || 'Unassigned';
            if (!branchBreakdown[branchKey]) branchBreakdown[branchKey] = { items: 0, value: 0, currentValue: 0 };
            branchBreakdown[branchKey].items += qty;
            branchBreakdown[branchKey].value += val;
            branchBreakdown[branchKey].currentValue += depData.current;

            const cond = asset?.condition || 'Good';
            conditionBreakdown[cond] = (conditionBreakdown[cond] || 0) + qty;
        });

        return { totalItems, totalValue, totalCurrentValue, totalAccumulatedDepreciation, assignedCount, needsMaintenance, branchBreakdown, conditionBreakdown };
    }, [rawAssets, safeBranches, filterBranch, filterCategory, filterWarranty, dateRangeType, customStartDate, customEndDate, filterCondition]);

    const filteredAssets = useMemo(() => {
        return rawAssets.filter(asset => {
            if (!asset) return false; 
            
            const searchTerm = getSafeStr(search);
            const safeName = getSafeStr(asset?.name);
            const safeTag = getSafeStr(asset?.asset_tag);
            const safeSerial = getSafeStr(asset?.serial_no);

            const matchesSearch = safeName.includes(searchTerm) || safeTag.includes(searchTerm) || safeSerial.includes(searchTerm);
            const matchesCategory = filterCategory ? asset?.category === filterCategory : true;
            const matchesBranch = filterBranch ? getBranchValue(asset?.branch) === filterBranch : true;
            const matchesCondition = filterCondition ? asset?.condition === filterCondition : true;
            const matchesDate = isDateInRange(asset, dateRangeType, customStartDate, customEndDate);
            
            let matchesWarranty = true;
            if (filterWarranty === 'Valid') { matchesWarranty = asset.warranty_expiration && !isWarrantyExpired(asset.warranty_expiration); } 
            else if (filterWarranty === 'Expired') { matchesWarranty = isWarrantyExpired(asset.warranty_expiration); }

            return matchesSearch && matchesCategory && matchesBranch && matchesDate && matchesCondition && matchesWarranty;
        });
    }, [rawAssets, search, filterCategory, filterBranch, filterWarranty, dateRangeType, customStartDate, customEndDate, filterCondition]);

    // 🟢 RENDER ALL ASSETS IN THE TABLE
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

    const handleSelectOne = (e, id) => setSelectedAssets(prev => e.target.checked ? [...prev, id] : prev.filter(item => item !== id));

    const handleExport = () => {
        if (displayedAssets.length === 0) {
            setAlertDialog({ isOpen: true, title: 'Export Failed', message: 'No assets found for the current view configuration.', type: 'error' });
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
        link.setAttribute("download", `Department_Assets_Export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        
        if (isSuperAdmin) {
            try {
                router.post(route('admin.assets.log-export'), {}, { preserveScroll: true, preserveState: true });
            } catch (e) { console.log('Export logged locally'); }
        }
    };

    return (
        <SidebarLayout 
            activeModule="Assets" 
            sidebarLinks={assetLinks}
            header={
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center w-full gap-4">
                    <h2 className="font-semibold text-xl text-gray-800 leading-tight">
                        Accountability Module <span className="text-xs ml-2 bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full uppercase tracking-wider">{departmentName} View</span>
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

                            <SecondaryButton onClick={handleExport} className="!border-gray-300 text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 shadow-sm py-2 justify-center gap-2 whitespace-nowrap">
                                <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                Export
                            </SecondaryButton>
                        </div>
                    </div>
                </div>
            }
        >
            <Head title="Accountability Module" />
            <div className="py-6 sm:py-12">
                <div className="max-w-[100rem] mx-auto sm:px-6 lg:px-8">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg></div>
                            <div><p className="text-[11px] font-black text-gray-500 uppercase tracking-tighter">Department Items</p><p className="text-2xl font-black text-gray-900">{stats.totalItems}</p></div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                            <div><p className="text-[11px] font-black text-gray-500 uppercase tracking-tighter">Total Est. Value</p><p className="text-2xl font-black text-gray-900">₱ {stats.totalValue.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p></div>
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

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center relative">
                            <div className="flex items-center gap-4 mb-3">
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                                <div><p className="text-[11px] font-black text-gray-500 uppercase tracking-tighter">Needs Action</p><p className="text-2xl font-black text-gray-900">{stats.needsMaintenance}</p></div>
                            </div>
                            <div className="flex gap-2 text-[9px] font-black uppercase tracking-widest border-t border-gray-50 pt-2">
                                <span className="text-red-500">Broken: {stats.conditionBreakdown?.['Broken'] || 0}</span>
                                <span className="text-yellow-600">Repair: {stats.conditionBreakdown?.['For Repair'] || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <InputLabel value="Search Department Assets" className="font-black tracking-tighter text-xs" />
                            <TextInput className="w-full mt-1 text-xs font-bold" placeholder="Search by name, tag, or serial no..." value={search} onChange={e => setSearch(e.target.value)} />
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
                    </div>

                    <div className="flex items-center gap-3 mb-6 mt-2 border-b border-gray-200 pb-4">
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
                    </div>

                    {/* 🟢 FIXED-HEIGHT SCROLLABLE TABLE CONTAINER (Referencing Asset2.jsx) */}
                    <div className="bg-white rounded-lg shadow border border-gray-200 w-full flex flex-col mb-6 overflow-hidden">
                        <div className="overflow-auto max-h-[550px] w-full relative">
                            <table className="min-w-full table-auto divide-y divide-gray-200 relative">
                                <thead className="bg-gray-100 sticky top-0 z-20 shadow-sm border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-4 text-center w-6 whitespace-nowrap border-r border-gray-200">
                                            <input type="checkbox" className="rounded border-gray-300 text-indigo-600 shadow-sm h-4 w-4" checked={displayedAssets.length > 0 && selectedAssets.length === displayedAssets.length} onChange={(e) => e.target.checked ? handleToggleSelectAll() : handleToggleSelectAll()} />
                                        </th>
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

                                        <th className="px-4 py-4 text-right text-xs font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap bg-gray-50">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {(!Array.isArray(displayedAssets) || displayedAssets.length === 0) ? (
                                        <tr>
                                            <td colSpan="22" className="px-4 py-16 text-center">
                                                <p className="text-gray-500 font-bold text-lg">No assets assigned yet.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedAssets.map((asset, index) => {
                                            if (!asset) return null;
                                            
                                            const depData = getDepreciationData(asset);
                                            const isExpired = isWarrantyExpired(asset?.warranty_expiration);
                                            const isSelected = selectedAssets.includes(asset.id);
                                            
                                            return (
                                            <tr key={asset.id} className={`hover:bg-indigo-50/50 transition-colors text-sm font-bold text-gray-800 ${isSelected ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}>
                                                <td className="px-4 py-4 text-center whitespace-nowrap border-r border-gray-100">
                                                    <input type="checkbox" className="rounded border-gray-300 text-indigo-600 shadow-sm h-4 w-4" checked={isSelected} onChange={(e) => handleSelectOne(e, asset.id)} />
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap pl-4">
                                                    <button type="button" onClick={() => openViewModal(asset)} className="font-black text-indigo-700 hover:text-indigo-900 hover:underline">{asset.name}</button>
                                                </td>
                                                {visibleColumns.assetTag && <td className="px-4 py-4 font-mono whitespace-nowrap text-gray-600 font-bold">{asset?.asset_tag}</td>}
                                                {visibleColumns.serialNo && <td className="px-4 py-4 font-mono whitespace-nowrap text-gray-600 font-bold">{asset?.serial_no || '-'}</td>}
                                                {visibleColumns.modelNo && <td className="px-4 py-4 whitespace-nowrap">{asset?.model_no || '-'}</td>}
                                                {visibleColumns.color && <td className="px-4 py-4 whitespace-nowrap">{asset?.color || '-'}</td>}
                                                {visibleColumns.category && <td className="px-4 py-4 whitespace-nowrap">{asset?.category || '-'}</td>}
                                                {visibleColumns.status && <td className="px-4 py-4 font-black whitespace-nowrap text-gray-900">{asset?.asset_status || 'New'}</td>}
                                                
                                                {visibleColumns.condition && (
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <span className={`px-2.5 py-1 inline-flex text-xs font-black uppercase tracking-widest rounded border ${
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

                                                {visibleColumns.purchasedDate && <td className="px-4 py-4 whitespace-nowrap text-gray-600">{safeFormatDate(asset.purchase_date)}</td>}
                                                
                                                {visibleColumns.warrantyExp && (
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <span className={`${isExpired ? 'text-red-600 font-black' : 'text-gray-600'}`}>
                                                            {safeFormatDate(asset?.warranty_expiration)}
                                                            {isExpired && <span className="ml-2 text-[10px] uppercase tracking-wider text-red-500">(Expired)</span>}
                                                        </span>
                                                    </td>
                                                )}

                                                {visibleColumns.depreciationMonths && <td className="px-4 py-4 whitespace-nowrap text-indigo-700 font-black text-center bg-gray-50/50">{calculateDepreciationMonths(asset?.purchase_date)}</td>}
                                                {visibleColumns.qty && <td className="px-4 py-4 text-center font-black whitespace-nowrap text-gray-900">{asset.qty || 1}</td>}
                                                {visibleColumns.unitValue && <td className="px-4 py-4 whitespace-nowrap font-black text-emerald-600 text-right">₱{parseFloat(asset.unit_value || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>}
                                                {visibleColumns.totalValue && <td className="px-4 py-4 whitespace-nowrap font-black text-emerald-600 text-right">₱{parseFloat(asset.total_value || (asset.unit_value * asset.qty) || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>}

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

                                                <td className="px-4 py-4 whitespace-nowrap text-right font-medium">
                                                    <PrimaryButton onClick={() => openViewModal(asset)} className="!py-1.5 !px-4 !text-[10px] font-black uppercase tracking-wider">View Details</PrimaryButton>
                                                </td>
                                            </tr>
                                        )})
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* 🟢 SCROLL FOOTER */}
                        <div className="bg-white px-5 py-3 border-t border-gray-200 flex items-center justify-between">
                            <p className="text-sm text-gray-500 font-medium">
                                Showing all <span className="font-bold text-gray-900">{displayedAssets.length}</span> results. <span className="text-gray-400 text-xs ml-2">(Scroll vertically to view)</span>
                            </p>
                        </div>
                    </div>
                    
                </div>
            </div>

            {/* 🟢 NEW SYSTEM ALERT MODAL UI */}
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

            {/* FULLY SYNCED VIEW DETAILS MODAL */}
            <Modal show={isViewModalOpen} onClose={closeViewModal} maxWidth="3xl">
                {viewingAsset && (
                    <div className="p-8">
                        <div className="flex justify-between items-start mb-6 border-b pb-4">
                            <div className="flex gap-6 items-center">
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900">{viewingAsset?.name}</h2>
                                    <p className="text-sm font-black text-indigo-600 mt-1 uppercase tracking-wider">{viewingAsset?.asset_tag}</p>
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

                        {/* FIXED IMAGE LOADING LOGIC */}
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

        </SidebarLayout>
    );
}