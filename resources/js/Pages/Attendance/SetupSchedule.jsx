import React, { useState } from 'react';
import { useForm } from '@inertiajs/react'; 
import SidebarLayout from '@/Layouts/SidebarLayout';

export default function SetupSchedule({ employees = [] }) {
    const attendanceLinks = [
        { label: 'Attendance Overview', href: route('attendance.overview'), active: route().current('attendance.overview') },
        { label: 'Setup Schedule', href: route('attendance.setup-schedule'), active: route().current('attendance.setup-schedule') },
        { label: 'Schedule View', href: route('attendance.schedule-view'), active: route().current('attendance.schedule-view') },
        { label: 'Calendar', href: route('attendance.calendar'), active: route().current('attendance.calendar') },
    ];

    // --- STATES ---
    const [searchTerm, setSearchTerm] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    
    // Batch Update States
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [isBatchMode, setIsBatchMode] = useState(false);

    // Form State
    const { data, setData, post, processing, reset } = useForm({
        employee_id: '',
        employee_ids: [],
        shift_start: '',
        shift_end: '',
        shift_type: '',
        rest_days: []
    });

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
        { value: "21:00-06:00", label: "9:00PM - 6:00AM (21:00-06:00)" }
    ];

    // --- LOGIC HELPERS ---

    // 🟢 DYNAMIC DEPARTMENTS: Extract unique departments from the data
    const uniqueDepartments = [...new Set(employees.map(emp => emp.department?.name || emp.department || 'Unassigned'))]
        .filter(dept => dept !== 'Unassigned')
        .sort();

    // 🟢 SHIFT CATEGORIZATION: Automatically decides shift type based on start time
    const determineShiftType = (start) => {
        const hour = parseInt(start.split(':')[0], 10);
        if (hour >= 21 || hour < 5) return 'Graveyard Shift';
        if (hour >= 11 && hour <= 14) return 'Straight Shift';
        return 'Day Shift';
    };

    // --- HANDLERS ---

    const handleCheckboxChange = (e) => {
        const { value, checked } = e.target;
        if (checked) {
            setData('rest_days', [...data.rest_days, value]);
        } else {
            setData('rest_days', data.rest_days.filter(day => day !== value));
        }
    };

    // 🟢 SELECT ALL
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedEmployees(filteredEmployees.map(emp => emp.id));
        } else {
            setSelectedEmployees([]);
        }
    };

    // 🟢 SELECT SINGLE ROW
    const handleSelectOne = (e, id) => {
        if (e.target.checked) {
            setSelectedEmployees([...selectedEmployees, id]);
        } else {
            setSelectedEmployees(selectedEmployees.filter(empId => empId !== id));
        }
    };

    const handleAddSchedule = () => {
        reset();
        setIsEditMode(false); 
        setIsBatchMode(false);
        setShowModal(true);
    };

    // 🟢 BATCH UPDATE
    const handleBatchUpdate = () => {
        if (selectedEmployees.length === 0) {
            alert("Please select at least one employee from the table.");
            return;
        }
        reset();
        setIsBatchMode(true);
        setIsEditMode(false);
        setData('employee_ids', selectedEmployees);
        setShowModal(true);
    };

    const handleEditSchedule = (emp) => {
        setIsEditMode(true); 
        setIsBatchMode(false);
        setShowModal(true);

        if (emp.schedule) {
            setData({
                employee_id: emp.id,
                employee_ids: [],
                shift_start: emp.schedule.start_time || '',
                shift_end: emp.schedule.end_time || '',
                shift_type: emp.schedule.shift_type || '',
                rest_days: emp.schedule.raw_off_days || []
            });
        } else {
            setData({
                employee_id: emp.id,
                employee_ids: [],
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
                setSelectedEmployees([]); // Clear selections after successful save
                reset(); 
            }
        });
    };

    // --- DISPLAY HELPERS ---

    const getShiftBadge = (shiftType) => {
        switch (shiftType) {
            case 'Day Shift':
                return <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">Day Shift</span>;
            case 'Straight Shift':
                return <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Straight Shift</span>;
            case 'Graveyard Shift':
                return <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">Graveyard Shift</span>;
            default:
                return <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">No Shift Assigned</span>;
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
        return matchesSearch && matchesDept;
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
                <div className="border-b border-gray-200 p-4 sm:flex sm:items-center sm:justify-between">
                    <div className="flex flex-1 gap-4">
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

                        <div className="w-full max-w-xs">
                            <select
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                value={departmentFilter}
                                onChange={(e) => setDepartmentFilter(e.target.value)}
                            >
                                <option value="">All Departments</option>
                                {uniqueDepartments.map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                                <option value="Unassigned">Unassigned</option>
                            </select>
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
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Shift</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Off Days</th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {filteredEmployees.length > 0 ? (
                                filteredEmployees.map((emp) => (
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
                                            {getShiftBadge(emp.schedule?.shift_type || null)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            {emp.schedule?.off_days || 'None set'}
                                        </td>
                                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                            <button 
                                                onClick={() => handleEditSchedule(emp)}
                                                className="text-indigo-600 hover:text-indigo-900 font-bold"
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))
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
                                    
                                    {isBatchMode ? (
                                        <div className="mb-4 rounded-md bg-blue-50 p-4 border border-blue-100">
                                            <div className="flex">
                                                <div className="flex-shrink-0">
                                                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                                <div className="ml-3 flex-1 md:flex md:justify-between">
                                                    <p className="text-sm text-blue-700">You are assigning this schedule to <strong>{selectedEmployees.length} employees</strong>.</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Employee</label>
                                            <select 
                                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                                                    isEditMode 
                                                        ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed' 
                                                        : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 bg-white'
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
                                                const type = determineShiftType(start); 
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