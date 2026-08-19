import React, { useState, useMemo, useEffect } from 'react';
import { useForm, usePage } from '@inertiajs/react'; 
import SidebarLayout from '@/Layouts/SidebarLayout';

// 🟢 HELPER: Generates the 6-20 and 21-5 cutoff periods automatically
const generateCutoffPeriods = () => {
    const periods = [];
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = -2; i <= 3; i++) {
        const targetDate = new Date(year, month + i, 1);
        const y = targetDate.getFullYear();
        const m = targetDate.getMonth();
        
        const prevM = m === 0 ? 11 : m - 1;
        const prevY = m === 0 ? y - 1 : y;

        // Period 1: 21st to 5th
        const val1 = `${prevY}-${String(prevM + 1).padStart(2, '0')}-21|${y}-${String(m + 1).padStart(2, '0')}-05`;
        const label1 = `${monthNames[prevM]} 21, ${prevY} - ${monthNames[m]} 05, ${y}`;

        // Period 2: 6th to 20th
        const val2 = `${y}-${String(m + 1).padStart(2, '0')}-06|${y}-${String(m + 1).padStart(2, '0')}-20`;
        const label2 = `${monthNames[m]} 06, ${y} - ${monthNames[m]} 20, ${y}`;

        periods.push({ label: label1, value: val1 });
        periods.push({ label: label2, value: val2 });
    }
    return periods;
};

// 🟢 HELPER: Determines which cutoff we are currently in based on today's date
const getCurrentCutoffValue = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    const prevM = m === 0 ? 11 : m - 1;
    const prevY = m === 0 ? y - 1 : y;

    if (d >= 6 && d <= 20) {
        return `${y}-${String(m + 1).padStart(2, '0')}-06|${y}-${String(m + 1).padStart(2, '0')}-20`;
    } else if (d > 20) {
        const nextM = m === 11 ? 0 : m + 1;
        const nextY = m === 11 ? y + 1 : y;
        return `${y}-${String(m + 1).padStart(2, '0')}-21|${nextY}-${String(nextM + 1).padStart(2, '0')}-05`;
    } else {
        return `${prevY}-${String(prevM + 1).padStart(2, '0')}-21|${y}-${String(m + 1).padStart(2, '0')}-05`;
    }
};

