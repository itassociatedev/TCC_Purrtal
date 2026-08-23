import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useForm, usePage, router } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';

// 🟢 DYNAMIC HELPER: Uses database settings for Cut-off periods
const generateCutoffPeriods = (settings) => {
    const periods = [];
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const c1s = parseInt(settings?.cutoff_1_start || 21);
    const c1e = parseInt(settings?.cutoff_1_end || 5);
    const c2s = parseInt(settings?.cutoff_2_start || 6);
    const c2e = parseInt(settings?.cutoff_2_end || 20);

    // 🟢 FIXED: Expanded loop from (-2 to 3) up to (-12 to 24).
    // This generates 12 months (6 in the past, 6 into the future)
    for (let i = -6; i <= 6; i++) {
        const targetDate = new Date(year, month + i, 1);
        const y = targetDate.getFullYear();
        const m = targetDate.getMonth();
        
        const prevM = m === 0 ? 11 : m - 1;
        const prevY = m === 0 ? y - 1 : y;

        // Period 1 (e.g., 21st to 5th)
        const val1 = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(c1s).padStart(2, '0')}|${y}-${String(m + 1).padStart(2, '0')}-${String(c1e).padStart(2, '0')}`;
        const label1 = `${monthNames[prevM]} ${c1s}, ${prevY} - ${monthNames[m]} ${String(c1e).padStart(2, '0')}, ${y}`;

        // Period 2 (e.g., 6th to 20th)
        const val2 = `${y}-${String(m + 1).padStart(2, '0')}-${String(c2s).padStart(2, '0')}|${y}-${String(m + 1).padStart(2, '0')}-${String(c2e).padStart(2, '0')}`;
        const label2 = `${monthNames[m]} ${String(c2s).padStart(2, '0')}, ${y} - ${monthNames[m]} ${c2e}, ${y}`;

        periods.push({ label: label1, value: val1 });
        periods.push({ label: label2, value: val2 });
    }
    return periods;
};

// 🟢 DYNAMIC HELPER: Current cutoff
const getCurrentCutoffValue = (settings) => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    const prevM = m === 0 ? 11 : m - 1;
    const prevY = m === 0 ? y - 1 : y;

    const c1s = parseInt(settings?.cutoff_1_start || 21);
    const c1e = parseInt(settings?.cutoff_1_end || 5);
    const c2s = parseInt(settings?.cutoff_2_start || 6);
    const c2e = parseInt(settings?.cutoff_2_end || 20);

    if (d >= c2s && d <= c2e) {
        return `${y}-${String(m + 1).padStart(2, '0')}-${String(c2s).padStart(2, '0')}|${y}-${String(m + 1).padStart(2, '0')}-${String(c2e).padStart(2, '0')}`;
    } else if (d > c2e) {
        const nextM = m === 11 ? 0 : m + 1;
        const nextY = m === 11 ? y + 1 : y;
        return `${y}-${String(m + 1).padStart(2, '0')}-${String(c1s).padStart(2, '0')}|${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(c1e).padStart(2, '0')}`;
    } else {
        return `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(c1s).padStart(2, '0')}|${y}-${String(m + 1).padStart(2, '0')}-${String(c1e).padStart(2, '0')}`;
    }
};

export default function SetupSchedule({ employees = [], branches = [], shifts = [], cutoffSettings = {} }) {
    // 🟢 ADDED: Extract system props here for serverDate
    const { auth, system } = usePage().props;
    const fileInputRef = useRef(null);

    // 🟢 DYNAMIC SIDEBAR LINKS: Only show modules the user has permission to see. Removed Schedule View!
    const checkAccess = (module, requiredLevels) => {
        if (auth?.user?.role_id === 1 || auth?.user?.role?.name?.toLowerCase() === 'admin') return true;
        const level = auth?.user?.acl_permissions?.[module]?.toLowerCase() || 'no_access';
        return requiredLevels.includes(level);
    };

    const attendanceLinks = [
        checkAccess('attendance_overview', ['full', 'edit', 'view']) && { label: 'Attendance Overview', href: route('attendance.overview'), active: route().current('attendance.overview') },
        checkAccess('attendance_setup', ['full', 'edit', 'view']) && { label: 'Setup Schedule', href: route('attendance.setup-schedule'), active: route().current('attendance.setup-schedule') },
        checkAccess('attendance_calendar', ['full', 'edit', 'view']) && { label: 'Calendar', href: route('attendance.calendar'), active: route().current('attendance.calendar') },
    ].filter(Boolean);

    // 🔐 ROBUST ACL UI LOCKS FOR SETUP SCHEDULE
    const isSuperAdmin = auth?.user?.role_id === 1 || auth?.user?.role?.name?.toLowerCase() === 'admin';
    const aclLevel = auth?.user?.acl_permissions?.attendance_setup?.toLowerCase() || 'no_access';
    
    // EDIT access allows cell selection, assignment, and importing
    const canEditSchedule = isSuperAdmin || ['full', 'edit'].includes(aclLevel);
    // FULL access unlocks the red "Reset Default" override deletion tool
    const canResetSchedule = isSuperAdmin || ['full'].includes(aclLevel);

    const [viewMode, setViewMode] = useState('batch');
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // ==========================================
    // 🟢 MASTER CUT-OFF STATE ENGINE
    // ==========================================
    const cutoffPeriodsList = useMemo(() => generateCutoffPeriods(cutoffSettings), [cutoffSettings]);
    const [selectedCutoff, setSelectedCutoff] = useState(getCurrentCutoffValue(cutoffSettings));
    const [showCutoffHighlight, setShowCutoffHighlight] = useState(true);

    const isDateInCurrentCutoff = (dateStr) => {
        if (!showCutoffHighlight || !dateStr) return false;
        const [startStr, endStr] = selectedCutoff.split('|');
        const cell = new Date(`${dateStr}T12:00:00`);
        return cell >= new Date(`${startStr}T00:00:00`) && cell <= new Date(`${endStr}T23:59:59`);
    };

    const handleFileImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        router.post(route('attendance.setup-schedule.import'), { 
            file: file,
            cutoff_period: selectedCutoff
        }, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                e.target.value = null; // reset input
            },
            onError: () => {
                e.target.value = null;
            }
        });
    };

    // ==========================================
    // OVERRIDE LOGIC & HELPERS
    // ==========================================
    const [selectedCells, setSelectedCells] = useState([]);
    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const { data: overrideData, setData: setOverrideData, post: postOverride, processing: overrideProcessing, reset: resetOverride } = useForm({
        cells: [],
        shift_start: '',
        shift_end: '',
        shift_type: '',
        is_off_day: false
    });

    const getShiftDetails = (emp, dateString, dayName) => {
        if (!emp) return { isOff: false, shiftType: null, startTime: null, endTime: null, isOverride: false };
        
        // 1. Priority check: Does this exact date have a manual override?
        const override = emp.overrides?.[dateString];
        if (override) {
            return {
                isOff: override.is_off_day,
                shiftType: override.shift_type,
                startTime: override.start_time,
                endTime: override.end_time,
                // 🟢 The Magic Switch: Only shows yellow if it was manually overridden in UI!
                isOverride: override.is_manual
            };
        }

        // 2. Check Cut-off Schedules: Does the calendar date fall between ANY of the employee's assigned cut-off ranges?
        const activeSchedule = emp.schedules?.find(sch => {
            return dateString >= sch.start_date && dateString <= sch.end_date;
        });

        // If a cut-off schedule applies to this date, render it.
        if (activeSchedule) {
            // 🟢 NEW: Read the day-by-day pattern we just created!
            if (activeSchedule.pattern && activeSchedule.pattern[dayName]) {
                const dayConfig = activeSchedule.pattern[dayName];
                return {
                    isOff: dayConfig.is_off_day,
                    shiftType: dayConfig.shift_type,
                    startTime: dayConfig.shift_start,
                    endTime: dayConfig.shift_end,
                    isOverride: false
                };
            }

            // Fallback to legacy single-shift format
            return {
                isOff: activeSchedule.off_days?.includes(dayName),
                shiftType: activeSchedule.shift_type,
                startTime: activeSchedule.start_time,
                endTime: activeSchedule.end_time,
                isOverride: false
            };
        }

        // 3. Fallback: If the date is outside of any assigned cut-off period, it remains empty.
        return {
            isOff: false,
            shiftType: null,
            startTime: null,
            endTime: null,
            isOverride: false
        };
    };

    const toggleCellSelection = (employee_id, date) => {
        setSelectedCells(prev => {
            const exists = prev.find(c => c.employee_id === employee_id && c.date === date);
            if (exists) return prev.filter(c => !(c.employee_id === employee_id && c.date === date));
            return [...prev, { employee_id, date }];
        });
    };

    const isCellSelected = (employee_id, date) => selectedCells.some(c => c.employee_id === employee_id && c.date === date);

    const openOverrideModal = () => {
        resetOverride();
        setOverrideData('cells', selectedCells);
        setShowOverrideModal(true);
    };

    const submitOverride = (e) => {
        e.preventDefault();
        postOverride(route('attendance.schedule-override.store'), {
            onSuccess: () => {
                setShowOverrideModal(false);
                setSelectedCells([]);
                resetOverride();
            }
        });
    };

    // 🟢 IN-APP RESET: Confirms through the custom Tailwind modal
    const handleConfirmReset = () => {
        setIsResetting(true);
        router.post(route('attendance.schedule-override.reset'), { cells: selectedCells }, {
            onSuccess: () => {
                setSelectedCells([]);
                setShowResetConfirmModal(false);
                setIsResetting(false);
            },
            onError: () => {
                setIsResetting(false);
            }
        });
    };

    // ==========================================
    // BATCH VIEW: STATES & LOGIC
    // ==========================================
    const [selectedBatchIds, setSelectedBatchIds] = useState([]);
    const [batchDeptFilter, setBatchDeptFilter] = useState('');
    const [batchBranchFilter, setBatchBranchFilter] = useState('');
    const [batchSearch, setBatchSearch] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [weekOffset, setWeekOffset] = useState(0);

    // 🟢 REBUILT BATCH GRID: 7-Day Weekly view anchored to the selected cutoff start date!
    const batchDates = useMemo(() => {
        const [startStr] = selectedCutoff.split('|');
        const baseDate = new Date(`${startStr}T12:00:00`);
        
        const dayOfWeek = baseDate.getDay() === 0 ? 6 : baseDate.getDay() - 1; 
        
        const monday = new Date(baseDate);
        monday.setDate(baseDate.getDate() - dayOfWeek + (weekOffset * 7));
        
        let days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
            const display = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            days.push({ dayName, dateString, display });
        }
        return days;
    }, [weekOffset, selectedCutoff]);

    const currentWeekRange = `${batchDates[0].display} - ${batchDates[6].display}`;
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 🟢 UPDATED: Filter by Branch securely
    const availableEmployeesForPicker = useMemo(() => {
        return employees.filter(emp => {
            if (selectedBatchIds.includes(emp.id)) return false;
            if (batchSearch.trim() !== '' && !emp.name.toLowerCase().includes(batchSearch.toLowerCase())) return false;
            if (batchDeptFilter !== '' && (typeof emp.department === 'object' ? emp.department?.name : emp.department)?.toLowerCase() !== batchDeptFilter.toLowerCase()) return false;
            
            if (batchBranchFilter !== '') {
                const selectedBranchId = Number(batchBranchFilter);
                const matchesBranch = Number(emp.branch_id) === selectedBranchId || 
                    (emp.assigned_branch_ids && emp.assigned_branch_ids.includes(selectedBranchId));
                if (!matchesBranch) return false;
            }

            return true;
        });
    }, [employees, selectedBatchIds, batchSearch, batchDeptFilter, batchBranchFilter]);

    const batchEmployeesList = useMemo(() => {
        return employees.filter(e => selectedBatchIds.includes(e.id));
    }, [employees, selectedBatchIds]);

    const addEmployeeToBatch = (id) => {
        setSelectedBatchIds(prev => [...prev, id]);
        // 🟢 FIXED: Clears search so the list resets, but KEEPS dropdown open to add more staff rapidly!
        setBatchSearch('');
    };

    // ==========================================
    // NEW MODAL LOGIC: 7-Day Base Schedule Pattern
    // ==========================================
    const [showBaseModal, setShowBaseModal] = useState(false);
    const [showEmptyGridAlert, setShowEmptyGridAlert] = useState(false); // 🟢 Custom alert state
    
    const defaultWeekPattern = {
        Monday: { is_off_day: false, shift_start: '', shift_end: '', shift_type: '' },
        Tuesday: { is_off_day: false, shift_start: '', shift_end: '', shift_type: '' },
        Wednesday: { is_off_day: false, shift_start: '', shift_end: '', shift_type: '' },
        Thursday: { is_off_day: false, shift_start: '', shift_end: '', shift_type: '' },
        Friday: { is_off_day: false, shift_start: '', shift_end: '', shift_type: '' },
        Saturday: { is_off_day: true, shift_start: '', shift_end: '', shift_type: '' },
        Sunday: { is_off_day: true, shift_start: '', shift_end: '', shift_type: '' },
    };

    const { data: baseData, setData: setBaseData, post: postBase, processing: baseProcessing, reset: resetBase } = useForm({
        employee_ids: [],
        cutoff_period: selectedCutoff,
        pattern: defaultWeekPattern
    });

    useEffect(() => {
        setBaseData('cutoff_period', selectedCutoff);
    }, [selectedCutoff]);

    const openBaseModal = () => {
        if (selectedBatchIds.length === 0) {
            // 🟢 FIXED: Replaced ugly browser alert with our custom in-app modal state
            setShowEmptyGridAlert(true);
            return;
        }
        resetBase();
        setBaseData('cutoff_period', selectedCutoff);
        setBaseData('employee_ids', selectedBatchIds);
        setShowBaseModal(true);
    };

    const submitBaseSchedule = (e) => {
        e.preventDefault();
        postBase(route('attendance.setup-schedule.store'), {
            onSuccess: () => {
                setShowBaseModal(false); 
                resetBase(); 
            }
        });
    };

    // ==========================================
    // SINGLE VIEW: STATES & LOGIC
    // ==========================================
    const [singleEmployeeId, setSingleEmployeeId] = useState('');
    const [singleDeptFilter, setSingleDeptFilter] = useState('');
    const [singleBranchFilter, setSingleBranchFilter] = useState(''); 
    const [singleSearch, setSingleSearch] = useState('');
    const [isSingleDropdownOpen, setIsSingleDropdownOpen] = useState(false);
    
    // Default the month view to whatever the cutoff starts with
    const [currentMonth, setCurrentMonth] = useState(new Date(`${selectedCutoff.split('|')[0]}T00:00:00`).getMonth());
    const [currentYear, setCurrentYear] = useState(new Date(`${selectedCutoff.split('|')[0]}T00:00:00`).getFullYear());

    const singleDropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutsideSingle = (event) => {
            if (singleDropdownRef.current && !singleDropdownRef.current.contains(event.target)) {
                setIsSingleDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutsideSingle);
        return () => document.removeEventListener('mousedown', handleClickOutsideSingle);
    }, []);

    // 🟢 Slider Navigation Logic
    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(prev => prev - 1);
        } else {
            setCurrentMonth(prev => prev - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(prev => prev + 1);
        } else {
            setCurrentMonth(prev => prev + 1);
        }
    };

    // 🟢 UPDATED: Filter by Branch securely
    const availableSingleEmployees = useMemo(() => {
        return employees.filter(emp => {
            const deptName = typeof emp.department === 'object' ? emp.department?.name : emp.department;
            const matchesDept = singleDeptFilter === '' || (deptName || 'Unassigned').toLowerCase() === singleDeptFilter.toLowerCase();
            const matchesSearch = singleSearch.trim() === '' || emp.name.toLowerCase().includes(singleSearch.toLowerCase());
            
            const selectedBranchId = Number(singleBranchFilter);
            const matchesBranch = singleBranchFilter === '' || 
                Number(emp.branch_id) === selectedBranchId || 
                (emp.assigned_branch_ids && emp.assigned_branch_ids.includes(selectedBranchId));

            return matchesDept && matchesSearch && matchesBranch;
        });
    }, [employees, singleDeptFilter, singleSearch, singleBranchFilter]);

    const singleEmployee = useMemo(() => {
        if (!singleEmployeeId) return null;
        return employees.find(e => e.id.toString() === singleEmployeeId) || null;
    }, [employees, singleEmployeeId]);

    const monthDays = useMemo(() => {
        const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); 
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        let daysArray = [];

        for (let i = 0; i < firstDayIndex; i++) daysArray.push({ dayNum: '', isPadding: true });
        
        for (let i = 1; i <= daysInMonth; i++) {
            const dateObj = new Date(currentYear, currentMonth, i);
            const dateString = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
            daysArray.push({ dayNum: i, dayName, dateString, isPadding: false });
        }

        const trailingPadding = (Math.ceil(daysArray.length / 7) * 7) - daysArray.length;
        for (let i = 0; i < trailingPadding; i++) daysArray.push({ dayNum: '', isPadding: true });

        return daysArray;
    }, [currentYear, currentMonth]);

    // ==========================================
    // SHARED HELPERS
    // ==========================================
    const daysOfWeekSunToSat = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const uniqueDepartments = useMemo(() => {
        return [...new Set(employees.map(e => (typeof e.department === 'object' ? e.department?.name : e.department) || 'Unassigned'))].filter(dept => dept !== 'Unassigned').sort();
    }, [employees]);

    // 🟢 FIXED: Shortened text to "Day", "Straight", and "Graveyard" to free up cell space!
    const renderShiftBadge = (shiftType, isOffDay) => {
        if (isOffDay) return <span className="inline-flex rounded border border-gray-200 bg-gray-100 px-2 py-1 text-[10px] sm:text-xs font-medium text-gray-600 shadow-sm">Off Day</span>;
        switch (shiftType) {
            case 'Day Shift': return <span className="inline-flex rounded bg-blue-50 px-2 py-1 text-[10px] sm:text-xs font-medium text-blue-700 shadow-sm">Day</span>;
            case 'Straight Duty': return <span className="inline-flex rounded bg-green-50 px-2 py-1 text-[10px] sm:text-xs font-medium text-green-700 shadow-sm">Straight</span>;
            case 'Graveyard Shift': return <span className="inline-flex rounded bg-purple-50 px-2 py-1 text-[10px] sm:text-xs font-medium text-purple-700 shadow-sm">Graveyard</span>;
            default: return <span className="inline-flex rounded border border-gray-100 bg-gray-50 px-2 py-1 text-[10px] sm:text-xs font-medium text-gray-400">No Shift</span>;
        }
    };

    return (
        <SidebarLayout
            activeModule="Attendance"
            sidebarLinks={attendanceLinks}
            header={
                <div className="flex items-center justify-between relative">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-semibold leading-tight text-gray-800">Setup Schedule</h2>
                        
                        <div className="inline-flex rounded-lg bg-gray-200 p-1 ml-2">
                            <button
                                onClick={() => { setViewMode('batch'); setSelectedCells([]); }}
                                className={`rounded-md px-3 py-1 text-sm font-medium transition-all ${viewMode === 'batch' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                Batch View
                            </button>
                            <button
                                onClick={() => { setViewMode('single'); setSelectedCells([]); }}
                                className={`rounded-md px-3 py-1 text-sm font-medium transition-all ${viewMode === 'single' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                Single View
                            </button>
                        </div>
                    </div>
                    
                    {/* 🟢 THE MOCKUP IMPORT BUTTONS */}
                    {canEditSchedule && (
                        <div className="flex space-x-3">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                style={{ display: 'none' }} 
                                accept=".xlsx,.xls,.csv" 
                                onChange={handleFileImport} 
                            />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                            >
                                Import Schedule
                            </button>
                        </div>
                    )}
                </div>
            }
        >
            {/* FLOATING ACTION BAR FOR OVERRIDES */}
            {mounted && selectedCells.length > 0 && (
                <div 
                    className="flex items-center gap-6 rounded-xl bg-indigo-600 px-6 py-4 text-white shadow-2xl transition-all animate-fade-in-up"
                    style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999 }}
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 font-bold text-lg">
                            {selectedCells.length}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold leading-tight text-white">Days Selected</span>
                            <span className="text-xs text-indigo-200 leading-tight">Ready for override</span>
                        </div>
                    </div>
                    <div className="ml-2 flex items-center gap-3 border-l border-indigo-500 pl-6">
                        <button onClick={() => setSelectedCells([])} className="text-sm font-medium text-indigo-200 hover:text-white transition-colors">Cancel</button>
                        
                        {/* 🟢 FULL ACL ONLY: Opens custom in-app confirmation modal */}
                        {canResetSchedule && (
                            <button 
                                onClick={() => setShowResetConfirmModal(true)} 
                                className="rounded-md bg-rose-500 hover:bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-colors"
                            >
                                Reset Default
                            </button>
                        )}

                        <button 
                            onClick={openOverrideModal} 
                            className="rounded-md bg-white px-5 py-2 text-sm font-bold text-indigo-600 shadow-md hover:bg-indigo-50 transition-colors"
                        >
                            Edit Shifts
                        </button>
                    </div>
                </div>
            )}

            <div className="rounded-lg bg-white shadow-sm relative overflow-hidden">
                
                {/* ================= BATCH VIEW ================= */}
                {viewMode === 'batch' && (
                    <div className="flex flex-col">
                        
                        {/* 🟢 ROW 1: ADD STAFF TO VIEW */}
                        <div className="bg-white border-b border-gray-100 p-4 sm:px-6 sm:py-5 flex flex-col lg:flex-row lg:items-center gap-4">
                            <span className="text-sm font-bold text-gray-700 whitespace-nowrap">Select Employees:</span>
                            <div className="flex flex-wrap items-center gap-4 w-full">
                                
                                <div>
                                    {/* 🟢 FIXED: Dropdown Lock Logic for Branches */}
                                    {branches.length > 1 ? (
                                        <select
                                            className="rounded-md border-gray-300 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 w-40 cursor-pointer"
                                            value={batchBranchFilter}
                                            onChange={e => { 
                                                setBatchBranchFilter(e.target.value); 
                                                setBatchSearch(''); 
                                                setIsDropdownOpen(false); 
                                                setSelectedCells([]); 
                                            }}
                                        >
                                            <option value="">{isSuperAdmin ? 'All Branches' : 'All My Branches'}</option>
                                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    ) : (
                                        <div className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-500 font-medium w-40 truncate shadow-inner cursor-not-allowed">
                                            {branches[0]?.name || 'All Branches'}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    {/* 🟢 FIXED: Dropdown Lock Logic for Departments */}
                                    {isSuperAdmin ? (
                                        <select
                                            className="rounded-md border-gray-300 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 w-48 cursor-pointer"
                                            value={batchDeptFilter}
                                            onChange={e => { 
                                                setBatchDeptFilter(e.target.value); 
                                                setBatchSearch(''); 
                                                setIsDropdownOpen(false); 
                                                setSelectedCells([]); 
                                            }}
                                        >
                                            <option value="">All Departments</option>
                                            {uniqueDepartments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                                        </select>
                                    ) : (
                                        <div className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-500 font-medium w-48 truncate shadow-inner cursor-not-allowed">
                                            {auth?.user?.department?.name || uniqueDepartments[0] || 'My Department'}
                                        </div>
                                    )}
                                </div>

                                <div className="relative rounded-md shadow-sm" ref={dropdownRef}>
                                    <div className="relative flex items-center">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Search by name..."
                                            className="block w-56 lg:w-72 rounded-md border-gray-300 py-2 pl-10 pr-3 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                            value={batchSearch}
                                            onChange={e => { setBatchSearch(e.target.value); setIsDropdownOpen(true); }}
                                            onFocus={() => setIsDropdownOpen(true)}
                                        />
                                    </div>

                                    {isDropdownOpen && (
                                        <div className="absolute left-0 lg:right-0 z-20 mt-1 max-h-64 w-80 overflow-y-auto rounded-md border border-gray-100 bg-white py-1 shadow-2xl ring-1 ring-black ring-opacity-5">
                                            {availableEmployeesForPicker.length > 0 ? (
                                                availableEmployeesForPicker.map(emp => {
                                                    const isAdded = selectedBatchIds.includes(emp.id);
                                                    const empDept = typeof emp.department === 'object' ? emp.department?.name : emp.department;
                                                    return (
                                                        <button
                                                            key={emp.id}
                                                            onClick={() => !isAdded && addEmployeeToBatch(emp.id)}
                                                            disabled={isAdded}
                                                            className={`w-full text-left px-4 py-2.5 text-xs flex items-center justify-between transition-colors ${isAdded ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-900'}`}
                                                        >
                                                            <span className="font-medium text-sm">{emp.name} {isAdded && <span className="text-[10px] italic ml-1 font-normal">(Added)</span>}</span>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded ${isAdded ? 'bg-gray-200 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>{empDept || 'Unassigned'}</span>
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <div className="px-4 py-4 text-sm text-gray-400 italic text-center">No matching active employees found.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 🟢 ROW 2: TIMETABLE OVERVIEW, SLIDER & CUTOFF ACTIONS */}
                        <div className="bg-white border-b border-gray-100 p-4 sm:px-6 sm:py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                                <h3 className="text-xl font-bold text-gray-800">Weekly Grid</h3>
                                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                                    <button onClick={() => setWeekOffset(prev => prev - 1)} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-gray-600 shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500">&larr;</button>
                                    <span className="text-sm font-medium text-gray-700 w-56 text-center">{currentWeekRange}</span>
                                    <button onClick={() => setWeekOffset(prev => prev + 1)} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-gray-600 shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500">&rarr;</button>
                                </div>
                            </div>
                            
                            {/* 🟢 MOVED: Cutoff Dropdown and Action Buttons moved to the right side of the Weekly Grid */}
                            <div className="flex flex-wrap items-center gap-3">
                                {/* 🟢 NEW: Current Cut-off Button */}
                                <button 
                                    onClick={() => {
                                        const current = getCurrentCutoffValue(cutoffSettings);
                                        setSelectedCutoff(current);
                                        setSelectedCells([]);
                                        const [start] = current.split('|');
                                        const startDate = new Date(`${start}T00:00:00`);
                                        setCurrentMonth(startDate.getMonth());
                                        setCurrentYear(startDate.getFullYear());
                                        setWeekOffset(0);
                                    }}
                                    className="flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                >
                                    Current Cut-off
                                </button>
                                <select
                                    className="block w-48 sm:w-64 rounded-md border-indigo-300 py-2 pl-3 pr-10 text-sm font-semibold text-indigo-900 bg-indigo-50 shadow-sm cursor-pointer focus:ring-indigo-500 focus:border-indigo-500"
                                    value={selectedCutoff}
                                    onChange={(e) => {
                                        setSelectedCutoff(e.target.value);
                                        setSelectedCells([]);
                                        const [start] = e.target.value.split('|');
                                        const startDate = new Date(`${start}T00:00:00`);
                                        setCurrentMonth(startDate.getMonth());
                                        setCurrentYear(startDate.getFullYear());
                                        setWeekOffset(0);
                                        setShowCutoffHighlight(false); // 🟢 FIX BUG 5
                                    }}
                                >
                                    {cutoffPeriodsList.map(period => (
                                        <option key={period.value} value={period.value}>{period.label}</option>
                                    ))}
                                </select>
                                
                                <button 
                                    onClick={() => setShowCutoffHighlight(!showCutoffHighlight)}
                                    className={`flex items-center justify-center w-[150px] whitespace-nowrap gap-1.5 rounded-md border px-4 py-2 text-sm font-bold shadow-sm transition-colors ${
                                        showCutoffHighlight 
                                        ? 'border-indigo-300 bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
                                        : 'border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50'
                                    }`}
                                >
                                    {showCutoffHighlight && (
                                        <span className="relative flex h-2 w-2 shrink-0">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                        </span>
                                    )}
                                    {!showCutoffHighlight && (
                                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                    {showCutoffHighlight ? 'Hide Cut-off' : 'Highlight Cut-off'}
                                </button>

                                {/* 🟢 RESTORED: Assign Base Schedule Button */}
                                {canEditSchedule && (
                                    <button 
                                        onClick={openBaseModal}
                                        className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors whitespace-nowrap"
                                    >
                                        + Assign Base Schedule
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="p-4 sm:p-6 space-y-6">
                            <div>
                                {batchEmployeesList.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 border border-gray-100 bg-gray-50 p-4 rounded-xl">
                                        {batchEmployeesList.map(emp => (
                                            <span key={emp.id} className="inline-flex items-center gap-2 rounded-full bg-indigo-600 pl-3 pr-1.5 py-1 text-sm font-medium text-white shadow-sm">
                                                {emp.name}
                                                <button onClick={() => {
                                                    setSelectedBatchIds(prev => prev.filter(i => i !== emp.id));
                                                }} className="rounded-full bg-indigo-800 p-1 text-[10px] hover:bg-indigo-900 focus:outline-none transition-colors">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center"><p className="text-base font-medium text-gray-500">No employees selected. Add staff to build the grid.</p></div>
                                )}
                            </div>

                            {/* THE MASTER GRID */}
                            {batchEmployeesList.length > 0 && (
                                <div className="overflow-x-auto pb-4">
                                    <table className="min-w-full border-collapse">
                                        <thead className="bg-gray-50 sticky top-0 z-10">
                                            <tr>
                                                <th className="py-4 pl-4 pr-3 text-left text-sm font-bold text-gray-900 w-1/5 min-w-[200px] border-b border-gray-200 bg-gray-50 z-20 sticky left-0 shadow-[1px_0_0_0_#e5e7eb]">
                                                    Employee
                                                </th>
                                                {batchDates.map(day => {
                                                    const isCutoff = isDateInCurrentCutoff(day.dateString);
                                                    return (
                                                        <th key={day.dateString} className={`px-3 py-4 text-center text-sm font-semibold text-gray-900 border-b border-gray-200 border-l border-gray-100 min-w-[120px] ${isCutoff ? 'bg-indigo-50 border-t-4 border-t-indigo-400 shadow-sm' : ''}`}>
                                                            {day.display}
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            {batchEmployeesList.map((emp, idx) => (
                                                <tr key={emp.id} className={idx !== batchEmployeesList.length - 1 ? "border-b border-gray-100" : ""}>
                                                    <td className="whitespace-nowrap py-5 pl-4 pr-3 text-sm font-medium text-gray-900 bg-white sticky left-0 shadow-[1px_0_0_0_#e5e7eb] z-10 border-b border-gray-50">
                                                        <div className="font-bold text-gray-800 text-base">{emp.name}</div>
                                                        <div className="text-xs font-medium text-gray-500 mt-0.5">{typeof emp.department === 'object' ? emp.department?.name : emp.department}</div>
                                                    </td>
                                                    {batchDates.map(day => {
                                                        const { isOff, shiftType, startTime, endTime, isOverride } = getShiftDetails(emp, day.dateString, day.dayName);
                                                        const isSelected = isCellSelected(emp.id, day.dateString);
                                                        const isCutoff = isDateInCurrentCutoff(day.dateString);
                                                        
                                                        // 🟢 FIXED: Reduced padding to strictly tighten the gap between Batch cells without crushing text.
                                                        return (
                                                            <td key={day.dateString} className={`px-1 py-1.5 align-middle border-l border-gray-100 border-b border-gray-50 ${isCutoff ? 'bg-indigo-50/40' : ''}`}>
                                                                {/* 🟢 FIXED: Blended Highlight Logic */}
                                                                <div 
                                                                    onClick={() => {
                                                                        if (canEditSchedule) toggleCellSelection(emp.id, day.dateString);
                                                                    }}
                                                                    className={`min-h-[80px] w-full flex flex-col justify-center items-center gap-1 rounded-lg border p-1.5 shadow-sm transition-colors relative ${
                                                                        isSelected ? 'border-indigo-500 bg-indigo-50 ring-2 ring-inset ring-indigo-500 z-10' : 
                                                                        isOverride && isCutoff ? 'border-amber-400 bg-amber-50/80 ring-2 ring-inset ring-indigo-200 shadow-inner' : 
                                                                        isOverride ? 'border-amber-300 bg-amber-50/40' : 
                                                                        isCutoff ? 'border-indigo-300 bg-indigo-50/40 ring-1 ring-indigo-100' : 
                                                                        'border-gray-200 bg-white'
                                                                    } ${canEditSchedule ? (isOverride ? 'hover:bg-amber-100 cursor-pointer' : 'hover:bg-gray-50 cursor-pointer') : 'cursor-default'}`}
                                                                >
                                                                    {isOverride && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400 shadow-sm"></span>}
                                                                    <div className="flex flex-col items-center gap-1 pointer-events-none">
                                                                        {renderShiftBadge(shiftType, isOff)}
                                                                        {!isOff && startTime && endTime && (
                                                                            <span className={`text-[10px] font-mono font-bold text-center leading-tight ${isOverride ? 'text-amber-700' : 'text-gray-500'}`}>
                                                                                {startTime} <br /> {endTime}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ================= SINGLE VIEW ================= */}
                {viewMode === 'single' && (
                    <div className="flex flex-col">
                        
                        {/* 🟢 ROW 1: ADD STAFF TO VIEW */}
                        <div className="bg-white border-b border-gray-100 p-4 sm:px-6 sm:py-5 flex flex-col lg:flex-row lg:items-center gap-4">
                            <span className="text-sm font-bold text-gray-700 whitespace-nowrap">Select Employee:</span>
                            <div className="flex flex-wrap items-center gap-4 w-full">
                                
                                <div>
                                    {/* 🟢 FIXED: Dropdown Lock Logic for Branches */}
                                    {branches.length > 1 ? (
                                        <select
                                            className="block rounded-md border-gray-300 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 w-40 cursor-pointer"
                                            value={singleBranchFilter}
                                            onChange={e => { 
                                                setSingleBranchFilter(e.target.value); 
                                                setSingleEmployeeId(''); 
                                                setSingleSearch('');
                                                setIsSingleDropdownOpen(false);
                                                setSelectedCells([]); 
                                            }}
                                        >
                                            <option value="">{isSuperAdmin ? 'All Branches' : 'All My Branches'}</option>
                                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    ) : (
                                        <div className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-500 font-medium w-40 truncate shadow-inner cursor-not-allowed">
                                            {branches[0]?.name || 'All Branches'}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    {/* 🟢 FIXED: Dropdown Lock Logic for Departments */}
                                    {isSuperAdmin ? (
                                        <select
                                            className="block rounded-md border-gray-300 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 w-48 cursor-pointer"
                                            value={singleDeptFilter}
                                            onChange={e => { 
                                                setSingleDeptFilter(e.target.value); 
                                                setSingleEmployeeId(''); 
                                                setSingleSearch('');
                                                setIsSingleDropdownOpen(false);
                                                setSelectedCells([]); 
                                            }}
                                        >
                                            <option value="">All Departments</option>
                                            {uniqueDepartments.map(dept => (
                                                <option key={dept} value={dept}>{dept}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-500 font-medium w-48 truncate shadow-inner cursor-not-allowed">
                                            {auth?.user?.department?.name || uniqueDepartments[0] || 'My Department'}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <div className="relative rounded-md shadow-sm" ref={singleDropdownRef}>
                                        <div className="relative flex items-center">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Search by name..."
                                                className="block w-56 lg:w-72 rounded-md border-gray-300 py-2 pl-10 pr-3 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                value={singleSearch}
                                                onChange={e => { setSingleSearch(e.target.value); setIsSingleDropdownOpen(true); }}
                                                onFocus={() => setIsSingleDropdownOpen(true)}
                                            />
                                        </div>

                                        {isSingleDropdownOpen && (
                                            <div className="absolute left-0 lg:right-0 z-20 mt-1 max-h-64 w-80 overflow-y-auto rounded-md border border-gray-100 bg-white py-1 shadow-2xl ring-1 ring-black ring-opacity-5">
                                                {availableSingleEmployees.length > 0 ? (
                                                    availableSingleEmployees.map(emp => {
                                                        const empDept = typeof emp.department === 'object' ? emp.department?.name : emp.department;
                                                        const isSelected = singleEmployeeId === emp.id.toString();
                                                        return (
                                                            <button
                                                                key={emp.id}
                                                                onClick={() => {
                                                                    setSingleEmployeeId(emp.id.toString());
                                                                    setSelectedCells([]);
                                                                    setSingleSearch('');
                                                                    setIsSingleDropdownOpen(false);
                                                                }}
                                                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-900'}`}
                                                            >
                                                                <span className="font-medium">{emp.name} {isSelected && <span className="text-[10px] ml-1 text-indigo-500 font-normal">(Selected)</span>}</span>
                                                                <span className={`text-[10px] px-2 py-0.5 rounded ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>{empDept || 'Unassigned'}</span>
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="px-4 py-4 text-sm text-gray-400 italic text-center">No matching employees found.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 🟢 ROW 2: TIMETABLE OVERVIEW & SLIDER & CUTOFF */}
                        <div className="bg-white border-b border-gray-100 p-4 sm:px-6 sm:py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                                <h3 className="text-xl font-bold text-gray-800">Monthly Calendar</h3>
                                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                                    <button 
                                        onClick={handlePrevMonth}
                                        className="flex items-center justify-center w-10 h-10 rounded-md border border-gray-300 bg-white text-gray-600 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                                    </button>
                                    <div className="flex items-center justify-center w-40 h-10 rounded-md border border-gray-300 bg-white text-sm font-black text-gray-800 shadow-sm select-none">
                                        {monthNames[currentMonth]} {currentYear}
                                    </div>
                                    <button 
                                        onClick={handleNextMonth}
                                        className="flex items-center justify-center w-10 h-10 rounded-md border border-gray-300 bg-white text-gray-600 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                </div>
                            </div>
                            
                            {/* 🟢 MOVED: Cutoff Dropdown and Highlight Toggle replicated to Single View */}
                            <div className="flex flex-wrap items-center gap-3">
                                <select
                                    className="block w-48 sm:w-64 rounded-md border-indigo-300 py-2 pl-3 pr-10 text-sm font-semibold text-indigo-900 bg-indigo-50 shadow-sm cursor-pointer focus:ring-indigo-500 focus:border-indigo-500"
                                    value={selectedCutoff}
                                    onChange={(e) => {
                                        setSelectedCutoff(e.target.value);
                                        setSelectedCells([]);
                                        const [start] = e.target.value.split('|');
                                        const startDate = new Date(`${start}T00:00:00`);
                                        setCurrentMonth(startDate.getMonth());
                                        setCurrentYear(startDate.getFullYear());
                                        setWeekOffset(0);
                                        setShowCutoffHighlight(false); // 🟢 FIX BUG 5
                                    }}
                                >
                                    {cutoffPeriodsList.map(period => (
                                        <option key={period.value} value={period.value}>{period.label}</option>
                                    ))}
                                </select>
                                
                                <button 
                                    onClick={() => setShowCutoffHighlight(!showCutoffHighlight)}
                                    className={`flex items-center justify-center w-[150px] whitespace-nowrap gap-1.5 rounded-md border px-4 py-2 text-sm font-bold shadow-sm transition-colors ${
                                        showCutoffHighlight 
                                        ? 'border-indigo-300 bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
                                        : 'border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50'
                                    }`}
                                >
                                    {showCutoffHighlight && (
                                        <span className="relative flex h-2 w-2 shrink-0">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                        </span>
                                    )}
                                    {!showCutoffHighlight && (
                                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                    {showCutoffHighlight ? 'Hide Cut-off' : 'Highlight Cut-off'}
                                </button>
                            </div>
                        </div>
                        
                        {/* Selected User Header */}
                        <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
                            <h4 className="text-base font-bold text-gray-800">{singleEmployee?.name || 'No Employee Selected'}</h4>
                            <span className="text-sm font-medium text-gray-500">
                                {singleEmployee ? (typeof singleEmployee.department === 'object' ? singleEmployee.department?.name : singleEmployee.department || 'Unassigned') : ''}
                            </span>
                        </div>

                        <div className="w-full p-4 sm:p-6">
                            
                            {/* 🟢 FIXED: High-contrast Dark Grey Headers */}
                            <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                                {daysOfWeekSunToSat.map(d => (
                                    <div key={`header-${d}`} className="rounded-md bg-gray-600 py-3 text-center text-xs font-bold text-white uppercase tracking-wider shadow-sm">
                                        {d}
                                    </div>
                                ))}
                            </div>

                            {/* 🟢 FIXED: gridAutoRows set to minmax(110px, auto) allows rows to dynamically expand without hiding data */}
                            <div 
                                className="grid gap-2" 
                                style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridAutoRows: 'minmax(120px, auto)' }}
                            >
                                {monthDays.map((slot, index) => {
                                    
                                    if (slot.isPadding) {
                                        return <div key={`padding-${index}`} className="h-full w-full rounded-md border border-gray-100 bg-gray-50/50"></div>;
                                    }

                                    const { isOff, shiftType, startTime, endTime, isOverride } = getShiftDetails(singleEmployee, slot.dateString, slot.dayName);
                                    const isSelected = singleEmployee ? isCellSelected(singleEmployee.id, slot.dateString) : false;
                                    const isCutoff = singleEmployee && isDateInCurrentCutoff(slot.dateString); // 🟢 CHECK CALENDAR CELL
                                    
                                    // 🟢 EDIT ACL LOCK: Removes cursor-pointer and hover colors if user only has VIEW access
                                    return (
                                        <div 
                                            key={`day-${slot.dayNum}`} 
                                            onClick={() => {
                                                if (canEditSchedule && singleEmployee) toggleCellSelection(singleEmployee.id, slot.dateString);
                                            }}
                                            className={`h-full w-full flex flex-col rounded-md border p-2 sm:p-3 shadow-sm transition-colors relative ${
                                                !singleEmployee ? 'border-gray-100 bg-white' :
                                                isSelected ? 'border-indigo-500 bg-indigo-50 ring-2 ring-inset ring-indigo-500 z-10' : 
                                                isOverride && isCutoff ? 'border-amber-400 bg-amber-50/80 ring-2 ring-inset ring-indigo-200 shadow-inner' : 
                                                isOverride ? 'border-amber-300 bg-amber-50/40' : 
                                                isCutoff ? 'border-indigo-300 bg-indigo-50/40 ring-1 ring-indigo-100' : 
                                                'border-gray-200 bg-white'
                                            } ${canEditSchedule && singleEmployee ? (isOverride ? 'hover:bg-amber-100 cursor-pointer' : 'hover:bg-gray-50 cursor-pointer') : 'cursor-default'}`}
                                        >
                                            <div className="flex justify-between items-start pointer-events-none">
                                                <span className={`text-sm sm:text-base font-bold ${isOverride ? 'text-amber-700' : 'text-gray-700'}`}>{slot.dayNum}</span>
                                                
                                                <div className="flex flex-col items-end gap-1">
                                                    {isOverride && <span className="text-[9px] sm:text-[10px] font-bold text-amber-500 uppercase tracking-wider bg-amber-100 px-1.5 sm:px-2 py-0.5 rounded shadow-sm">Modified</span>}
                                                </div>
                                            </div>

                                            {singleEmployee && (
                                                <div className="mt-2 sm:mt-3 flex flex-col items-center justify-center flex-1 gap-2 pointer-events-none">
                                                    {renderShiftBadge(shiftType, isOff)}
                                                    {!isOff && startTime && endTime && (
                                                        <span className={`text-[10px] sm:text-[11px] font-bold leading-tight font-mono text-center ${isOverride ? 'text-amber-700' : 'text-gray-500'}`}>
                                                            {startTime}<br/>|<br/>{endTime}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* ========================================== */}
            {/* 🟢 NEW: 7-DAY BASE SCHEDULE PATTERN MODAL */}
            {/* ========================================== */}
            {showBaseModal && (
                <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowBaseModal(false)}></div>

                        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
                        <div className="inline-block transform overflow-hidden rounded-xl bg-white text-left align-bottom shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:align-middle relative z-10">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <h3 className="text-xl font-bold leading-6 text-gray-900 mb-4">Assign Base Schedule Pattern</h3>
                                
                                <form onSubmit={submitBaseSchedule} className="space-y-6">
                                    <div className="mb-4 rounded-md bg-indigo-50 p-4 border border-indigo-100 flex items-start gap-3">
                                        <svg className="h-5 w-5 text-indigo-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p className="text-sm text-indigo-800">
                                            Applying this weekly pattern to <strong className="font-bold">{selectedBatchIds.length} selected employee(s)</strong> for the entire <strong className="font-bold">
                                            {cutoffPeriodsList.find(c => c.value === baseData.cutoff_period)?.label}
                                            </strong> cut-off period.
                                        </p>
                                    </div>

                                    {/* 🟢 FIXED: Strict grid heights and flex rules to prevent squishing and eliminate scrollbars */}
                                    <div className="space-y-2 max-h-[55vh] overflow-y-auto px-1 py-1">
                                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                                            <div key={day} className={`flex items-center gap-3 sm:gap-4 p-3 border rounded-lg transition-colors ${baseData.pattern[day].is_off_day ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'}`}>
                                                
                                                <div className="w-24 sm:w-28 shrink-0 font-bold text-sm text-gray-800 tracking-wide">{day}</div>
                                                
                                                <label className="flex items-center gap-2 cursor-pointer w-20 sm:w-24 shrink-0">
                                                    <input 
                                                        type="checkbox" 
                                                        className="h-4 w-4 text-rose-500 rounded border-gray-300 focus:ring-rose-500 cursor-pointer"
                                                        checked={baseData.pattern[day].is_off_day}
                                                        onChange={e => {
                                                            setBaseData('pattern', {
                                                                ...baseData.pattern,
                                                                [day]: { ...baseData.pattern[day], is_off_day: e.target.checked }
                                                            });
                                                        }}
                                                    />
                                                    <span className={`text-sm font-semibold ${baseData.pattern[day].is_off_day ? 'text-rose-600' : 'text-gray-600'}`}>Off Day</span>
                                                </label>

                                                <div className="flex-1 min-w-0">
                                                    {!baseData.pattern[day].is_off_day ? (
                                                        <select 
                                                            className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 cursor-pointer bg-white py-2 px-3 h-[38px]"
                                                            value={baseData.pattern[day].shift_start && baseData.pattern[day].shift_end ? `${baseData.pattern[day].shift_start}-${baseData.pattern[day].shift_end}` : ''}
                                                            onChange={e => {
                                                                const [start, end] = e.target.value.split('-');
                                                                const matchedShift = shifts.find(s => s.start_time.startsWith(start) && s.end_time.startsWith(end));
                                                                setBaseData('pattern', {
                                                                    ...baseData.pattern,
                                                                    [day]: {
                                                                        ...baseData.pattern[day],
                                                                        shift_start: start,
                                                                        shift_end: end,
                                                                        shift_type: matchedShift ? matchedShift.shift_type : 'Day Shift'
                                                                    }
                                                                });
                                                            }}
                                                            required={!baseData.pattern[day].is_off_day}
                                                        >
                                                            <option value="" disabled>-- Select Assigned Shift --</option>
                                                            {shifts.map(shift => (
                                                                <option key={shift.id} value={`${shift.start_time.substring(0,5)}-${shift.end_time.substring(0,5)}`}>
                                                                    {shift.name} ({dateToAmPm(shift.start_time)} - {dateToAmPm(shift.end_time)})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <div className="flex items-center w-full text-sm text-gray-400 italic px-3 bg-gray-50 h-[38px] rounded-md border border-dashed border-gray-200">
                                                            No shift assigned for this day
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-6 sm:flex sm:flex-row-reverse border-t border-gray-200 pt-5">
                                        <button 
                                            type="submit" 
                                            disabled={baseProcessing}
                                            className="inline-flex w-full justify-center rounded-md border border-transparent bg-emerald-600 px-6 py-2 text-base font-bold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                                        >
                                            Save Weekly Pattern
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setShowBaseModal(false)}
                                            className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-6 py-2 text-base font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 🟢 NEW: CUSTOM ALERT FOR EMPTY GRID */}
            {showEmptyGridAlert && (
                <div className="fixed inset-0 z-[70] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowEmptyGridAlert(false)}></div>

                        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
                        <div className="inline-block transform overflow-hidden rounded-xl bg-white text-left align-bottom shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:align-middle relative z-10">
                            <div className="bg-white p-6">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 sm:h-10 sm:w-10">
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-gray-900" id="modal-title">
                                            Grid is Empty
                                        </h3>
                                        <p className="mt-2 text-sm text-gray-500">
                                            Please select and add at least one employee to the grid before assigning a base schedule.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row-reverse gap-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowEmptyGridAlert(false)}
                                    className="w-full sm:w-auto inline-flex justify-center rounded-md bg-indigo-600 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                                >
                                    OK, got it
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* OVERRIDE SHIFT MODAL */}
            {showOverrideModal && (
                <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowOverrideModal(false)}></div>

                        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
                        <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle relative z-10">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Override Selected Days</h3>
                                
                                <div className="mb-4 rounded-md bg-blue-50 p-4 border border-blue-100">
                                    <p className="text-sm text-blue-700">You are applying a daily override to <strong>{selectedCells.length} specific day(s)</strong>.</p>
                                </div>
                                
                                <form onSubmit={submitOverride} className="space-y-6">
                                    <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-md bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                            checked={overrideData.is_off_day}
                                            onChange={e => setOverrideData('is_off_day', e.target.checked)}
                                        />
                                        <span className="text-sm font-medium text-gray-700">Mark these dates as Off Days</span>
                                    </label>

                                    {!overrideData.is_off_day && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">New Shift for Selected Days</label>
                                            <select 
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                value={overrideData.shift_start && overrideData.shift_end ? `${overrideData.shift_start}-${overrideData.shift_end}` : ''}
                                                onChange={e => {
                                                    const [start, end] = e.target.value.split('-');
                                                    const matchedShift = shifts.find(s => s.start_time.startsWith(start) && s.end_time.startsWith(end));
                                                    setOverrideData(prev => ({ 
                                                        ...prev, 
                                                        shift_start: start, 
                                                        shift_end: end, 
                                                        shift_type: matchedShift ? matchedShift.shift_type : 'Day Shift' 
                                                    }));
                                                }}
                                                required
                                            >
                                                <option value="" disabled>-- Select an Authorized Shift --</option>
                                                {shifts.map(shift => (
                                                    <option key={shift.id} value={`${shift.start_time.substring(0,5)}-${shift.end_time.substring(0,5)}`}>
                                                        {shift.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse border-t border-gray-200 pt-4">
                                        <button 
                                            type="submit" 
                                            disabled={overrideProcessing}
                                            className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                                        >
                                            Apply Override
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setShowOverrideModal(false)}
                                            className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 🟢 CUSTOM IN-APP CONFIRMATION MODAL */}
            {showResetConfirmModal && (
                <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => !isResetting && setShowResetConfirmModal(false)}></div>

                        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
                        <div className="inline-block transform overflow-hidden rounded-xl bg-white text-left align-bottom shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:align-middle relative z-10">
                            <div className="bg-white p-6">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 sm:h-10 sm:w-10">
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-gray-900" id="modal-title">
                                            Reset Schedule Overrides?
                                        </h3>
                                        <p className="mt-2 text-sm text-gray-500">
                                            Are you sure you want to remove the manual overrides for <strong className="text-gray-800 font-semibold">{selectedCells.length} selected date(s)</strong> and return them to their default cut-off schedule?
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row-reverse gap-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={handleConfirmReset}
                                    disabled={isResetting}
                                    className="w-full sm:w-auto inline-flex justify-center rounded-md bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                                >
                                    {isResetting ? 'Resetting...' : 'Yes, Reset Overrides'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowResetConfirmModal(false)}
                                    disabled={isResetting}
                                    className="w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </SidebarLayout>
    );
}

// Simple helper to format time nicely in the dropdowns
function dateToAmPm(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    return `${hours}:${m} ${ampm}`;
}