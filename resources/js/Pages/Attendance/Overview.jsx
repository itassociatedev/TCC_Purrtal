import React, { useState, useMemo } from 'react';
import { Link, usePage } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import Modal from '@/Components/Modal';

// 🟢 HELPER: Gets today's date strictly in YYYY-MM-DD format (avoids timezone shift bugs)
const getTodayString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

// 🟢 DYNAMIC HELPER: Identifies the active cut-off period based on the database settings
const getCutoffValueForDate = (dateObj, settings) => {
    const y = dateObj.getFullYear();
    const m = dateObj.getMonth();
    const d = dateObj.getDate();
    const prevM = m === 0 ? 11 : m - 1;
    const prevY = m === 0 ? y - 1 : y;

    const c1s = parseInt(settings?.cutoff_1_start || 21);
    const c1e = parseInt(settings?.cutoff_1_end || 5);
    const c2s = parseInt(settings?.cutoff_2_start || 6);
    const c2e = parseInt(settings?.cutoff_2_end || 20);

    if (d >= c2s && d <= c2e) {
        return { start: `${y}-${String(m + 1).padStart(2, '0')}-${String(c2s).padStart(2, '0')}`, end: `${y}-${String(m + 1).padStart(2, '0')}-${String(c2e).padStart(2, '0')}` };
    } else if (d > c2e) {
        const nextM = m === 11 ? 0 : m + 1;
        const nextY = m === 11 ? y + 1 : y;
        return { start: `${y}-${String(m + 1).padStart(2, '0')}-${String(c1s).padStart(2, '0')}`, end: `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(c1e).padStart(2, '0')}` };
    } else {
        return { start: `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(c1s).padStart(2, '0')}`, end: `${y}-${String(m + 1).padStart(2, '0')}-${String(c1e).padStart(2, '0')}` };
    }
};

// 🟢 HELPER: Extracts the precise shift a person has for a specific day
const getShiftDetails = (emp, dateString, dayName) => {
    if (!emp) return { isOff: false, isLeave: false, shiftType: null, startTime: null, endTime: null, isOverride: false, baseHadShift: false };
    
    const activeSchedule = emp.schedules?.find(sch => dateString >= sch.start_date && dateString <= sch.end_date);
    
    // 🟢 BUG FIX 2: Evaluate if the base schedule actually contained a shift for this day!
    let baseHadShift = false;
    if (activeSchedule) {
        if (activeSchedule.pattern && activeSchedule.pattern[dayName]) {
            const p = activeSchedule.pattern[dayName];
            baseHadShift = !!p.shift_type && !p.is_off_day && !p.is_leave;
        } else {
            baseHadShift = !!activeSchedule.shift_type && !activeSchedule.off_days?.includes(dayName);
        }
    }

    // 1. Check for overrides (either manual UI edits or Excel imports)
    const override = emp.overrides?.[dateString];
    if (override) {
        return {
            isOff: override.is_off_day,
            isLeave: override.is_leave, // 🟢 FEATURE 4
            shiftType: override.shift_type,
            startTime: override.start_time,
            endTime: override.end_time,
            // 🟢 The Magic Switch: Only shows yellow if it was manually overridden in UI!
            isOverride: override.is_manual,
            baseHadShift
        };
    }

    // 2. Fall back to Base Schedule rules
    if (activeSchedule) {
        // 🟢 FIXED: Now correctly reads the newly implemented 7-day pattern!
        if (activeSchedule.pattern && activeSchedule.pattern[dayName]) {
            const dayConfig = activeSchedule.pattern[dayName];
            return {
                isOff: dayConfig.is_off_day,
                isLeave: dayConfig.is_leave || false, // 🟢 FEATURE 4
                shiftType: dayConfig.shift_type,
                startTime: dayConfig.shift_start,
                endTime: dayConfig.shift_end,
                isOverride: false,
                baseHadShift
            };
        }

        // Legacy fallback
        return {
            isOff: activeSchedule.off_days?.includes(dayName),
            isLeave: false, // 🟢 FEATURE 4
            shiftType: activeSchedule.shift_type,
            startTime: activeSchedule.start_time,
            endTime: activeSchedule.end_time,
            isOverride: false,
            baseHadShift
        };
    }

    return { isOff: false, isLeave: false, shiftType: null, startTime: null, endTime: null, isOverride: false, baseHadShift: false };
};

