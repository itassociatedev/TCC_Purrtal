import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useForm, usePage, router } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';

export default function ScheduleView({ employees = [], branches = [], shifts = [], cutoffSettings = {} }) {
    // 🟢 ADDED: Extract system props here for serverDate
    const { auth, system } = usePage().props;

    // 🟢 DYNAMIC SIDEBAR LINKS: Only show modules the user has permission to see
    const checkAccess = (module, requiredLevels) => {
        if (auth?.user?.role_id === 1 || auth?.user?.role?.name?.toLowerCase() === 'admin') return true;
        const level = auth?.user?.acl_permissions?.[module]?.toLowerCase() || 'no_access';
        return requiredLevels.includes(level);
    };

    const attendanceLinks = [
        checkAccess('attendance_overview', ['full', 'edit', 'view']) && { label: 'Attendance Overview', href: route('attendance.overview'), active: route().current('attendance.overview') },
        checkAccess('attendance_setup', ['full', 'edit']) && { label: 'Setup Schedule', href: route('attendance.setup-schedule'), active: route().current('attendance.setup-schedule') },
        checkAccess('attendance_schedule_view', ['full', 'edit', 'view']) && { label: 'Schedule View', href: route('attendance.schedule-view'), active: route().current('attendance.schedule-view') },
        checkAccess('attendance_calendar', ['full', 'edit', 'view']) && { label: 'Calendar', href: route('attendance.calendar'), active: route().current('attendance.calendar') },
    ].filter(Boolean);

    // 🔐 ROBUST ACL UI LOCKS FOR SCHEDULE VIEW
    const isSuperAdmin = auth?.user?.role_id === 1 || auth?.user?.role?.name?.toLowerCase() === 'admin';
    const aclLevel = auth?.user?.acl_permissions?.attendance_schedule_view?.toLowerCase() || 'no_access';
    
    // EDIT access allows cell selection and applying overrides
    const canEditSchedule = isSuperAdmin || ['full', 'edit'].includes(aclLevel);
    // FULL access unlocks the red "Reset Default" override deletion tool
    const canResetSchedule = isSuperAdmin || ['full'].includes(aclLevel);

    const [viewMode, setViewMode] = useState('batch');
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // ==========================================
    // 🟢 CUT-OFF HIGHLIGHT LOGIC ENGINE
    // ==========================================
    const currentCutoffRange = useMemo(() => {
        // Use system server date if available, otherwise fallback to local browser time
        const today = new Date(system?.serverDate ? `${system.serverDate}T00:00:00` : new Date().setHours(0,0,0,0));
        const day = today.getDate();
        const month = today.getMonth();
        const year = today.getFullYear();

        // Fallbacks to standard semi-monthly bounds if missing from DB
        const c1s = parseInt(cutoffSettings?.cutoff_1_start || 11);
        const c1e = parseInt(cutoffSettings?.cutoff_1_end || 25);
        const c2s = parseInt(cutoffSettings?.cutoff_2_start || 26);
        const c2e = parseInt(cutoffSettings?.cutoff_2_end || 10);

        let startDate, endDate;

        if (day >= c1s && day <= c1e) {
            // We are in Cutoff 1 (e.g. 11th to 25th)
            startDate = new Date(year, month, c1s);
            endDate = new Date(year, month, c1e);
        } else if (day >= c2s) {
            // We are in the first half of Cutoff 2 (e.g. 26th to end of month)
            startDate = new Date(year, month, c2s);
            endDate = new Date(year, month + 1, c2e); // Pushes to next month automatically
        } else {
            // We are in the second half of Cutoff 2 (e.g. 1st to 10th)
            startDate = new Date(year, month - 1, c2s); // Pushes to prev month automatically
            endDate = new Date(year, month, c2e);
        }

        startDate.setHours(0,0,0,0);
        endDate.setHours(23,59,59,999);

        return { startDate, endDate };
    }, [cutoffSettings, system?.serverDate]);

    // Simple checker to see if a given string matches the active bounds
    const isDateInCurrentCutoff = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(`${dateStr}T12:00:00`); // 12 PM to avoid timezone edge cases
        return d >= currentCutoffRange.startDate && d <= currentCutoffRange.endDate;
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
                isOverride: true 
            };
        }

        // 2. Check Cut-off Schedules: Does the calendar date fall between ANY of the employee's assigned cut-off ranges?
        const activeSchedule = emp.schedules?.find(sch => {
            return dateString >= sch.start_date && dateString <= sch.end_date;
        });

        // If a cut-off schedule applies to this date, render it.
        if (activeSchedule) {
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

    const weekDates = useMemo(() => {
        const today = new Date();
        const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1; 
        
        const monday = new Date(today);
        monday.setDate(today.getDate() - dayOfWeek + (weekOffset * 7));
        
        let days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
            days.push({ dayName, dateString, display: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) });
        }
        return days;
    }, [weekOffset]);

    const currentWeekRange = `${weekDates[0].display} - ${weekDates[6].display}`;
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
        setBatchSearch('');
        setIsDropdownOpen(false);
    };

    // ==========================================
    // SINGLE VIEW: STATES & LOGIC
    // ==========================================
    const [singleEmployeeId, setSingleEmployeeId] = useState('');
    const [singleDeptFilter, setSingleDeptFilter] = useState('');
    const [singleBranchFilter, setSingleBranchFilter] = useState(''); 
    const [singleSearch, setSingleSearch] = useState('');
    const [isSingleDropdownOpen, setIsSingleDropdownOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

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

    const renderShiftBadge = (shiftType, isOffDay) => {
        if (isOffDay) return <span className="inline-flex rounded border border-gray-200 bg-gray-100 px-2 py-1 text-[10px] sm:text-xs font-medium text-gray-600 shadow-sm">Off Day</span>;
        switch (shiftType) {
            case 'Day Shift': return <span className="inline-flex rounded bg-blue-50 px-2 py-1 text-[10px] sm:text-xs font-medium text-blue-700 shadow-sm">Day Shift</span>;
            case 'Straight Duty': return <span className="inline-flex rounded bg-green-50 px-2 py-1 text-[10px] sm:text-xs font-medium text-green-700 shadow-sm">Straight Duty</span>;
            case 'Graveyard Shift': return <span className="inline-flex rounded bg-purple-50 px-2 py-1 text-[10px] sm:text-xs font-medium text-purple-700 shadow-sm">Graveyard Shift</span>;
            default: return <span className="inline-flex rounded border border-gray-100 bg-gray-50 px-2 py-1 text-[10px] sm:text-xs font-medium text-gray-400">No Shift</span>;
        }
    };

    return (
        <SidebarLayout
            activeModule="Attendance"
            sidebarLinks={attendanceLinks}
            header={
                <div className="flex items-center justify-between relative">
                    <h2 className="text-xl font-semibold leading-tight text-gray-800">Schedule View</h2>
                    
                    <div className="inline-flex rounded-lg bg-gray-200 p-1">
                        <button
                            onClick={() => { setViewMode('batch'); setSelectedCells([]); }}
                            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${viewMode === 'batch' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Batch View
                        </button>
                        <button
                            onClick={() => { setViewMode('single'); setSelectedCells([]); }}
                            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${viewMode === 'single' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Single View
                        </button>
                    </div>
                </div>
            }
        >
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

            <div className="rounded-lg bg-white p-6 shadow-sm relative">
                
                {/* ================= BATCH VIEW ================= */}
                {viewMode === 'batch' && (
                    <div className="space-y-6">
                        <div className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Batch Timetable Overview</h3>
                                <div className="mt-2 flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setWeekOffset(prev => prev - 1)} className="rounded border border-gray-300 bg-white px-2 py-1 text-gray-600 shadow-sm hover:bg-gray-50">&larr;</button>
                                        <span className="text-sm font-medium text-gray-700 w-56 text-center">{currentWeekRange}</span>
                                        <button onClick={() => setWeekOffset(prev => prev + 1)} className="rounded border border-gray-300 bg-white px-2 py-1 text-gray-600 shadow-sm hover:bg-gray-50">&rarr;</button>
                                    </div>
                                    <button onClick={() => setWeekOffset(0)} className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100">This Week</button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-semibold text-gray-500">Add Staff to View:</span>
                                <div className="flex flex-wrap items-center gap-2">
                                    
                                    <select
                                        className="rounded-md border-gray-300 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 w-32"
                                        value={batchBranchFilter}
                                        onChange={e => { setBatchBranchFilter(e.target.value); setBatchSearch(''); setIsDropdownOpen(true); }}
                                    >
                                        <option value="">All Branches</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>

                                    <select
                                        className="rounded-md border-gray-300 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 w-36"
                                        value={batchDeptFilter}
                                        onChange={e => { setBatchDeptFilter(e.target.value); setBatchSearch(''); setIsDropdownOpen(true); }}
                                    >
                                        <option value="">All Departments</option>
                                        {uniqueDepartments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                                    </select>

                                    <div className="relative rounded-md shadow-sm" ref={dropdownRef}>
                                        <div className="relative flex items-center">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Search by name..."
                                                className="block w-48 lg:w-64 rounded-md border-gray-300 py-1.5 pl-9 pr-3 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                value={batchSearch}
                                                onChange={e => { setBatchSearch(e.target.value); setIsDropdownOpen(true); }}
                                                onFocus={() => setIsDropdownOpen(true)}
                                            />
                                        </div>

                                        {isDropdownOpen && (
                                            <div className="absolute right-0 z-20 mt-1 max-h-60 w-72 overflow-y-auto rounded-md border border-gray-100 bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
                                                {availableEmployeesForPicker.length > 0 ? (
                                                    availableEmployeesForPicker.map(emp => {
                                                        const isAdded = selectedBatchIds.includes(emp.id);
                                                        const empDept = typeof emp.department === 'object' ? emp.department?.name : emp.department;
                                                        return (
                                                            <button
                                                                key={emp.id}
                                                                onClick={() => !isAdded && addEmployeeToBatch(emp.id)}
                                                                disabled={isAdded}
                                                                className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between transition-colors ${isAdded ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-900'}`}
                                                            >
                                                                <span className="font-medium">{emp.name} {isAdded && <span className="text-[10px] italic ml-1 font-normal">(Added)</span>}</span>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${isAdded ? 'bg-gray-200 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>{empDept || 'Unassigned'}</span>
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="px-4 py-3 text-xs text-gray-400 italic text-center">No matching active employees found.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            {batchEmployeesList.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 border border-gray-100 bg-gray-50 p-3 rounded-lg">
                                    {batchEmployeesList.map(emp => (
                                        <span key={emp.id} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow-sm">
                                            {emp.name}
                                            <button onClick={() => setSelectedBatchIds(prev => prev.filter(i => i !== emp.id))} className="rounded-full bg-indigo-800 px-1 text-[10px] hover:bg-indigo-900 focus:outline-none">✕</button>
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center"><p className="text-sm text-gray-500">No employees selected. Add staff to build the table.</p></div>
                            )}
                        </div>

                        {batchEmployeesList.length > 0 && (
                            <div className="overflow-x-auto pt-2 pb-4">
                                <table className="min-w-full border-collapse border border-gray-200 rounded-lg">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-4 w-1/5 border-b border-gray-200">Employee</th>
                                            {weekDates.map(day => {
                                                // 🟢 CHECK IF THIS DAY IS IN THE CURRENT CUTOFF
                                                const isCutoff = isDateInCurrentCutoff(day.dateString);
                                                return (
                                                    <th key={day.dateString} className={`px-3 py-3.5 text-center text-sm font-semibold text-gray-900 border-b border-gray-200 ${isCutoff ? 'bg-indigo-50 border-t-4 border-t-indigo-400 shadow-sm' : ''}`}>
                                                        {day.display}
                                                        {isCutoff && <div className="text-[9px] text-indigo-600 font-black uppercase mt-0.5 tracking-wider">Current Cut-off</div>}
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {batchEmployeesList.map((emp, idx) => (
                                            <tr key={emp.id} className={idx !== batchEmployeesList.length - 1 ? "border-b border-gray-100" : ""}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-4">
                                                    <div className="font-bold text-gray-800">{emp.name}</div>
                                                    <div className="text-xs text-gray-500">{typeof emp.department === 'object' ? emp.department?.name : emp.department}</div>
                                                </td>
                                                {weekDates.map(day => {
                                                    const { isOff, shiftType, startTime, endTime, isOverride } = getShiftDetails(emp, day.dateString, day.dayName);
                                                    const isSelected = isCellSelected(emp.id, day.dateString);
                                                    const isCutoff = isDateInCurrentCutoff(day.dateString); // 🟢 CHECK CELL
                                                    
                                                    // 🟢 EDIT ACL LOCK: Removes cursor-pointer and hover colors if user only has VIEW access
                                                    return (
                                                        <td key={day.dateString} className={`px-1 py-1.5 align-middle ${isCutoff ? 'bg-indigo-50/20' : ''}`}>
                                                            <div 
                                                                onClick={() => {
                                                                    if (canEditSchedule) toggleCellSelection(emp.id, day.dateString);
                                                                }}
                                                                className={`min-h-[85px] w-full flex flex-col justify-center items-center gap-1.5 rounded-md border p-2 shadow-sm transition-colors relative ${
                                                                    isSelected ? 'border-indigo-500 bg-indigo-50 ring-2 ring-inset ring-indigo-500' : 
                                                                    isOverride ? 'border-amber-200 bg-amber-50/30' : 
                                                                    isCutoff ? 'border-indigo-200 bg-white' : 
                                                                    'border-gray-200 bg-white'
                                                                } ${canEditSchedule ? (isOverride ? 'hover:bg-amber-50 cursor-pointer' : 'hover:bg-gray-50 cursor-pointer') : 'cursor-default'}`}
                                                            >
                                                                {isOverride && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400 shadow-sm"></span>}
                                                                <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                                                                    {renderShiftBadge(shiftType, isOff)}
                                                                    {!isOff && startTime && endTime && (
                                                                        <span className={`text-[10px] font-mono font-medium text-center ${isOverride ? 'text-amber-700' : 'text-gray-500'}`}>
                                                                            {startTime} <br className="hidden xl:block" /> <span className="xl:hidden">-</span> {endTime}
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
                )}

                {/* ================= SINGLE VIEW ================= */}
                {viewMode === 'single' && (
                    <div className="space-y-6">
                        <div className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-wrap items-center gap-4">
                                
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Branch</label>
                                    <select
                                        className="block rounded-md border-gray-300 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 min-w-[120px]"
                                        value={singleBranchFilter}
                                        onChange={e => { 
                                            setSingleBranchFilter(e.target.value); 
                                            setSingleEmployeeId(''); 
                                            setSingleSearch('');
                                            setSelectedCells([]); 
                                        }}
                                    >
                                        <option value="">All Branches</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
                                    <select
                                        className="block rounded-md border-gray-300 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 min-w-[140px]"
                                        value={singleDeptFilter}
                                        onChange={e => { 
                                            setSingleDeptFilter(e.target.value); 
                                            setSingleEmployeeId(''); 
                                            setSingleSearch('');
                                            setSelectedCells([]); 
                                        }}
                                    >
                                        <option value="">All Departments</option>
                                        {uniqueDepartments.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Search Employee</label>
                                    <div className="relative rounded-md shadow-sm" ref={singleDropdownRef}>
                                        <div className="relative flex items-center">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Search by name..."
                                                className="block w-48 lg:w-64 rounded-md border-gray-300 py-1.5 pl-9 pr-3 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                value={singleSearch}
                                                onChange={e => { setSingleSearch(e.target.value); setIsSingleDropdownOpen(true); }}
                                                onFocus={() => setIsSingleDropdownOpen(true)}
                                            />
                                        </div>

                                        {isSingleDropdownOpen && (
                                            <div className="absolute left-0 z-20 mt-1 max-h-60 w-72 overflow-y-auto rounded-md border border-gray-100 bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
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
                                                                className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-900'}`}
                                                            >
                                                                <span className="font-medium">{emp.name} {isSelected && <span className="text-[10px] ml-1 text-indigo-500 font-normal">(Selected)</span>}</span>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>{empDept || 'Unassigned'}</span>
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="px-4 py-3 text-xs text-gray-400 italic text-center">No matching employees found.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 🟢 REPLACED: Converted Month/Year Selectors into a Slider and Legend Button */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Month / Year</label>
                                    <div className="flex items-center gap-1.5">
                                        <button 
                                            onClick={handlePrevMonth}
                                            className="flex items-center justify-center w-8 h-8 rounded-md border border-gray-300 bg-white text-gray-600 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                        >
                                            &larr;
                                        </button>
                                        <div className="flex items-center justify-center w-32 h-8 rounded-md border border-gray-300 bg-white text-sm font-bold text-gray-800 shadow-sm select-none">
                                            {monthNames[currentMonth]} {currentYear}
                                        </div>
                                        <button 
                                            onClick={handleNextMonth}
                                            className="flex items-center justify-center w-8 h-8 rounded-md border border-gray-300 bg-white text-gray-600 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                        >
                                            &rarr;
                                        </button>
                                        
                                        {/* 🟢 NEW: Current Cut-off Legend & Jump Button */}
                                        <button 
                                            onClick={() => {
                                                const d = currentCutoffRange.startDate;
                                                setCurrentMonth(d.getMonth());
                                                setCurrentYear(d.getFullYear());
                                            }}
                                            className="ml-1 sm:ml-2 flex items-center gap-1.5 px-3 h-8 rounded-md border border-indigo-300 bg-indigo-50/80 text-xs font-bold text-indigo-700 shadow-sm hover:bg-indigo-100 transition-colors"
                                            title="Jump to Current Cut-off"
                                        >
                                            <span className="relative flex h-2 w-2">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                            </span>
                                            Current Cut-off
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="text-left lg:text-right bg-gray-50 p-3 rounded-lg border border-gray-100 min-w-[250px]">
                                <h4 className="text-sm font-bold text-gray-800">{singleEmployee?.name || 'No Employee Selected'}</h4>
                                <div className="mt-1 text-xs text-gray-600 flex flex-col gap-0.5">
                                    <span className="font-medium text-gray-500">
                                        {singleEmployee ? (typeof singleEmployee.department === 'object' ? singleEmployee.department?.name : singleEmployee.department || 'Unassigned') : 'Select an employee'}
                                    </span>
                                    {singleEmployee && <span className="text-indigo-600 italic mt-1 font-medium">Schedules vary by cut-off dates.</span>}
                                </div>
                            </div>
                        </div>

                        <div className="w-full">
                            
                            {/* 🟢 FIXED: High-contrast Dark Grey Headers */}
                            <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                                {daysOfWeekSunToSat.map(d => (
                                    <div key={`header-${d}`} className="rounded-md bg-gray-600 py-2.5 text-center text-xs font-bold text-white uppercase tracking-wider shadow-sm">
                                        {d}
                                    </div>
                                ))}
                            </div>

                            {/* 🟢 FIXED: gridAutoRows set to minmax(110px, auto) allows rows to dynamically expand without hiding data */}
                            <div 
                                className="grid gap-1.5" 
                                style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridAutoRows: 'minmax(110px, auto)' }}
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
                                            className={`h-full w-full flex flex-col rounded-md border p-1.5 sm:p-2.5 shadow-sm transition-colors ${
                                                !singleEmployee ? 'border-gray-100 bg-white' :
                                                isSelected ? 'border-indigo-500 bg-indigo-50 ring-2 ring-inset ring-indigo-500' : 
                                                isOverride ? 'border-amber-200 bg-amber-50/30' : 
                                                isCutoff ? 'border-indigo-300 bg-indigo-50/40 ring-1 ring-indigo-100' : 
                                                'border-gray-200 bg-white'
                                            } ${canEditSchedule && singleEmployee ? (isOverride ? 'hover:bg-amber-50 cursor-pointer' : 'hover:bg-gray-50 cursor-pointer') : 'cursor-default'}`}
                                        >
                                            <div className="flex justify-between items-start pointer-events-none">
                                                <span className={`text-xs sm:text-sm font-semibold ${isOverride ? 'text-amber-700' : 'text-gray-700'}`}>{slot.dayNum}</span>
                                                
                                                {/* 🟢 MODIFIED: Removed the Cut-off text label to free up cell space, relying purely on the indigo highlight! */}
                                                <div className="flex flex-col items-end gap-1">
                                                    {isOverride && <span className="text-[8px] sm:text-[9px] font-bold text-amber-500 uppercase tracking-wider bg-amber-100 px-1 sm:px-1.5 py-0.5 rounded shadow-sm">Modified</span>}
                                                </div>
                                            </div>

                                            {singleEmployee && (
                                                <div className="mt-1 sm:mt-2 flex flex-col items-center justify-center flex-1 gap-1 sm:gap-1.5 pointer-events-none">
                                                    {renderShiftBadge(shiftType, isOff)}
                                                    {!isOff && startTime && endTime && (
                                                        <span className={`text-[9px] sm:text-[10px] font-medium leading-tight font-mono text-center ${isOverride ? 'text-amber-700' : 'text-gray-500'}`}>
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

            {/* OVERRIDE SHIFT MODAL */}
            {showOverrideModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowOverrideModal(false)}></div>

                        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
                        <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle relative z-10">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4" id="modal-title">Override Selected Days</h3>
                                
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

                                    {/* 🟢 DYNAMIC SHIFT DROPDOWN: Rendered straight from the database! */}
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

            {/* 🟢 CUSTOM IN-APP CONFIRMATION MODAL (Replaces browser window.confirm) */}
            {showResetConfirmModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
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