export default function SetupSchedule({ employees = [], branches = [] }) {
    const { auth } = usePage().props;

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

    const cutoffPeriodsList = useMemo(() => generateCutoffPeriods(), []);
    const [selectedCutoff, setSelectedCutoff] = useState(getCurrentCutoffValue());

    const [searchTerm, setSearchTerm] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState('');
    
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [isBatchMode, setIsBatchMode] = useState(false);

    const { data, setData, post, processing, reset } = useForm({
        employee_id: '',
        employee_ids: [],
        cutoff_period: selectedCutoff,
        shift_start: '',
        shift_end: '',
        shift_type: '',
        rest_days: []
    });

    useEffect(() => {
        setData('cutoff_period', selectedCutoff);
    }, [selectedCutoff]);

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

    const uniqueDepartments = [...new Set(employees.map(emp => emp.department?.name || emp.department || 'Unassigned'))]
        .filter(dept => dept !== 'Unassigned')
        .sort();

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

    const handleCheckboxChange = (e) => {
        const { value, checked } = e.target;
        if (checked) {
            setData('rest_days', [...data.rest_days, value]);
        } else {
            setData('rest_days', data.rest_days.filter(day => day !== value));
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedEmployees(filteredEmployees.map(emp => emp.id));
        else setSelectedEmployees([]);
    };

    const handleSelectOne = (e, id) => {
        if (e.target.checked) setSelectedEmployees([...selectedEmployees, id]);
        else setSelectedEmployees(selectedEmployees.filter(empId => empId !== id));
    };

    const handleAddSchedule = () => {
        reset();
        setData('cutoff_period', selectedCutoff);
        setIsEditMode(false); 
        setIsBatchMode(false);
        setShowModal(true);
    };

    const handleBatchUpdate = () => {
        if (selectedEmployees.length === 0) {
            alert("Please select at least one employee from the table.");
            return;
        }
        reset();
        setData('cutoff_period', selectedCutoff);
        setIsBatchMode(true);
        setIsEditMode(false);
        setData('employee_ids', selectedEmployees);
        setShowModal(true);
    };

    const getActiveSchedule = (emp) => {
        if (!emp.schedules || emp.schedules.length === 0) return null;
        const [start, end] = selectedCutoff.split('|');
        return emp.schedules.find(s => s.start_date === start && s.end_date === end) || null;
    };

    const handleEditSchedule = (emp) => {
        setIsEditMode(true); 
        setIsBatchMode(false);
        setShowModal(true);

        const activeSchedule = getActiveSchedule(emp);

        if (activeSchedule) {
            setData({
                employee_id: emp.id,
                employee_ids: [],
                cutoff_period: selectedCutoff,
                shift_start: activeSchedule.start_time || '',
                shift_end: activeSchedule.end_time || '',
                shift_type: activeSchedule.shift_type || '',
                rest_days: activeSchedule.raw_off_days || []
            });
        } else {
            setData({
                employee_id: emp.id,
                employee_ids: [],
                cutoff_period: selectedCutoff,
                shift_start: '',
                shift_end: '',
                shift_type: '',
                rest_days: []
            });
        }
    };

    const submit = (e) => {
        e.preventDefault();
        post(route('attendance.setup-schedule.store'), {
            onSuccess: () => {
                setShowModal(false); 
                setSelectedEmployees([]); 
                reset(); 
            }
        });
    };

    const getShiftBadge = (shiftType) => {
        switch (shiftType) {
            case 'Day Shift':
                return <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">Day Shift</span>;
            case 'Straight Duty':
                return <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Straight Duty</span>;
            case 'Graveyard Shift':
                return <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">Graveyard Shift</span>;
            default:
                return <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">No Schedule Set</span>;
        }
    };

    const getInitials = (name) => {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    const filteredEmployees = employees.filter((emp) => {
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
        const deptName = emp.department?.name || emp.department || ''; 
        const matchesDept = departmentFilter === '' || deptName.toLowerCase() === departmentFilter.toLowerCase();
        
        const selectedBranchId = Number(branchFilter);
        const matchesBranch = branchFilter === '' || 
            Number(emp.branch_id) === selectedBranchId || 
            (emp.assigned_branch_ids && emp.assigned_branch_ids.includes(selectedBranchId));

        return matchesSearch && matchesDept && matchesBranch;
    });

    return (
        <SidebarLayout
            activeModule="Attendance"
            sidebarLinks={attendanceLinks}
            header={
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold leading-tight text-gray-800">Set-Up Schedule</h2>
                    <button 
                        onClick={handleAddSchedule}
                        className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                        + Add Schedule
                    </button>
                </div>
            }
        >
            <div className="rounded-lg bg-white shadow-sm">
                
                {/* Cut-off Period Selector Bar */}
                <div className="bg-indigo-50 border-b border-indigo-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-t-lg">
                    <div>
                        <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Viewing Cut-off Period:</span>
                        <p className="text-xs text-indigo-600 mt-0.5">Schedules shown below apply only to the selected dates.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            className="block w-72 rounded-md border-indigo-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm font-semibold text-indigo-900 bg-white shadow-sm"
                            value={selectedCutoff}
                            onChange={(e) => setSelectedCutoff(e.target.value)}
                        >
                            {cutoffPeriodsList.map(period => (
                                <option key={period.value} value={period.value}>{period.label}</option>
                            ))}
                        </select>
                        
                        <button 
                            onClick={() => setSelectedCutoff(getCurrentCutoffValue())}
                            className="rounded-md border border-indigo-200 bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-200"
                        >
                            Current Cutoff
                        </button>
                    </div>
                </div>

                <div className="border-b border-gray-200 p-4 sm:flex sm:items-center sm:justify-between">
                    <div className="flex flex-1 gap-4">
                        
                        <div className="w-full max-w-[150px]">
                            <select
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                value={branchFilter}
                                onChange={(e) => setBranchFilter(e.target.value)}
                            >
                                <option value="">All Branches</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="w-full max-w-[160px]">
                            <select
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                value={departmentFilter}
                                onChange={(e) => setDepartmentFilter(e.target.value)}
                            >
                                <option value="">All Departments</option>
                                {uniqueDepartments.map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>
                        </div>

                        <div className="w-full max-w-xs relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                placeholder="Search employee..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                    </div>
                    
                    <div className="mt-3 sm:ml-4 sm:mt-0">
                        <button 
                            type="button" 
                            onClick={handleBatchUpdate}
                            className={`inline-flex items-center gap-x-1.5 rounded-md px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-inset transition-colors ${
                                selectedEmployees.length > 0 
                                    ? 'bg-blue-50 text-blue-700 ring-blue-300 hover:bg-blue-100' 
                                    : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            Batch Update {selectedEmployees.length > 0 && `(${selectedEmployees.length})`}
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="relative px-4 sm:w-12 sm:px-6">
                                    <input 
                                        type="checkbox" 
                                        className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer" 
                                        checked={filteredEmployees.length > 0 && selectedEmployees.length === filteredEmployees.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-3">Employee</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Department</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Assigned Shift</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Off Days</th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {filteredEmployees.length > 0 ? (
                                filteredEmployees.map((emp) => {
                                    const activeSchedule = getActiveSchedule(emp);
                                    
                                    return (
                                        <tr key={emp.id} className={selectedEmployees.includes(emp.id) ? "bg-blue-50" : "hover:bg-gray-50"}>
                                            <td className="relative px-4 sm:w-12 sm:px-6">
                                                <input 
                                                    type="checkbox" 
                                                    className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer" 
                                                    checked={selectedEmployees.includes(emp.id)}
                                                    onChange={(e) => handleSelectOne(e, emp.id)}
                                                />
                                            </td>
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-3">
                                                <div className="flex items-center">
                                                    <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                                        {getInitials(emp.name)}
                                                    </div>
                                                    <div className="ml-4">{emp.name}</div>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                {emp.department?.name || emp.department || 'Unassigned'}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                {getShiftBadge(activeSchedule?.shift_type || null)}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                {activeSchedule?.off_days || 'None set'}
                                            </td>
                                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                <button 
                                                    onClick={() => handleEditSchedule(emp)}
                                                    className="text-indigo-600 hover:text-indigo-900 font-bold"
                                                >
                                                    {activeSchedule ? 'Edit' : 'Assign'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-sm text-gray-500">
                                        No employees found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)}></div>

                        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
                        <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle relative z-10">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4" id="modal-title">
                                    {isBatchMode ? 'Batch Assign Shift' : 'Assign Shift'}
                                </h3>
                                
                                <form onSubmit={submit} className="space-y-6">
                                    
                                    {/* Modal Target Cutoff Display */}
                                    <div className="mb-4 rounded-md bg-indigo-50 p-4 border border-indigo-100">
                                        <p className="text-sm text-indigo-700">
                                            This schedule will be assigned for the <strong className="font-bold">
                                            {cutoffPeriodsList.find(c => c.value === data.cutoff_period)?.label}
                                            </strong> cut-off period.
                                        </p>
                                    </div>

                                    {isBatchMode ? (
                                        <div className="mb-4 rounded-md bg-blue-50 p-4 border border-blue-100">
                                            <p className="text-sm text-blue-700">Assigning schedule to <strong>{selectedEmployees.length} employees</strong>.</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Employee</label>
                                            <select 
                                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                                                    isEditMode ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 bg-white'
                                                }`}
                                                value={data.employee_id}
                                                onChange={e => setData('employee_id', e.target.value)}
                                                disabled={isEditMode}
                                                required={!isBatchMode}
                                            >
                                                <option value="" disabled>-- Choose an employee --</option>
                                                {employees.map(emp => (
                                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Assigned Shift</label>
                                        <select 
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                            value={data.shift_start && data.shift_end ? `${data.shift_start}-${data.shift_end}` : ''}
                                            onChange={e => {
                                                const [start, end] = e.target.value.split('-');
                                                const type = determineShiftType(start, end); 
                                                setData(prev => ({ 
                                                    ...prev, 
                                                    shift_start: start, 
                                                    shift_end: end,
                                                    shift_type: type 
                                                }));
                                            }}
                                            required
                                        >
                                            <option value="" disabled>-- Select an Authorized Shift --</option>
                                            {shiftOptions.map(shift => (
                                                <option key={shift.value} value={shift.value}>{shift.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Off Days</label>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                            {daysOfWeek.map(day => (
                                                <label key={day} className="flex items-center space-x-2">
                                                    <input 
                                                        type="checkbox" 
                                                        value={day}
                                                        checked={data.rest_days.includes(day)}
                                                        onChange={handleCheckboxChange}
                                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">{day}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse border-t border-gray-200 pt-4">
                                        <button 
                                            type="submit" 
                                            disabled={processing}
                                            className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                                        >
                                            Save Schedule
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setShowModal(false)}
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