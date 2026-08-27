import React, { useState, useRef } from 'react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import { getAdminLinks } from '@/Config/navigation';

export default function AttendanceSettings({ shifts, settings, holidays = [] }) {
    const { auth, flash } = usePage().props;
    const adminLinks = getAdminLinks(auth);

    // 🟢 UI ACL MATRIX DEFINITIONS
    const isSuperAdmin = auth?.user?.role_id === 1 || auth?.user?.role?.name?.toLowerCase() === 'admin';
    const aclLevel = auth?.user?.acl_permissions?.attendance_settings?.toLowerCase() || 'no_access';
    
    // EDIT access: Can edit cut-offs, add shifts, and modify shifts.
    const canEditSettings = isSuperAdmin || ['full', 'edit'].includes(aclLevel);
    // FULL access: Can delete shifts.
    const canDeleteSettings = isSuperAdmin || ['full'].includes(aclLevel);

    // 🟢 NEW: Ref and State used to smoothly scroll and highlight the Holiday Editor form
    const holidayFormRef = useRef(null);
    const [isHighlighting, setIsHighlighting] = useState(false);

    const { data: cutoffData, setData: setCutoffData, post: postCutoff, processing: cutoffProcessing } = useForm({
        cutoff_1_start: settings.cutoff_1_start || '21',
        cutoff_1_end: settings.cutoff_1_end || '5',
        cutoff_2_start: settings.cutoff_2_start || '6',
        cutoff_2_end: settings.cutoff_2_end || '20',
    });

    // Form for New Shift
    const { data: shiftData, setData: setShiftData, post: postShift, reset: resetShift, processing: shiftProcessing } = useForm({
        name: '',
        start_time: '',
        end_time: '',
        shift_type: 'Day Shift'
    });

    // Form for New/Edit Holiday
    const { data: holidayData, setData: setHolidayData, post: postHoliday, reset: resetHoliday, processing: holidayProcessing } = useForm({
        id: '', // Added ID to support editing
        date: '',
        name: ''
    });

    // Form & State for Editing a Shift
    const [showEditModal, setShowEditModal] = useState(false);
    const { data: editData, setData: setEditData, put: putEdit, processing: editProcessing, reset: resetEdit } = useForm({
        id: '',
        name: '',
        start_time: '',
        end_time: '',
        shift_type: 'Day Shift',
        is_active: true
    });

    // State for the custom Delete Confirmation Modal
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // State for Holiday Deletion Modal
    const [holidayToDelete, setHolidayToDelete] = useState(null);
    const [showHolidayDeleteModal, setShowHolidayDeleteModal] = useState(false);

    const handleCutoffSubmit = (e) => {
        e.preventDefault();
        postCutoff(route('admin.attendance-settings.update-cutoffs'));
    };

    const handleShiftSubmit = (e) => {
        e.preventDefault();
        postShift(route('admin.attendance-settings.store-shift'), {
            onSuccess: () => resetShift()
        });
    };

    // Submit handler for holidays
    const handleHolidaySubmit = (e) => {
        e.preventDefault();
        postHoliday(route('admin.attendance-settings.store-holiday'), {
            onSuccess: () => resetHoliday()
        });
    };

    const openEditModal = (shift) => {
        if (!canEditSettings) return;
        setEditData({
            id: shift.id,
            name: shift.name,
            start_time: shift.start_time ? shift.start_time.substring(0, 5) : '',
            end_time: shift.end_time ? shift.end_time.substring(0, 5) : '',
            shift_type: shift.shift_type,
            is_active: shift.is_active
        });
        setShowEditModal(true);
    };

    const handleEditSubmit = (e) => {
        e.preventDefault();
        putEdit(route('admin.attendance-settings.update-shift', editData.id), {
            onSuccess: () => {
                setShowEditModal(false);
                resetEdit();
            }
        });
    };

    // Opens the custom modal instead of the browser popup
    const confirmDelete = () => {
        setShowDeleteConfirmModal(true);
    };

    // Executes the actual deletion when confirmed inside the new modal
    const executeDelete = () => {
        setIsDeleting(true);
        router.delete(route('admin.attendance-settings.delete-shift', editData.id), {
            onSuccess: () => {
                setShowDeleteConfirmModal(false);
                setShowEditModal(false);
                resetEdit();
                setIsDeleting(false);
            },
            onError: () => setIsDeleting(false)
        });
    };

    // Holiday deletion logic
    const confirmDeleteHoliday = (holiday) => {
        setHolidayToDelete(holiday);
        setShowHolidayDeleteModal(true);
    };

    const executeDeleteHoliday = () => {
        if (!holidayToDelete) return;
        setIsDeleting(true);
        router.delete(route('admin.attendance-settings.delete-holiday', holidayToDelete.id), {
            onSuccess: () => {
                setShowHolidayDeleteModal(false);
                setHolidayToDelete(null);
                setIsDeleting(false);
            },
            onError: () => setIsDeleting(false)
        });
    };

    const formatTime = (timeString) => {
        if (!timeString) return '';
        const [hour, minute] = timeString.split(':');
        const h = parseInt(hour, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const formattedHour = h % 12 || 12;
        return `${formattedHour}:${minute} ${ampm}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    };

    return (
        <SidebarLayout activeModule="Admin" sidebarLinks={adminLinks} user={auth.user}>
            <Head title="Attendance Settings" />

            <div className="max-w-7xl mx-auto px-4 py-8">
                {flash?.success && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg font-medium">
                        ✓ {flash.success}
                    </div>
                )}

                {/* 🟢 VIEW-ONLY BANNER */}
                {!canEditSettings && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg font-medium flex items-center gap-3">
                        <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        You are currently in View-Only mode. Saving changes is disabled.
                    </div>
                )}

                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Attendance Settings</h1>
                    <p className="text-gray-600 mt-2">Manage cut-off periods, authorized shifts, and calendar holidays for the entire system.</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    
                    <div className="space-y-8 xl:col-span-1">
                        
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Cut-off Periods</h3>
                            <form onSubmit={handleCutoffSubmit} className="space-y-4">
                                <div className={`p-4 rounded-md border ${canEditSettings ? 'bg-gray-50 border-gray-100' : 'bg-gray-100 border-gray-200 opacity-70'}`}>
                                    <h4 className="text-sm font-bold text-indigo-800 mb-3 uppercase tracking-wider">First Period</h4>
                                    <div className="flex gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500">Start Day</label>
                                            <input type="number" disabled={!canEditSettings} min="1" max="31" className="mt-1 w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-bold disabled:bg-gray-100 disabled:text-gray-500" value={cutoffData.cutoff_1_start} onChange={e => setCutoffData('cutoff_1_start', e.target.value)} required />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500">End Day</label>
                                            <input type="number" disabled={!canEditSettings} min="1" max="31" className="mt-1 w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-bold disabled:bg-gray-100 disabled:text-gray-500" value={cutoffData.cutoff_1_end} onChange={e => setCutoffData('cutoff_1_end', e.target.value)} required />
                                        </div>
                                    </div>
                                </div>

                                <div className={`p-4 rounded-md border ${canEditSettings ? 'bg-gray-50 border-gray-100' : 'bg-gray-100 border-gray-200 opacity-70'}`}>
                                    <h4 className="text-sm font-bold text-indigo-800 mb-3 uppercase tracking-wider">Second Period</h4>
                                    <div className="flex gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500">Start Day</label>
                                            <input type="number" disabled={!canEditSettings} min="1" max="31" className="mt-1 w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-bold disabled:bg-gray-100 disabled:text-gray-500" value={cutoffData.cutoff_2_start} onChange={e => setCutoffData('cutoff_2_start', e.target.value)} required />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500">End Day</label>
                                            <input type="number" disabled={!canEditSettings} min="1" max="31" className="mt-1 w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-bold disabled:bg-gray-100 disabled:text-gray-500" value={cutoffData.cutoff_2_end} onChange={e => setCutoffData('cutoff_2_end', e.target.value)} required />
                                        </div>
                                    </div>
                                </div>

                                {canEditSettings && (
                                    <button type="submit" disabled={cutoffProcessing} className="w-full bg-indigo-600 text-white rounded-md py-2.5 text-sm font-bold shadow-sm hover:bg-indigo-700 transition-colors">
                                        {cutoffProcessing ? 'Saving...' : 'Save Cut-offs'}
                                    </button>
                                )}
                            </form>
                        </div>

                        {canEditSettings && (
                            <>
                                {/* SHIFT CREATOR */}
                                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Shift</h3>
                                    <form onSubmit={handleShiftSubmit} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Shift Label</label>
                                            <input type="text" placeholder="e.g. 2:00PM - 11:00PM (Mid Shift)" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-medium" value={shiftData.name} onChange={e => setShiftData('name', e.target.value)} required />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</label>
                                                <input type="time" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono font-medium text-gray-700" value={shiftData.start_time} onChange={e => setShiftData('start_time', e.target.value)} required />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</label>
                                            <input type="time" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono font-medium text-gray-700" value={shiftData.end_time} onChange={e => setShiftData('end_time', e.target.value)} required />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Category</label>
                                            <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-medium" value={shiftData.shift_type} onChange={e => setShiftData('shift_type', e.target.value)} required>
                                                <option value="Day Shift">Day Shift</option>
                                                <option value="Straight Duty">Straight Duty</option>
                                                <option value="Graveyard Shift">Graveyard Shift</option>
                                            </select>
                                        </div>
                                        <button type="submit" disabled={shiftProcessing} className="w-full bg-green-600 text-white rounded-md py-2.5 text-sm font-bold shadow-sm hover:bg-green-700 transition-colors mt-2">
                                            {shiftProcessing ? 'Adding...' : '+ Add Shift'}
                                        </button>
                                    </form>
                                </div>

                                {/* 🟢 HOLIDAY CREATOR (WITH REF FOR VISUAL EDIT JUMP) */}
                                <div ref={holidayFormRef} className={`rounded-lg border shadow-sm p-6 transition-all duration-700 ${isHighlighting ? 'bg-amber-100 border-amber-400 shadow-2xl scale-[1.02]' : holidayData.id ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
                                    <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${holidayData.id ? 'text-amber-900' : 'text-rose-900'}`}>
                                        📌 {holidayData.id ? 'Edit Calendar Event' : 'Add Calendar Event / Holiday'}
                                    </h3>
                                    <form onSubmit={handleHolidaySubmit} className="space-y-4">
                                        
                                        {/* Show editing alert if active */}
                                        {holidayData.id && (
                                            <div className="flex items-center justify-between bg-amber-100 px-3 py-2 rounded-md mb-2">
                                                <span className="text-xs font-bold text-amber-800">Editing existing event</span>
                                                <button type="button" onClick={() => resetHoliday()} className="text-xs font-bold text-indigo-600 hover:underline">Cancel Edit</button>
                                            </div>
                                        )}

                                        <div>
                                            <label className={`block text-xs font-bold uppercase tracking-wider ${holidayData.id ? 'text-amber-700' : 'text-rose-700'}`}>Date</label>
                                            <input type="date" className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm font-bold text-gray-900 focus:ring-opacity-50 ${holidayData.id ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500 bg-white' : 'border-rose-300 focus:border-rose-500 focus:ring-rose-500'}`} value={holidayData.date} onChange={e => setHolidayData('date', e.target.value)} required />
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-bold uppercase tracking-wider ${holidayData.id ? 'text-amber-700' : 'text-rose-700'}`}>Event Name</label>
                                            <input type="text" placeholder="e.g. Independence Day" className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm font-medium focus:ring-opacity-50 ${holidayData.id ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500 bg-white' : 'border-rose-300 focus:border-rose-500 focus:ring-rose-500'}`} value={holidayData.name} onChange={e => setHolidayData('name', e.target.value)} required />
                                        </div>
                                        <button type="submit" disabled={holidayProcessing} className={`w-full text-white rounded-md py-2.5 text-sm font-bold shadow-sm transition-colors mt-2 disabled:opacity-50 ${holidayData.id ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                                            {holidayProcessing ? 'Saving...' : (holidayData.id ? 'Update Event' : 'Save Event')}
                                        </button>
                                    </form>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="xl:col-span-2 min-w-0 flex flex-col gap-8">
                        {/* SHIFT LIST */}
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                                <h3 className="text-lg font-bold text-gray-900">Shift Masterlist</h3>
                                <p className="text-xs text-gray-500 mt-1">These are the authorized shifts available in the Attendance module dropdowns.</p>
                            </div>
                            <div className="overflow-x-auto flex-1">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-white">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Shift Label</th>
                                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Time</th>
                                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                            {canEditSettings && <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {shifts.map(shift => (
                                            <tr key={shift.id} className={shift.is_active ? 'bg-white hover:bg-gray-50 transition-colors' : 'bg-gray-50 opacity-60'}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">{shift.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center font-mono font-medium">
                                                    {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                                        shift.shift_type === 'Graveyard Shift' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                                        shift.shift_type === 'Straight Duty' ? 'bg-green-100 text-green-700 border border-green-200' :
                                                        'bg-blue-100 text-blue-700 border border-blue-200'
                                                    }`}>
                                                        {shift.shift_type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${shift.is_active ? 'text-green-600' : 'text-rose-600'}`}>
                                                        <span className={`h-2 w-2 rounded-full ${shift.is_active ? 'bg-green-500' : 'bg-rose-500'}`}></span>
                                                        {shift.is_active ? 'Active' : 'Disabled'}
                                                    </span>
                                                </td>
                                                {canEditSettings && (
                                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                                        <button 
                                                            onClick={() => openEditModal(shift)}
                                                            className="text-xs font-bold px-4 py-1.5 rounded transition-colors text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200"
                                                        >
                                                            Edit
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* HOLIDAY LIST WITH EDIT ACTION AND JUMP ANIMATION */}
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="border-b border-gray-200 bg-rose-50 px-6 py-4">
                                <h3 className="text-lg font-bold text-rose-900">Event & Holiday Masterlist</h3>
                                <p className="text-xs text-rose-700 mt-1">These events will highlight specific dates in the global Attendance Calendar.</p>
                            </div>
                            <div className="overflow-x-auto flex-1 max-h-[400px]">
                                {holidays.length > 0 ? (
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-white sticky top-0 z-10">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Event Name</th>
                                                {canEditSettings && <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {holidays.map(holiday => (
                                                <tr key={holiday.id} className="bg-white hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                                                        {formatDate(holiday.date)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                                                        📌 {holiday.name}
                                                    </td>
                                                    {canEditSettings && (
                                                        <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-2">
                                                            <button 
                                                                onClick={() => {
                                                                    setHolidayData({ id: holiday.id, date: holiday.date, name: holiday.name });
                                                                    if (holidayFormRef.current) {
                                                                        holidayFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                        // 🟢 Triggers the visual flash so the user knows they are editing
                                                                        setIsHighlighting(true);
                                                                        setTimeout(() => setIsHighlighting(false), 1500);
                                                                    }
                                                                }}
                                                                className="text-xs font-bold px-4 py-1.5 rounded transition-colors text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200"
                                                            >
                                                                Edit
                                                            </button>
                                                            {canDeleteSettings ? (
                                                                <button 
                                                                    onClick={() => confirmDeleteHoliday(holiday)}
                                                                    className="text-xs font-bold px-4 py-1.5 rounded transition-colors text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200"
                                                                >
                                                                    Delete
                                                                </button>
                                                            ) : (
                                                                <span className="text-xs text-gray-400 italic mt-1 ml-2">Del locked</span>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-8 text-center text-gray-500 text-sm">
                                        No custom events or holidays have been added yet.
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* EDIT SHIFT MODAL */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowEditModal(false)}></div>

                        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
                        
                        <div className="inline-block transform overflow-hidden rounded-xl bg-white text-left align-bottom shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:align-middle relative z-10">
                            <div className="bg-white px-6 py-5">
                                <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
                                    <h3 className="text-lg font-bold leading-6 text-gray-900" id="modal-title">Edit Shift</h3>
                                    <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                
                                <form onSubmit={handleEditSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Shift Label</label>
                                        <input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-medium" value={editData.name} onChange={e => setEditData('name', e.target.value)} required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</label>
                                            <input type="time" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono font-medium text-gray-700" value={editData.start_time} onChange={e => setEditData('start_time', e.target.value)} required />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</label>
                                            <input type="time" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono font-medium text-gray-700" value={editData.end_time} onChange={e => setEditData('end_time', e.target.value)} required />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Category</label>
                                        <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-medium" value={editData.shift_type} onChange={e => setEditData('shift_type', e.target.value)} required>
                                            <option value="Day Shift">Day Shift</option>
                                            <option value="Straight Duty">Straight Duty</option>
                                            <option value="Graveyard Shift">Graveyard Shift</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Status</label>
                                        <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-medium" value={editData.is_active ? '1' : '0'} onChange={e => setEditData('is_active', e.target.value === '1')} required>
                                            <option value="1">Active</option>
                                            <option value="0">Disabled (Hidden from Dropdowns)</option>
                                        </select>
                                    </div>

                                    <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-5">
                                        {/* 🟢 DELETE BUTTON: Only visible to FULL access */}
                                        <div className="w-1/3">
                                            {canDeleteSettings && (
                                                <button 
                                                    type="button" 
                                                    onClick={confirmDelete}
                                                    className="text-sm font-bold text-rose-600 hover:text-rose-800 transition-colors"
                                                >
                                                    Delete Shift
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex gap-3">
                                            <button 
                                                type="button" 
                                                onClick={() => setShowEditModal(false)}
                                                className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                type="submit" 
                                                disabled={editProcessing}
                                                className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                                            >
                                                {editProcessing ? 'Saving...' : 'Save Changes'}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CUSTOM DELETE CONFIRMATION MODAL FOR SHIFTS */}
            {showDeleteConfirmModal && (
                <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => !isDeleting && setShowDeleteConfirmModal(false)}></div>

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
                                            Delete Shift?
                                        </h3>
                                        <p className="mt-2 text-sm text-gray-500">
                                            Are you sure you want to permanently delete <strong className="text-gray-800 font-semibold">"{editData.name}"</strong>? It will be removed from all dropdowns and cannot be undone.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row-reverse gap-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={executeDelete}
                                    disabled={isDeleting}
                                    className="w-full sm:w-auto inline-flex justify-center rounded-md bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                                >
                                    {isDeleting ? 'Deleting...' : 'Yes, Delete Shift'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirmModal(false)}
                                    disabled={isDeleting}
                                    className="w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CUSTOM DELETE CONFIRMATION MODAL FOR HOLIDAYS */}
            {showHolidayDeleteModal && (
                <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => !isDeleting && setShowHolidayDeleteModal(false)}></div>

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
                                            Remove Event?
                                        </h3>
                                        <p className="mt-2 text-sm text-gray-500">
                                            Are you sure you want to delete the event <strong className="text-gray-800 font-semibold">"{holidayToDelete?.name}"</strong> scheduled for {holidayToDelete && formatDate(holidayToDelete.date)}?
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row-reverse gap-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={executeDeleteHoliday}
                                    disabled={isDeleting}
                                    className="w-full sm:w-auto inline-flex justify-center rounded-md bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                                >
                                    {isDeleting ? 'Removing...' : 'Yes, Remove Event'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowHolidayDeleteModal(false)}
                                    disabled={isDeleting}
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