// 🟢 NEW HELPER: Generates the dynamic dates for Weekly, Cut-off, or Monthly views
const getSummaryDates = (targetDateString, mode, settings) => {
    const [y, m, d] = targetDateString.split('-').map(Number);
    const baseDate = new Date(y, m - 1, d);

    let startDate, endDate;

    if (mode === 'weekly') {
        const dayOfWeek = baseDate.getDay() === 0 ? 6 : baseDate.getDay() - 1; 
        startDate = new Date(baseDate);
        startDate.setDate(baseDate.getDate() - dayOfWeek);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
    } else if (mode === 'cutoff') {
        const cutoff = getCutoffValueForDate(baseDate, settings);
        startDate = new Date(cutoff.start.split('-')[0], cutoff.start.split('-')[1] - 1, cutoff.start.split('-')[2]);
        endDate = new Date(cutoff.end.split('-')[0], cutoff.end.split('-')[1] - 1, cutoff.end.split('-')[2]);
    } else { // monthly
        startDate = new Date(y, m - 1, 1);
        endDate = new Date(y, m, 0); // Day 0 gives the last day of the month
    }
    
    let days = [];
    let cur = new Date(startDate);
    
    while (cur <= endDate) {
        const curStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        days.push({ 
            dateString: curStr, 
            dayName: cur.toLocaleDateString('en-US', { weekday: 'long' }), 
            displayDay: cur.toLocaleDateString('en-US', { weekday: 'short' }), 
            displayDate: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            isTargetDate: curStr === targetDateString,
            count: 0
        });
        cur.setDate(cur.getDate() + 1);
    }
    return days;
};

