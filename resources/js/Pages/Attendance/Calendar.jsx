import React, { useState, useRef, useEffect, useMemo } from 'react';
import { usePage } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';

export default function Calendar({ employees = [], branches = [] }) {
    // Grab the currently authenticated user
    const { auth } = usePage().props;
    const authUserId = auth?.user?.id ? auth.user.id.toString() : '';

    // 🔐 ROBUST ACL UI LOCK: Safely checks for Admin role OR case-insensitive full privileges
    const hasFullAccess = (() => {
        if (auth?.user?.role_id === 1 || auth?.user?.role?.name?.toLowerCase() === 'admin') return true;
        const level = auth?.user?.acl_permissions?.attendance_calendar?.toLowerCase() || 'no_access';
        return level === 'full';
    })();

    // 🟢 DYNAMIC SIDEBAR LINKS: Only show modules the user has permission to see
    const checkAccess = (module, requiredLevels) => {
        if (auth?.user?.role_id === 1 || auth?.user?.role?.name?.toLowerCase() === 'admin') return true;
        const level = auth?.user?.acl_permissions?.[module]?.toLowerCase() || 'no_access';
        return requiredLevels.includes(level);
    };

    const attendanceLinks = [
        checkAccess('attendance_overview', ['full', 'edit', 'view']) && { label: 'Attendance Overview', href: route('attendance.overview'), active: route().current('attendance.overview') },
        checkAccess('attendance_setup', ['full', 'edit']) && { label: 'Setup Schedule', href: route('attendance.setup-schedule'), active: route().current('attendance.setup-schedule') },
        checkAccess('attendance_schedule_view', ['full', 'edit']) && { label: 'Schedule View', href: route('attendance.schedule-view'), active: route().current('attendance.schedule-view') },
        checkAccess('attendance_calendar', ['full', 'edit', 'view']) && { label: 'Calendar', href: route('attendance.calendar'), active: route().current('attendance.calendar') },
    ].filter(Boolean);

    // ==========================================
    // STATES
    // ==========================================
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    
    const [branchFilter, setBranchFilter] = useState(''); 
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    // Admin Modal State
    const [summaryDate, setSummaryDate] = useState(null);
    
    // Admin Modal Filter States
    const [summaryBranchFilter, setSummaryBranchFilter] = useState('');
    const [summaryDeptFilter, setSummaryDeptFilter] = useState('');
    const [summarySearchQuery, setSummarySearchQuery] = useState('');

    // Calendar Dates
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());

    const dropdownRef = useRef(null);

    // Close main dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset modal filters when the modal is closed
    useEffect(() => {
        if (!summaryDate) {
            setSummaryBranchFilter('');
            setSummaryDeptFilter('');
            setSummarySearchQuery('');
        }
    }, [summaryDate]);

    // ==========================================
    // HELPERS & LOGIC
    // ==========================================
    const daysOfWeekSunToSat = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // Extract unique departments for the Modal dropdown
    const uniqueDepartments = useMemo(() => {
        return [...new Set(employees.map(e => (typeof e.department === 'object' ? e.department?.name : e.department) || 'Unassigned'))]
            .filter(dept => dept !== 'Unassigned')
            .sort();
    }, [employees]);

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

    const goToToday = () => {
        setCurrentMonth(today.getMonth());
        setCurrentYear(today.getFullYear());
    };

    // Calculate grid blocks and highlight "Today"
    const monthDays = useMemo(() => {
        const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); 
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        let daysArray = [];

        for (let i = 0; i < firstDayIndex; i++) daysArray.push({ dayNum: '', isPadding: true });
        
        // Helper to grab exact today string for comparison
        const t = new Date();
        const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

        for (let i = 1; i <= daysInMonth; i++) {
            const dateObj = new Date(currentYear, currentMonth, i);
            const dateString = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
            
            daysArray.push({ 
                dayNum: i, 
                dayName, 
                dateString, 
                displayDay: dayName, 
                displayDate: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), 
                isPadding: false,
                isToday: dateString === todayStr 
            });
        }

        const trailingPadding = (Math.ceil(daysArray.length / 7) * 7) - daysArray.length;
        for (let i = 0; i < trailingPadding; i++) daysArray.push({ dayNum: '', isPadding: true });

        return daysArray;
    }, [currentYear, currentMonth]);

    const activeEmployee = useMemo(() => {
        if (!selectedEmployeeId) return null;
        return employees.find(e => e.id.toString() === selectedEmployeeId) || null;
    }, [employees, selectedEmployeeId]);

    // Secure Branch Filtering
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const matchesSearch = searchQuery.trim() === '' || emp.name.toLowerCase().includes(searchQuery.toLowerCase());
            
            const selectedBranchId = Number(branchFilter);
            const matchesBranch = branchFilter === '' || 
                Number(emp.branch_id) === selectedBranchId || 
                (emp.assigned_branch_ids && emp.assigned_branch_ids.includes(selectedBranchId));

            return matchesSearch && matchesBranch;
        });
    }, [employees, searchQuery, branchFilter]);

    // Core shift logic
    const getShiftDetails = (emp, dateString, dayName) => {
        if (!emp) return { isOff: false, shiftType: null, startTime: null, endTime: null, isOverride: false };
        
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

        const activeSchedule = emp.schedules?.find(sch => {
            return dateString >= sch.start_date && dateString <= sch.end_date;
        });

        if (activeSchedule) {
            return {
                isOff: activeSchedule.off_days?.includes(dayName),
                shiftType: activeSchedule.shift_type,
                startTime: activeSchedule.start_time,
                endTime: activeSchedule.end_time,
                isOverride: false
            };
        }

        return { isOff: false, shiftType: null, startTime: null, endTime: null, isOverride: false };
    };

    // ADMIN SUMMARY MODAL LOGIC: Crunch numbers for the clicked day
    const daySummaryData = useMemo(() => {
        if (!summaryDate) return [];
        const staffList = [];
        
        employees.forEach(emp => {
            const details = getShiftDetails(emp, summaryDate.dateString, summaryDate.dayName);
            if (details.shiftType && !details.isOff) {
                staffList.push({
                    ...emp,
                    ...details,
                    deptName: typeof emp.department === 'object' ? emp.department?.name : emp.department || 'Unassigned'
                });
            }
        });
        return staffList.sort((a, b) => a.name.localeCompare(b.name));
    }, [summaryDate, employees]);

    // Filter the daySummaryData based on modal dropdowns
    const filteredDaySummaryData = useMemo(() => {
        return daySummaryData.filter(emp => {
            const matchesSearch = summarySearchQuery.trim() === '' || emp.name.toLowerCase().includes(summarySearchQuery.toLowerCase());
            
            const selectedBranchId = Number(summaryBranchFilter);
            const matchesBranch = summaryBranchFilter === '' || 
                Number(emp.branch_id) === selectedBranchId || 
                (emp.assigned_branch_ids && emp.assigned_branch_ids.includes(selectedBranchId));

            const deptName = typeof emp.department === 'object' ? emp.department?.name : emp.department;
            const matchesDept = summaryDeptFilter === '' || (deptName || 'Unassigned').toLowerCase() === summaryDeptFilter.toLowerCase();

            return matchesSearch && matchesBranch && matchesDept;
        });
    }, [daySummaryData, summarySearchQuery, summaryBranchFilter, summaryDeptFilter]);

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
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold leading-tight text-gray-800">Calendar</h2>
                </div>
            }
        >
            <div className="rounded-lg bg-white p-6 shadow-sm">
                
                {/* TOP NAVIGATION BAR */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 border-b border-gray-100 pb-6">
                    
                    {/* Month/Year Arrows */}
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handlePrevMonth} 
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-indigo-600"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                        </button>
                        
                        <div className="w-56 text-center">
                            <h2 className="text-2xl font-black text-gray-800 tracking-tight">
                                {monthNames[currentMonth]} {currentYear}
                            </h2>
                        </div>
                        
                        <button 
                            onClick={handleNextMonth} 
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-indigo-600"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                        </button>

                        <button 
                            onClick={goToToday} 
                            className="ml-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-indigo-600"
                        >
                            Today
                        </button>
                    </div>

                    {/* Employee Selector & "View My Schedule" */}
                    <div className="flex items-center gap-3">
                        
                        {/* LOCKED: Branch Dropdown */}
                        <select
                            className={`block w-36 rounded-md border-gray-300 py-2 text-sm shadow-sm ${!hasFullAccess ? 'bg-gray-100 text-gray-500 cursor-not-allowed opacity-70' : 'focus:border-indigo-500 focus:ring-indigo-500 bg-white cursor-pointer'}`}
                            value={branchFilter}
                            onChange={e => setBranchFilter(e.target.value)}
                            disabled={!hasFullAccess}
                        >
                            <option value="">All Branches</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>

                        <div className="relative rounded-md shadow-sm" ref={dropdownRef}>
                            <div className="relative flex items-center">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                {/* LOCKED: Search Dropdown */}
                                <input
                                    type="text"
                                    placeholder={activeEmployee ? activeEmployee.name : "Search employee..."}
                                    className={`block w-56 lg:w-64 rounded-md border-gray-300 py-2 pl-9 pr-3 text-sm ${!hasFullAccess ? 'bg-gray-100 text-gray-500 cursor-not-allowed opacity-70' : 'focus:border-indigo-500 focus:ring-indigo-500 bg-white'} ${activeEmployee && hasFullAccess ? 'font-semibold text-indigo-700 bg-indigo-50 border-indigo-200' : ''}`}
                                    value={searchQuery}
                                    onChange={e => { setSearchQuery(e.target.value); setIsDropdownOpen(true); }}
                                    onFocus={() => setIsDropdownOpen(true)}
                                    disabled={!hasFullAccess}
                                />
                            </div>

                            {isDropdownOpen && hasFullAccess && (
                                <div className="absolute right-0 z-20 mt-1 max-h-60 w-72 overflow-y-auto rounded-md border border-gray-100 bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
                                    {filteredEmployees.length > 0 ? (
                                        filteredEmployees.map(emp => {
                                            const empDept = typeof emp.department === 'object' ? emp.department?.name : emp.department;
                                            const isSelected = selectedEmployeeId === emp.id.toString();
                                            return (
                                                <button
                                                    key={emp.id}
                                                    onClick={() => {
                                                        setSelectedEmployeeId(emp.id.toString());
                                                        setSearchQuery('');
                                                        setIsDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-900'}`}
                                                >
                                                    <span className="font-medium">{emp.name}</span>
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

                        <button 
                            onClick={() => {
                                setSelectedEmployeeId(authUserId);
                                setSearchQuery('');
                                setBranchFilter(''); 
                            }}
                            className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors whitespace-nowrap"
                        >
                            View My Schedule
                        </button>
                    </div>
                </div>

                {/* CALENDAR GRID */}
                <div className="w-full">
                    
                    {/* Headers */}
                    <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                        {daysOfWeekSunToSat.map(d => (
                            <div key={`header-${d}`} className="rounded-md bg-gray-600 py-2.5 text-center text-xs font-bold text-white uppercase tracking-wider shadow-sm">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* 🟢 FIXED: gridAutoRows set to minmax(110px, auto) to allow safe expansion for heavy text without crushing it */}
                    <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridAutoRows: 'minmax(110px, auto)' }}>
                        {monthDays.map((slot, index) => {
                            if (slot.isPadding) {
                                return <div key={`padding-${index}`} className="h-full w-full rounded-md border border-gray-100 bg-gray-50/50"></div>;
                            }

                            const { isOff, shiftType, startTime, endTime, isOverride } = getShiftDetails(activeEmployee, slot.dateString, slot.dayName);
                            
                            return (
                                <div 
                                    key={`day-${slot.dayNum}`} 
                                    onClick={() => {
                                        if (hasFullAccess) setSummaryDate(slot);
                                    }}
                                    className={`h-full w-full flex flex-col rounded-md border p-1.5 sm:p-2.5 shadow-sm transition-colors relative ${
                                        slot.isToday && !activeEmployee ? 'bg-indigo-50/30 border-indigo-200' :
                                        !activeEmployee ? 'border-gray-100 bg-white' :
                                        isOverride ? 'border-amber-200 bg-amber-50/30' : 
                                        'border-gray-200 bg-white hover:bg-gray-50'
                                    } ${hasFullAccess ? 'cursor-pointer hover:ring-2 hover:ring-indigo-400' : ''}`}
                                >
                                    <div className="flex justify-between items-start pointer-events-none">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-xs sm:text-sm ${slot.isToday ? 'font-black text-indigo-700' : isOverride ? 'font-semibold text-amber-700' : 'font-semibold text-gray-700'}`}>
                                                {slot.dayNum}
                                            </span>
                                            {slot.isToday && <span className="text-[8px] sm:text-[9px] font-bold text-indigo-600 bg-indigo-100 px-1 sm:px-1.5 py-0.5 rounded shadow-sm tracking-wider uppercase">Today</span>}
                                        </div>
                                        {isOverride && <span className="text-[8px] sm:text-[9px] font-bold text-amber-500 uppercase tracking-wider bg-amber-100 px-1 sm:px-1.5 py-0.5 rounded shadow-sm">Modified</span>}
                                    </div>

                                    {activeEmployee ? (
                                        <div className="mt-1 sm:mt-2 flex flex-col items-center justify-center flex-1 gap-1 sm:gap-1.5 pointer-events-none">
                                            {renderShiftBadge(shiftType, isOff)}
                                            {!isOff && startTime && endTime && (
                                                <span className={`text-[9px] sm:text-[10px] font-medium leading-tight font-mono text-center ${isOverride ? 'text-amber-700' : 'text-gray-500'}`}>
                                                    {startTime}<br/>|<br/>{endTime}
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                                            <span className="text-[10px] text-gray-400 italic">Select employee</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ADMIN DAILY SUMMARY MODAL */}
            {summaryDate && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSummaryDate(null)}></div>

                        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
                        <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:align-middle relative z-10">
                            
                            <div className="bg-white">
                                <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-lg font-bold leading-6 text-gray-900" id="modal-title">
                                            Daily Summary
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">{summaryDate.displayDay}, {summaryDate.displayDate}</p>
                                    </div>
                                    <button onClick={() => setSummaryDate(null)} className="text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-full p-1.5 transition-colors focus:outline-none">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>

                                {/* Modal Filters */}
                                <div className="bg-white border-b border-gray-100 px-6 py-3 flex flex-col sm:flex-row gap-3">
                                    <select
                                        className="block w-full sm:w-36 rounded-md border-gray-300 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        value={summaryBranchFilter}
                                        onChange={e => setSummaryBranchFilter(e.target.value)}
                                    >
                                        <option value="">All Branches</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>

                                    <select
                                        className="block w-full sm:w-40 rounded-md border-gray-300 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        value={summaryDeptFilter}
                                        onChange={e => setSummaryDeptFilter(e.target.value)}
                                    >
                                        <option value="">All Departments</option>
                                        {uniqueDepartments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                                    </select>

                                    <div className="relative flex-1">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                                            <svg className="h-3.5 w-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Search name..."
                                            className="block w-full rounded-md border-gray-300 py-1.5 pl-8 pr-3 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                            value={summarySearchQuery}
                                            onChange={e => setSummarySearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>
                                
                                <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                                    {filteredDaySummaryData.length > 0 ? (
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-white sticky top-0">
                                                <tr>
                                                    <th className="py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                                                    <th className="py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Shift Type</th>
                                                    <th className="py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                                {filteredDaySummaryData.map(emp => (
                                                    <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="whitespace-nowrap py-4 pr-3">
                                                            <div className="font-bold text-sm text-gray-900">{emp.name}</div>
                                                            <div className="text-xs text-gray-500">{emp.deptName}</div>
                                                        </td>
                                                        <td className="whitespace-nowrap py-4 pr-3">
                                                            <div className="flex items-center gap-2">
                                                                {renderShiftBadge(emp.shiftType, emp.isOff)}
                                                                {emp.isOverride && <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Modified</span>}
                                                            </div>
                                                        </td>
                                                        <td className="whitespace-nowrap py-4 text-right">
                                                            <span className="text-sm font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                                                {emp.startTime} - {emp.endTime}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="text-center py-10 text-gray-500">
                                            <div className="text-4xl mb-3">📭</div>
                                            <p className="font-medium text-sm text-gray-800">No staff scheduled for this day matching your filters.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 border-t border-gray-200">
                                <button 
                                    type="button" 
                                    onClick={() => setSummaryDate(null)}
                                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Close
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </SidebarLayout>
    );
}