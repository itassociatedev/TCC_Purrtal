import React, { useState, useRef, useEffect, useMemo } from 'react';
import { usePage } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';

export default function Calendar({ employees = [] }) {
    // Grab the currently authenticated user
    const { auth } = usePage().props;
    const authUserId = auth?.user?.id ? auth.user.id.toString() : '';

    const attendanceLinks = [
        { label: 'Attendance Overview', href: route('attendance.overview'), active: route().current('attendance.overview') },
        { label: 'Setup Schedule', href: route('attendance.setup-schedule'), active: route().current('attendance.setup-schedule') },
        { label: 'Schedule View', href: route('attendance.schedule-view'), active: route().current('attendance.schedule-view') },
        { label: 'Calendar', href: route('attendance.calendar'), active: route().current('attendance.calendar') },
    ];

    // ==========================================
    // STATES
    // ==========================================
    // Automatically select the logged-in user by default
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(authUserId);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    // Calendar Dates
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());

    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ==========================================
    // HELPERS & LOGIC
    // ==========================================
    const daysOfWeekSunToSat = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

    // Calculate grid blocks
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

    const activeEmployee = useMemo(() => {
        if (!selectedEmployeeId) return null;
        return employees.find(e => e.id.toString() === selectedEmployeeId) || null;
    }, [employees, selectedEmployeeId]);

    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => 
            searchQuery.trim() === '' || emp.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [employees, searchQuery]);

    // Core shift logic (identifies overrides vs master schedules)
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
                        <div className="relative rounded-md shadow-sm" ref={dropdownRef}>
                            <div className="relative flex items-center">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder={activeEmployee ? activeEmployee.name : "Search employee..."}
                                    className={`block w-64 rounded-md border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:ring-indigo-500 ${activeEmployee ? 'font-semibold text-indigo-700 bg-indigo-50 border-indigo-200' : ''}`}
                                    value={searchQuery}
                                    onChange={e => { setSearchQuery(e.target.value); setIsDropdownOpen(true); }}
                                    onFocus={() => setIsDropdownOpen(true)}
                                />
                            </div>

                            {isDropdownOpen && (
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
                            }}
                            className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors"
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

                    {/* Strict Aspect Ratio Grid */}
                    <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                        {monthDays.map((slot, index) => {
                            if (slot.isPadding) {
                                return <div key={`padding-${index}`} className="w-full aspect-square xl:aspect-[4/3] rounded-md border border-gray-100 bg-gray-50/50"></div>;
                            }

                            const { isOff, shiftType, startTime, endTime, isOverride } = getShiftDetails(activeEmployee, slot.dateString, slot.dayName);
                            
                            return (
                                <div 
                                    key={`day-${slot.dayNum}`} 
                                    className={`w-full aspect-square xl:aspect-[4/3] flex flex-col rounded-md border p-1.5 sm:p-2.5 shadow-sm transition-colors overflow-hidden ${
                                        !activeEmployee ? 'border-gray-100 bg-white' :
                                        isOverride ? 'border-amber-200 bg-amber-50/30' : 
                                        'border-gray-200 bg-white hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-sm font-semibold ${isOverride ? 'text-amber-700' : 'text-gray-700'}`}>{slot.dayNum}</span>
                                        {isOverride && <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider bg-amber-100 px-1.5 py-0.5 rounded shadow-sm">Modified</span>}
                                    </div>

                                    {activeEmployee ? (
                                        <div className="mt-1 sm:mt-2 flex flex-col items-center justify-center flex-1 gap-1 sm:gap-1.5">
                                            {renderShiftBadge(shiftType, isOff)}
                                            {!isOff && startTime && endTime && (
                                                <span className={`text-[9px] sm:text-[10px] font-medium leading-tight font-mono text-center ${isOverride ? 'text-amber-700' : 'text-gray-500'}`}>
                                                    {startTime}<br/>|<br/>{endTime}
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                            <span className="text-[10px] text-gray-400 italic">Select employee</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        </SidebarLayout>
    );
}