export default function Overview({ employees = [], branches = [], cutoffSettings = {} }) {
    const { auth } = usePage().props;
    
    // 🔐 ACL UI LOCK
    const canViewFullOverview = (() => {
        if (auth?.user?.role_id === 1 || auth?.user?.role?.name?.toLowerCase() === 'admin') return true;
        const level = auth?.user?.acl_permissions?.attendance_overview?.toLowerCase() || 'no_access';
        return ['full', 'edit'].includes(level);
    })();

    // 🟢 DYNAMIC SIDEBAR LINKS
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

    // 🟢 ACL CHECK: Missing Schedules Block
    const isSuperAdmin = auth?.user?.role_id === 1 || auth?.user?.role?.name?.toLowerCase() === 'admin';
    const overviewAclLevel = auth?.user?.acl_permissions?.attendance_overview?.toLowerCase() || 'no_access';
    const canFixMissingSched = isSuperAdmin || ['full', 'edit'].includes(overviewAclLevel);

    const [selectedDate, setSelectedDate] = useState(getTodayString());
    const [rosterSearch, setRosterSearch] = useState('');
    
    // Global Filter States
    const [globalDept, setGlobalDept] = useState('');
    const [globalBranch, setGlobalBranch] = useState('');
    const [summaryViewMode, setSummaryViewMode] = useState('weekly'); // 🟢 NEW: 'weekly', 'cutoff', 'monthly'
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    const uniqueDepartments = useMemo(() => {
        return [...new Set(employees.map(e => (typeof e.department === 'object' ? e.department?.name : e.department) || 'Unassigned'))]
            .filter(dept => dept !== 'Unassigned')
            .sort();
    }, [employees]);

    // ==========================================
    // REAL-TIME DATA CRUNCHING
    // ==========================================
    const viewingDateObj = new Date(selectedDate.split('-')[0], selectedDate.split('-')[1] - 1, selectedDate.split('-')[2]);
    const viewingDisplay = viewingDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const viewingDayName = viewingDateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const currentCutoff = getCutoffValueForDate(viewingDateObj, cutoffSettings);

    // 1. Filter globally based on dept AND branch
    const globallyFilteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const deptName = typeof emp.department === 'object' ? emp.department?.name : emp.department || 'Unassigned';
            const matchesDept = globalDept === '' || deptName === globalDept;

            const selectedBranchId = Number(globalBranch);
            const matchesBranch = globalBranch === '' || 
                Number(emp.branch_id) === selectedBranchId || 
                (emp.assigned_branch_ids && emp.assigned_branch_ids.includes(selectedBranchId));

            return matchesDept && matchesBranch;
        });
    }, [employees, globalDept, globalBranch]);

    // 2. Calculate EVERYTHING using the Globally Filtered Employees
    const analytics = useMemo(() => {
        let scheduledCount = 0;
        let offDutyCount = 0;
        let activeOverridesCount = 0;
        let specialDutiesCount = 0;
        let unassignedStaff = [];
        let roster = [];
        
        // 🟢 FIXED: Calls our new dynamic date array generator!
        let summaryCounts = getSummaryDates(selectedDate, summaryViewMode, cutoffSettings); 

        globallyFilteredEmployees.forEach(emp => {
            const hasActiveCutoffSchedule = emp.schedules?.some(sch => currentCutoff.start >= sch.start_date && currentCutoff.end <= sch.end_date);
            if (!hasActiveCutoffSchedule) unassignedStaff.push(emp);

            // Roster Check for the specific day
            const details = getShiftDetails(emp, selectedDate, viewingDayName);
            if (details.isOverride) activeOverridesCount++;

            if (details.shiftType || details.isOff || details.isLeave) {
                roster.push({ 
                    ...emp, 
                    ...details, 
                    // 🟢 BUG FIX 2: Only show "Modified" if a Base Schedule existed and got overridden.
                    showModifiedBadge: details.isOverride && details.baseHadShift,
                    deptName: typeof emp.department === 'object' ? emp.department?.name : emp.department || 'Unassigned' 
                });
                
                if (details.isOff || details.isLeave) offDutyCount++;
                else {
                    scheduledCount++;
                    if (details.shiftType === 'Graveyard Shift' || details.shiftType === 'Straight Duty') specialDutiesCount++;
                }
            }

            // Summary Loop Count
            summaryCounts.forEach((day, index) => {
                const dayDetails = getShiftDetails(emp, day.dateString, day.dayName);
                if (dayDetails.shiftType && !dayDetails.isOff && !dayDetails.isLeave) summaryCounts[index].count++;
            });
        });

        roster.sort((a, b) => (a.isOff === b.isOff) ? 0 : a.isOff ? 1 : -1);

        return { scheduledCount, offDutyCount, activeOverridesCount, specialDutiesCount, unassignedStaff, roster, summaryCounts };
    }, [globallyFilteredEmployees, selectedDate, viewingDayName, currentCutoff, summaryViewMode, cutoffSettings]);

    // 3. The Roster Table
    const filteredRoster = useMemo(() => {
        return analytics.roster.filter(emp => rosterSearch === '' || emp.name.toLowerCase().includes(rosterSearch.toLowerCase()));
    }, [analytics.roster, rosterSearch]);

    // 🟢 FEATURE 4: Handle Leave Display
    const renderShiftBadge = (shiftType, isOffDay, isLeave = false) => {
        if (isLeave) return <span className="inline-flex rounded border border-orange-200 bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700 shadow-sm uppercase tracking-wider">Leave</span>;
        if (isOffDay) return <span className="inline-flex rounded border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 shadow-sm">Off Day</span>;
        switch (shiftType) {
            case 'Day Shift': return <span className="inline-flex rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 shadow-sm">Day Shift</span>;
            case 'Straight Duty': return <span className="inline-flex rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 shadow-sm">Straight Duty</span>;
            case 'Graveyard Shift': return <span className="inline-flex rounded bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 shadow-sm">Graveyard Shift</span>;
            default: return <span className="inline-flex rounded border border-gray-100 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-400">No Shift</span>;
        }
    };

    const exportBaseUrl = route('attendance.export-overview');
    const fullReportUrl = `${exportBaseUrl}?start_date=${currentCutoff.start}&end_date=${currentCutoff.end}&branch_id=${globalBranch}&department=${globalDept}`;
    const blankFormatUrl = `${exportBaseUrl}?start_date=${currentCutoff.start}&end_date=${currentCutoff.end}&branch_id=${globalBranch}&department=${globalDept}&format_only=1`;

    return (
        <SidebarLayout
            activeModule="Attendance"
            sidebarLinks={attendanceLinks}
            header={
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-semibold leading-tight text-gray-800">Attendance Overview</h2>
                        <span className="hidden sm:inline-block px-2.5 py-1 rounded bg-indigo-50 text-xs font-bold text-indigo-700 border border-indigo-100">
                            {viewingDisplay}
                        </span>
                    </div>
                    
                    {/* GLOBAL FILTERS */}
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="w-full sm:w-auto flex gap-2">
                            {/* 🟢 FIXED: Dropdown Lock Logic for Branches */}
                            {branches.length > 1 ? (
                                <select 
                                    className="block w-full sm:w-[150px] rounded-md border-gray-300 py-1.5 pl-3 pr-8 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white cursor-pointer font-medium text-gray-700"
                                    value={globalBranch}
                                    onChange={e => setGlobalBranch(e.target.value)}
                                >
                                    <option value="">{isSuperAdmin ? 'All Branches' : 'All My Branches'}</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-500 font-medium w-full sm:w-[150px] truncate shadow-inner cursor-not-allowed">
                                    {branches[0]?.name || 'All Branches'}
                                </div>
                            )}

                            {/* 🟢 FIXED: Dropdown Lock Logic for Departments */}
                            {isSuperAdmin ? (
                                <select 
                                    className="block w-full sm:w-[160px] rounded-md border-gray-300 py-1.5 pl-3 pr-8 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white cursor-pointer font-medium text-gray-700"
                                    value={globalDept}
                                    onChange={e => setGlobalDept(e.target.value)}
                                >
                                    <option value="">All Departments</option>
                                    {uniqueDepartments.map(dept => (
                                        <option key={dept} value={dept}>{dept}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-500 font-medium w-full sm:w-[160px] truncate shadow-inner cursor-not-allowed">
                                    {auth?.user?.department?.name || uniqueDepartments[0] || 'My Department'}
                                </div>
                            )}
                        </div>

                        <div className="w-full sm:w-auto flex items-center gap-2 bg-white rounded-lg border border-gray-300 p-1 shadow-sm">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-2 hidden sm:block">Viewing:</label>
                            <input 
                                type="date" 
                                className="w-full sm:w-auto border-none bg-transparent py-1.5 text-sm font-semibold text-indigo-700 focus:ring-0 cursor-pointer"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                            />
                            <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block"></div>
                            <button 
                                onClick={() => setSelectedDate(getTodayString())}
                                className="rounded px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
                            >
                                Today
                            </button>
                        </div>
                    </div>
                </div>
            }
        >
            <div className="space-y-6">

                {/* HEADER & EXPORT */}
                <div className="flex flex-col sm:flex-row justify-between items-center bg-white rounded-xl shadow-sm border border-gray-200 p-4 gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Schedule Dashboard</h2>
                        <p className="text-xs text-gray-500 mt-1">Showing data from <span className="font-semibold text-indigo-600">{analytics.summaryCounts[0]?.displayDate}</span> to <span className="font-semibold text-indigo-600">{analytics.summaryCounts[analytics.summaryCounts.length - 1]?.displayDate}</span></p>
                    </div>
                    <button
                        onClick={() => setIsExportModalOpen(true)}
                        className="inline-flex items-center px-4 py-2 bg-green-600 border border-transparent rounded-md font-semibold text-xs text-white uppercase tracking-widest hover:bg-green-700 transition ease-in-out duration-150 shadow-sm"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export Options
                    </button>
                </div>
                
                {/* KPI CARDS */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <svg className="w-16 h-16 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path></svg>
                        </div>
                        <dt className="truncate text-sm font-medium text-gray-500">Scheduled on Date</dt>
                        <dd className="mt-2 text-3xl font-black tracking-tight text-gray-900">{analytics.scheduledCount}</dd>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <svg className="w-16 h-16 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M11.47 3.84a.75.75 0 011.06 0l8.99 9a.75.75 0 101.06-1.06l-8.99-9a2.25 2.25 0 00-3.18 0l-8.99 9a.75.75 0 001.06 1.06l8.99-9z" />
                                <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
                            </svg>
                        </div>
                        <dt className="truncate text-sm font-medium text-gray-500">Off Duty on Date</dt>
                        <dd className="mt-2 text-3xl font-black tracking-tight text-gray-900">{analytics.offDutyCount}</dd>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <svg className="w-16 h-16 text-purple-600" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path></svg>
                        </div>
                        <dt className="truncate text-sm font-medium text-gray-500">Special Duties (Grave/Straight)</dt>
                        <dd className="mt-2 text-3xl font-black tracking-tight text-gray-900">{analytics.specialDutiesCount}</dd>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <svg className="w-16 h-16 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg>
                        </div>
                        <dt className="truncate text-sm font-medium text-gray-500">Active Shift Overrides</dt>
                        <dd className="mt-2 text-3xl font-black tracking-tight text-gray-900">{analytics.activeOverridesCount}</dd>
                    </div>
                </div>

                {/* 🟢 DYNAMIC SCHEDULE SUMMARY */}
                <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                    <div className="border-b border-gray-200 bg-gray-50/50 px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-base font-bold text-gray-900">Schedule Summary</h3>
                            <p className="text-xs text-gray-500 mt-1">Select a date to view the scheduled daily roster.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            
                            <div className="w-[150px] text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider hidden sm:block">
                                {analytics.summaryCounts[0]?.displayDate} – {analytics.summaryCounts[analytics.summaryCounts.length - 1]?.displayDate}
                            </div>

                            <div className="flex bg-gray-200/50 rounded-lg p-1 shadow-inner border border-gray-200 w-[210px]">
                                {[
                                    { id: 'weekly', label: 'Weekly' },
                                    { id: 'cutoff', label: 'Cut-off' },
                                    { id: 'monthly', label: 'Monthly' }
                                ].map(mode => (
                                    <button
                                        key={mode.id}
                                        onClick={() => setSummaryViewMode(mode.id)}
                                        className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-all ${
                                            summaryViewMode === mode.id 
                                            ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' 
                                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                        }`}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    {/* 🟢 RESPONSIVE DYNAMIC GRID: Increased text sizes! */}
                    <div className="overflow-x-auto w-full">
                        <div 
                            className="grid border-l border-t border-gray-100 min-w-[700px] xl:min-w-full" 
                            style={{
                                gridTemplateColumns: summaryViewMode === 'weekly' 
                                    ? 'repeat(7, minmax(0, 1fr))' 
                                    : summaryViewMode === 'cutoff' 
                                        ? `repeat(${analytics.summaryCounts.length}, minmax(0, 1fr))` 
                                        : 'repeat(16, minmax(0, 1fr))'
                            }}
                        >
                            {analytics.summaryCounts.map(day => (
                                <div 
                                    key={day.dateString} 
                                    onClick={() => setSelectedDate(day.dateString)}
                                    className={`py-3 sm:py-4 px-2 flex flex-col items-center justify-center cursor-pointer transition-colors border-r border-b border-gray-100 ${
                                        day.isTargetDate ? 'bg-indigo-50/80 ring-1 ring-inset ring-indigo-300 shadow-inner' : 'bg-white hover:bg-indigo-50/40'
                                    }`}
                                >
                                    {/* 🟢 FIXED: Bumped up to text-xs sm:text-sm */}
                                    <span className={`text-xs sm:text-sm font-bold uppercase tracking-widest ${day.isTargetDate ? 'text-indigo-600' : 'text-gray-400'}`}>
                                        {day.displayDay}
                                    </span>
                                    {/* 🟢 FIXED: Bumped up to text-xs sm:text-sm */}
                                    <span className={`text-xs sm:text-sm mt-0.5 font-semibold ${day.isTargetDate ? 'text-indigo-900' : 'text-gray-600'}`}>
                                        {day.displayDate}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ROSTER TABLE */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className={`${canFixMissingSched ? 'lg:col-span-2' : 'lg:col-span-3'} rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden flex flex-col`}>
                        <div className="border-b border-gray-200 bg-gray-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Daily Roster <span className="text-gray-400 font-medium ml-1">({viewingDisplay})</span></h3>
                                <p className="text-xs text-gray-500 mt-1">Everyone actively assigned to a schedule for the selected date.</p>
                            </div>
                            
                            <div className="relative w-full sm:w-48">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                                    <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input 
                                    type="text" 
                                    placeholder="Search name..." 
                                    className="w-full rounded-md border-gray-300 py-1.5 pl-8 pr-3 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    value={rosterSearch}
                                    onChange={e => setRosterSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-auto max-h-[600px]">
                            {filteredRoster.length > 0 ? (
                                /* 🟢 FIXED: Added 'table-fixed' to force strict column widths */
                                <table className="min-w-full divide-y divide-gray-200 table-fixed">
                                    <thead className="bg-white sticky top-0 z-10">
                                        <tr>
                                            {/* 🟢 FIXED: Locked widths (50%, 25%, 25%) so they NEVER shift! */}
                                            <th className="w-[50%] px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                                            <th className="w-[25%] px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Shift Type</th>
                                            <th className="w-[25%] px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {filteredRoster.map(emp => (
                                            <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="whitespace-nowrap px-6 py-4 overflow-hidden text-ellipsis">
                                                    <div className="font-bold text-sm text-gray-900 truncate">{emp.name}</div>
                                                    <div className="text-xs text-gray-500 truncate">{emp.deptName}</div>
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {renderShiftBadge(emp.shiftType, emp.isOff, emp.isLeave)}
                                                        {emp.showModifiedBadge && <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Modified</span>}
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 text-right">
                                                    {!(emp.isOff || emp.isLeave) && emp.startTime && emp.endTime ? (
                                                        <span className="text-sm font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                                            {emp.startTime} - {emp.endTime}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm italic text-gray-400">--</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-12 text-center">
                                    <svg className="h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <h3 className="text-sm font-bold text-gray-900">No Match Found</h3>
                                    <p className="mt-1 text-sm text-gray-500">No employees match your current filters.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* MISSING SCHEDULES BLOCK */}
                    {canFixMissingSched && (
                        <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                            <div className="border-b border-rose-100 bg-rose-50 px-6 py-4">
                                <h3 className="text-base font-bold text-rose-900 flex items-center gap-2">
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Missing Schedules
                                    {/* 🟢 NEW: Dynamic Badge Count */}
                                    {analytics.unassignedStaff.length > 0 && (
                                        <span className="ml-1 inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-rose-200 text-rose-800 text-xs font-black shadow-sm border border-rose-300">
                                            {analytics.unassignedStaff.length}
                                        </span>
                                    )}
                                </h3>
                                <p className="text-xs text-rose-700 mt-1">
                                    Active staff with no schedule set for the active <strong className="font-bold">Cut-off</strong>.
                                </p>
                            </div>

                            <div className="flex-1 overflow-auto max-h-[600px] p-4">
                                {analytics.unassignedStaff.length > 0 ? (
                                    <div className="space-y-3">
                                        {analytics.unassignedStaff.map(emp => (
                                            <div key={emp.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">{emp.name}</p>
                                                    <p className="text-xs text-gray-500">{typeof emp.department === 'object' ? emp.department?.name : emp.department || 'Unassigned'}</p>
                                                </div>
                                                <Link 
                                                    href={route('attendance.setup-schedule')}
                                                    className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded transition-colors"
                                                >
                                                    Fix Schedule
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                        <div className="h-12 w-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                        <h3 className="text-sm font-bold text-gray-900">All Clear!</h3>
                                        <p className="mt-1 text-sm text-gray-500">100% of the active staff in this scope have schedules assigned.</p>
                                    </div>
                                )}
                            </div>
                            
                            {analytics.unassignedStaff.length > 0 && (
                                <div className="border-t border-gray-100 bg-gray-50 p-4">
                                    <Link 
                                        href={route('attendance.setup-schedule')}
                                        className="block w-full text-center text-sm font-bold text-indigo-600 hover:text-indigo-800"
                                    >
                                        Go to Setup Schedule &rarr;
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* EXPORT MODAL */}
            <Modal show={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} maxWidth="lg">
                <div className="p-6 bg-white rounded-lg">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-5">
                        <h2 className="text-lg font-bold text-gray-900">Export Options</h2>
                        <button onClick={() => setIsExportModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                        Reports are automatically scoped to the active cut-off period <strong className="text-gray-900 font-bold">({currentCutoff.start} to {currentCutoff.end})</strong>. 
                        Exports will also respect any Branch or Department filters you currently have selected.
                    </p>

                    <div className="space-y-4">
                        {/* Option 1: Full Report */}
                        <a
                            href={fullReportUrl}
                            onClick={() => setIsExportModalOpen(false)}
                            className="flex items-start gap-4 p-4 rounded-xl border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 hover:shadow-md transition-all group"
                        >
                            <div className="bg-indigo-200 text-indigo-600 p-2.5 rounded-lg shrink-0">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-indigo-900 group-hover:text-indigo-700">Full Cut-off Report</h3>
                                <p className="text-xs text-indigo-700 mt-1">Downloads the complete matrix including all assigned schedules, shifts, and overrides.</p>
                            </div>
                        </a>

                        {/* Option 2: Blank Format */}
                        <a
                            href={blankFormatUrl}
                            onClick={() => setIsExportModalOpen(false)}
                            className="flex items-start gap-4 p-4 rounded-xl border border-emerald-100 bg-emerald-50 hover:bg-emerald-100 hover:shadow-md transition-all group"
                        >
                            <div className="bg-emerald-200 text-emerald-600 p-2.5 rounded-lg shrink-0">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-emerald-900 group-hover:text-emerald-700">Blank Format Template</h3>
                                <p className="text-xs text-emerald-700 mt-1">Downloads the exact structure and names for this cut-off, but leaves the daily cells blank for manual filling.</p>
                            </div>
                        </a>
                    </div>
                </div>
            </Modal>
        </SidebarLayout>
    );
}