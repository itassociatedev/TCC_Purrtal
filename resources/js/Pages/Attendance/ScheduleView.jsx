import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useForm } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';

export default function ScheduleView({ employees = [] }) {
    const attendanceLinks = [
        { label: 'Attendance Overview', href: route('attendance.overview'), active: route().current('attendance.overview') },
        { label: 'Setup Schedule', href: route('attendance.setup-schedule'), active: route().current('attendance.setup-schedule') },
        { label: 'Schedule View', href: route('attendance.schedule-view'), active: route().current('attendance.schedule-view') },
        { label: 'Calendar', href: route('attendance.calendar'), active: route().current('attendance.calendar') },
    ];

    const [viewMode, setViewMode] = useState('batch');
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // ==========================================
    // OVERRIDE LOGIC & HELPERS
    // ==========================================
    const [selectedCells, setSelectedCells] = useState([]);
    const [showOverrideModal, setShowOverrideModal] = useState(false);

    const { data: overrideData, setData: setOverrideData, post: postOverride, processing: overrideProcessing, reset: resetOverride } = useForm({
        cells: [],
        shift_start: '',
        shift_end: '',
        shift_type: '',
        is_off_day: false
    });

    const shiftOptions = [
        { value: "07:30-16:30", label: "7:30AM - 4:30PM (07:30-16:30)" },
        { value: "08:00-17:00", label: "8:00AM - 5:00PM (08:00-17:00)" },
        { value: "09:00-18:00", label: "9:00AM - 6:00PM (09:00-18:00)" },
        { value: "10:00-19:00", label: "10:00AM - 7:00PM (10:00-19:00)" },
        { value: "12:00-21:00", label: "12:00PM - 9:00PM (12:00-21:00)" },
        { value: "12:30-21:30", label: "12:30PM - 9:30PM (12:30-21:30)" },
        { value: "05:30-14:30", label: "5:30AM - 2:30 PM (05:30-14:30)" },
        { value: "11:00-20:00", label: "11:00AM - 8:00PM (11:00-20:00)" },
        { value: "13:00-22:00", label: "1:00PM - 10:00PM (13:00-22:00)" },
        { value: "06:00-15:00", label: "6:00AM - 3:00PM (06:00-15:00)" },
        { value: "07:00-16:00", label: "7:00AM - 4:00PM (07:00-16:00)" },
        { value: "09:30-18:30", label: "9:30AM - 6:30PM (09:30-18:30)" },
        { value: "21:00-06:00", label: "9:00PM - 6:00AM (Graveyard Shift)" },
        { value: "07:00-23:00", label: "7:00AM - 11:00PM (Straight Duty)" },
        { value: "08:00-00:00", label: "8:00AM - 12:00AM (Straight Duty)" }
    ];

    const determineShiftType = (start, end) => {
        if (start === "21:00" && end === "06:00") return 'Graveyard Shift';

        const startH = parseInt(start.split(':')[0], 10);
        const startM = parseInt(start.split(':')[1], 10);
        const endH = parseInt(end.split(':')[0], 10);
        const endM = parseInt(end.split(':')[1], 10);

        let totalHours = endH - startH + (endM - startM) / 60;
        if (totalHours < 0) totalHours += 24; 

        if (totalHours >= 15) return 'Straight Duty';

        return 'Day Shift';
    };

    // 🟢 UPDATED: Core logic that enforces the Cut-off Periods!
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

    // ==========================================
    // BATCH VIEW: STATES & LOGIC
    // ==========================================
    const [selectedBatchIds, setSelectedBatchIds] = useState([]);
    const [batchDeptFilter, setBatchDeptFilter] = useState('');
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

    const availableEmployeesForPicker = useMemo(() => {
        return employees.filter(emp => {
            if (selectedBatchIds.includes(emp.id)) return false;
            if (batchSearch.trim() !== '') return emp.name.toLowerCase().includes(batchSearch.toLowerCase());
            if (batchDeptFilter !== '') return (typeof emp.department === 'object' ? emp.department?.name : emp.department)?.toLowerCase() === batchDeptFilter.toLowerCase();
            return true;
        });
    }, [employees, selectedBatchIds, batchSearch, batchDeptFilter]);

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

    const availableSingleEmployees = useMemo(() => {
        return employees.filter(emp => {
            const deptName = typeof emp.department === 'object' ? emp.department?.name : emp.department;
            const matchesDept = singleDeptFilter === '' || (deptName || 'Unassigned').toLowerCase() === singleDeptFilter.toLowerCase();
            const matchesSearch = singleSearch.trim() === '' || emp.name.toLowerCase().includes(singleSearch.toLowerCase());
            return matchesDept && matchesSearch;
        });
    }, [employees, singleDeptFilter, singleSearch]);

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
                        <button onClick={openOverrideModal} className="rounded-md bg-white px-5 py-2 text-sm font-bold text-indigo-600 shadow-md hover:bg-indigo-50 transition-colors">Edit Shifts</button>
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
                                <div className="flex flex-wrap items-center gap-3">
                                    <select
                                        className="rounded-md border-gray-300 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        value={batchDeptFilter}
                                        onChange={e => { setBatchDeptFilter(e.target.value); if (e.target.value) setBatchSearch(''); setIsDropdownOpen(true); }}
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
                                                className="block w-64 rounded-md border-gray-300 py-1.5 pl-9 pr-3 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                value={batchSearch}
                                                onChange={e => { setBatchSearch(e.target.value); if (e.target.value) setBatchDeptFilter(''); setIsDropdownOpen(true); }}
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
                                            {weekDates.map(day => (
                                                <th key={day.dateString} className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 border-b border-gray-200">{day.display}</th>
                                            ))}
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
                                                    
                                                    return (
                                                        <td key={day.dateString} className="px-1 py-1.5 align-middle">
                                                            <div 
                                                                onClick={() => toggleCellSelection(emp.id, day.dateString)}
                                                                className={`min-h-[85px] w-full flex flex-col justify-center items-center gap-1.5 rounded-md border p-2 shadow-sm transition-colors cursor-pointer relative ${
                                                                    isSelected ? 'border-indigo-500 bg-indigo-50 ring-2 ring-inset ring-indigo-500' : 
                                                                    isOverride ? 'border-amber-200 bg-amber-50/30 hover:bg-amber-50' : 
                                                                    'border-gray-200 bg-white hover:bg-gray-50'
                                                                }`}
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
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Department Filter</label>
                                    <select
                                        className="block rounded-md border-gray-300 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 min-w-[150px]"
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
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Search & Select Employee</label>
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
                                                className="block w-64 rounded-md border-gray-300 py-1.5 pl-9 pr-3 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
                                    <select
                                        className="block rounded-md border-gray-300 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        value={currentMonth}
                                        onChange={e => setCurrentMonth(parseInt(e.target.value))}
                                    >
                                        {monthNames.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
                                    <input
                                        type="number"
                                        className="block w-24 rounded-md border-gray-300 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        value={currentYear}
                                        onChange={e => setCurrentYear(parseInt(e.target.value))}
                                    />
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

                            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                                {monthDays.map((slot, index) => {
                                    if (slot.isPadding) {
                                        return <div key={`padding-${index}`} className="w-full aspect-square xl:aspect-[4/3] rounded-md border border-gray-100 bg-gray-50/50"></div>;
                                    }

                                    const { isOff, shiftType, startTime, endTime, isOverride } = getShiftDetails(singleEmployee, slot.dateString, slot.dayName);
                                    const isSelected = singleEmployee ? isCellSelected(singleEmployee.id, slot.dateString) : false;
                                    
                                    return (
                                        <div 
                                            key={`day-${slot.dayNum}`} 
                                            onClick={() => singleEmployee && toggleCellSelection(singleEmployee.id, slot.dateString)}
                                            className={`w-full aspect-square xl:aspect-[4/3] flex flex-col rounded-md border p-1.5 sm:p-2.5 shadow-sm transition-colors overflow-hidden ${
                                                !singleEmployee ? 'border-gray-100 bg-white' :
                                                isSelected ? 'border-indigo-500 bg-indigo-50 ring-2 ring-inset ring-indigo-500 cursor-pointer' : 
                                                isOverride ? 'border-amber-200 bg-amber-50/30 hover:bg-amber-50 cursor-pointer' : 
                                                'border-gray-200 bg-white hover:bg-gray-50 cursor-pointer'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start pointer-events-none">
                                                <span className={`text-sm font-semibold ${isOverride ? 'text-amber-700' : 'text-gray-700'}`}>{slot.dayNum}</span>
                                                {isOverride && <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider bg-amber-100 px-1.5 py-0.5 rounded shadow-sm">Modified</span>}
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

                                    {!overrideData.is_off_day && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">New Shift for Selected Days</label>
                                            <select 
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                value={overrideData.shift_start && overrideData.shift_end ? `${overrideData.shift_start}-${overrideData.shift_end}` : ''}
                                                onChange={e => {
                                                    const [start, end] = e.target.value.split('-');
                                                    const type = determineShiftType(start, end); 
                                                    setOverrideData(prev => ({ ...prev, shift_start: start, shift_end: end, shift_type: type }));
                                                }}
                                                required
                                            >
                                                <option value="" disabled>-- Select an Authorized Shift --</option>
                                                {shiftOptions.map(shift => (
                                                    <option key={shift.value} value={shift.value}>{shift.label}</option>
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
        </SidebarLayout>
    );
}