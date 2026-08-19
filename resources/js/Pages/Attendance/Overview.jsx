import React, { useState, useMemo } from 'react';
import { Link, usePage } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';

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

    const activeSchedule = emp.schedules?.find(sch => dateString >= sch.start_date && dateString <= sch.end_date);

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

// 🟢 HELPER: Generates the days of the week (Mon-Sun) containing the specific date being viewed
const getWeekDates = (targetDateString) => {
    const [y, m, d] = targetDateString.split('-').map(Number);
    const baseDate = new Date(y, m - 1, d);

    const dayOfWeek = baseDate.getDay() === 0 ? 6 : baseDate.getDay() - 1; // 0 = Mon, 6 = Sun
    
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() - dayOfWeek);
    
    let days = [];

    for (let i = 0; i < 7; i++) {
        const cur = new Date(monday);
        cur.setDate(monday.getDate() + i);
        const curStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        
        days.push({ 
            dateString: curStr, 
            dayName: cur.toLocaleDateString('en-US', { weekday: 'long' }), 
            displayDay: cur.toLocaleDateString('en-US', { weekday: 'short' }), 
            displayDate: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            isTargetDate: curStr === targetDateString,
            count: 0 // Default starting count
        });
    }
    return days;
};

export default function Overview({ employees = [], branches = [], cutoffSettings = {} }) {
    const { auth } = usePage().props;
    
    // 🔐 ROBUST ACL UI LOCK: Safely checks for Admin role OR case-insensitive edit/full privileges
    const canViewFullOverview = (() => {
        if (auth?.user?.role_id === 1 || auth?.user?.role?.name?.toLowerCase() === 'admin') return true;
        const level = auth?.user?.acl_permissions?.attendance_overview?.toLowerCase() || 'no_access';
        return ['full', 'edit'].includes(level);
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
    const [selectedDate, setSelectedDate] = useState(getTodayString());
    const [rosterSearch, setRosterSearch] = useState('');
    
    // Global Filter States
    const [globalDept, setGlobalDept] = useState('');
    const [globalBranch, setGlobalBranch] = useState('');

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

    // 1. Filter the entire employee pool globally based on selected department AND branch
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

    // 2. Calculate EVERYTHING strictly using the Globally Filtered Employees
    const analytics = useMemo(() => {
        let scheduledCount = 0;
        let offDutyCount = 0;
        let activeOverridesCount = 0;
        let specialDutiesCount = 0;
        let unassignedStaff = [];
        let roster = [];
        let weeklyCounts = getWeekDates(selectedDate);

        globallyFilteredEmployees.forEach(emp => {
            // Compliance Check
            const hasActiveCutoffSchedule = emp.schedules?.some(sch => currentCutoff.start >= sch.start_date && currentCutoff.end <= sch.end_date);
            if (!hasActiveCutoffSchedule) {
                unassignedStaff.push(emp);
            }

            // Roster Check for the specific day
            const details = getShiftDetails(emp, selectedDate, viewingDayName);
            
            if (details.isOverride) activeOverridesCount++;

            if (details.shiftType || details.isOff) {
                roster.push({ 
                    ...emp, 
                    ...details, 
                    deptName: typeof emp.department === 'object' ? emp.department?.name : emp.department || 'Unassigned' 
                });
                
                if (details.isOff) {
                    offDutyCount++;
                } else {
                    scheduledCount++;
                    if (details.shiftType === 'Graveyard Shift' || details.shiftType === 'Straight Duty') {
                        specialDutiesCount++;
                    }
                }
            }

            // Weekly Schedule Summary Count
            weeklyCounts.forEach((day, index) => {
                const dayDetails = getShiftDetails(emp, day.dateString, day.dayName);
                if (dayDetails.shiftType && !dayDetails.isOff) {
                    weeklyCounts[index].count++;
                }
            });
        });

        // Sort roster
        roster.sort((a, b) => (a.isOff === b.isOff) ? 0 : a.isOff ? 1 : -1);

        return { scheduledCount, offDutyCount, activeOverridesCount, specialDutiesCount, unassignedStaff, roster, weeklyCounts };
    }, [globallyFilteredEmployees, selectedDate, viewingDayName, currentCutoff]);

    // 3. The Roster Table
    const filteredRoster = useMemo(() => {
        return analytics.roster.filter(emp => {
            return rosterSearch === '' || emp.name.toLowerCase().includes(rosterSearch.toLowerCase());
        });
    }, [analytics.roster, rosterSearch]);

    const renderShiftBadge = (shiftType, isOffDay) => {
        if (isOffDay) return <span className="inline-flex rounded border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 shadow-sm">Off Day</span>;
        switch (shiftType) {
            case 'Day Shift': return <span className="inline-flex rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 shadow-sm">Day Shift</span>;
            case 'Straight Duty': return <span className="inline-flex rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 shadow-sm">Straight Duty</span>;
            case 'Graveyard Shift': return <span className="inline-flex rounded bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 shadow-sm">Graveyard Shift</span>;
            default: return <span className="inline-flex rounded border border-gray-100 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-400">No Shift</span>;
        }
    };

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
                            <select 
                                className="block w-full sm:w-[150px] rounded-md border-gray-300 py-1.5 pl-3 pr-8 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white cursor-pointer font-medium text-gray-700"
                                value={globalBranch}
                                onChange={e => setGlobalBranch(e.target.value)}
                            >
                                <option value="">All Branches</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>

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
                
                {/* ================= KPI CARDS ================= */}
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

                {/* ================= WEEKLY SUMMARY COUNT ================= */}
                <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                    <div className="border-b border-gray-200 bg-gray-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-base font-bold text-gray-900">Weekly Schedule Summary</h3>
                            <p className="text-xs text-gray-500 mt-1">Total headcount scheduled to work each day {globalDept && <span className="font-bold text-indigo-600">in {globalDept}</span>}.</p>
                        </div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Week of {analytics.weeklyCounts[0]?.displayDate} – {analytics.weeklyCounts[6]?.displayDate}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 border-b border-gray-100 sm:border-b-0">
                        {analytics.weeklyCounts.map(day => (
                            <div 
                                key={day.dateString} 
                                onClick={() => setSelectedDate(day.dateString)}
                                className={`p-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                                    day.isTargetDate ? 'bg-indigo-50/70 ring-1 ring-inset ring-indigo-200 shadow-inner' : 'bg-white hover:bg-indigo-50/30'
                                }`}
                            >
                                <span className={`text-xs font-bold uppercase tracking-wider ${day.isTargetDate ? 'text-indigo-700' : 'text-gray-500'}`}>
                                    {day.displayDay}
                                </span>
                                <span className={`text-xs mt-0.5 ${day.isTargetDate ? 'text-indigo-500' : 'text-gray-400'}`}>
                                    {day.displayDate}
                                </span>
                                <span className={`mt-2 text-2xl font-black ${day.isTargetDate ? 'text-indigo-700' : 'text-gray-800'}`}>
                                    {day.count}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 🔐 ACL RESTRICTED SECTION: Only renders for users with EDIT or FULL privileges */}
                {canViewFullOverview && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {/* ================= LEFT COLUMN: DAILY ROSTER ================= */}
                        <div className="lg:col-span-2 rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden flex flex-col">
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
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-white sticky top-0 z-10">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Shift Type</th>
                                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {filteredRoster.map(emp => (
                                                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="whitespace-nowrap px-6 py-4">
                                                        <div className="font-bold text-sm text-gray-900">{emp.name}</div>
                                                        <div className="text-xs text-gray-500">{emp.deptName}</div>
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            {renderShiftBadge(emp.shiftType, emp.isOff)}
                                                            {emp.isOverride && <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Modified</span>}
                                                        </div>
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4 text-right">
                                                        {!emp.isOff && emp.startTime && emp.endTime ? (
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

                        {/* ================= RIGHT COLUMN: SCHEDULE COMPLIANCE ================= */}
                        <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                            <div className="border-b border-rose-100 bg-rose-50 px-6 py-4">
                                <h3 className="text-base font-bold text-rose-900 flex items-center gap-2">
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    Missing Schedules
                                </h3>
                                <p className="text-xs text-rose-700 mt-1">Active staff with no schedule set for the active <strong className="font-bold">Cut-off</strong>.</p>
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
                    </div>
                )}
            </div>
        </SidebarLayout>
    );
}