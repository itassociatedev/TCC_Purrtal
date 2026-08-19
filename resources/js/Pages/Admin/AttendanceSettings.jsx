import React from 'react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head, useForm, usePage } from '@inertiajs/react';
import { getAdminLinks } from '@/Config/navigation';

export default function AttendanceSettings({ shifts, settings }) {
    const { auth, flash } = usePage().props;
    const adminLinks = getAdminLinks(auth);

    // Form for Cut-offs
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

    const toggleShift = (id) => {
        postCutoff(route('admin.attendance-settings.toggle-shift', id));
    };

    // Format time for display (e.g., "07:30:00" -> "07:30 AM")
    const formatTime = (timeString) => {
        if (!timeString) return '';
        const [hour, minute] = timeString.split(':');
        const h = parseInt(hour, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const formattedHour = h % 12 || 12;
        return `${formattedHour}:${minute} ${ampm}`;
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

                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Attendance Settings</h1>
                    <p className="text-gray-600 mt-2">Manage cut-off periods and authorized shifts for the entire system.</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    
                    {/* LEFT COLUMN: Cut-Offs & Add Shift */}
                    <div className="space-y-8 xl:col-span-1">
                        
                        {/* Cut-off Settings Card */}
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Cut-off Periods</h3>
                            <form onSubmit={handleCutoffSubmit} className="space-y-4">
                                <div className="p-4 bg-gray-50 rounded-md border border-gray-100">
                                    <h4 className="text-sm font-bold text-indigo-800 mb-3 uppercase tracking-wider">First Period</h4>
                                    <div className="flex gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500">Start Day</label>
                                            <input type="number" min="1" max="31" className="mt-1 w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-bold" value={cutoffData.cutoff_1_start} onChange={e => setCutoffData('cutoff_1_start', e.target.value)} required />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500">End Day</label>
                                            <input type="number" min="1" max="31" className="mt-1 w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-bold" value={cutoffData.cutoff_1_end} onChange={e => setCutoffData('cutoff_1_end', e.target.value)} required />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-gray-50 rounded-md border border-gray-100">
                                    <h4 className="text-sm font-bold text-indigo-800 mb-3 uppercase tracking-wider">Second Period</h4>
                                    <div className="flex gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500">Start Day</label>
                                            <input type="number" min="1" max="31" className="mt-1 w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-bold" value={cutoffData.cutoff_2_start} onChange={e => setCutoffData('cutoff_2_start', e.target.value)} required />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500">End Day</label>
                                            <input type="number" min="1" max="31" className="mt-1 w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-bold" value={cutoffData.cutoff_2_end} onChange={e => setCutoffData('cutoff_2_end', e.target.value)} required />
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" disabled={cutoffProcessing} className="w-full bg-indigo-600 text-white rounded-md py-2.5 text-sm font-bold shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">
                                    {cutoffProcessing ? 'Saving...' : 'Save Cut-offs'}
                                </button>
                            </form>
                        </div>

                        {/* Add New Shift Card */}
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
                                <button type="submit" disabled={shiftProcessing} className="w-full bg-green-600 text-white rounded-md py-2.5 text-sm font-bold shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors mt-2">
                                    {shiftProcessing ? 'Adding...' : '+ Add Shift'}
                                </button>
                            </form>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: Shifts Masterlist */}
                    <div className="xl:col-span-2">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
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
                                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
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
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <button 
                                                        onClick={() => toggleShift(shift.id)}
                                                        className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${
                                                            shift.is_active 
                                                                ? 'text-rose-600 bg-rose-50 hover:bg-rose-100' 
                                                                : 'text-green-600 bg-green-50 hover:bg-green-100'
                                                        }`}
                                                    >
                                                        {shift.is_active ? 'Disable' : 'Enable'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </SidebarLayout>
    );
}