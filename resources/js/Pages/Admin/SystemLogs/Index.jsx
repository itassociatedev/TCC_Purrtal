import Pagination from '@/Components/Pagination';
import { getAdminLinks, getDutyMealLinks } from "@/Config/navigation";
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

export default function SystemLogsIndex({ auth, logs, filters, dutyLogs=false, canDeleteLogs=false }) {
    const [search, setSearch] = useState(filters.search || '');
    const [moduleFilter, setModuleFilter] = useState(filters.module || '');
    const [actionFilter, setActionFilter] = useState(filters.action || '');
    const [statusFilter, setStatusFilter] = useState(filters.status || '');
    const [startDate, setStartDate] = useState(filters.start_date ? isoToMMDDYYYY(filters.start_date) : '');
    const [endDate, setEndDate] = useState(filters.end_date ? isoToMMDDYYYY(filters.end_date) : '');

    const startDatePickerRef = useRef(null);
    const endDatePickerRef = useRef(null);

    // --- SILENT REAL-TIME POLLING LOGIC ---
    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({
                only: ['logs'], // Only fetch the 'logs' prop to save bandwidth
                preserveState: true, // Keep search terms/filters intact
                preserveScroll: true, // Don't snap the user back to the top
            });
        }, 5000); // Polls every 5 seconds
        
        // Cleanup interval on unmount
        return () => clearInterval(interval);
    }, []); // Empty dependency array ensures this runs continuously while the component is mounted

    // --- DATE HELPERS ---
    function formatDateInput(value) {
        const digits = value.replace(/\D/g, '').slice(0, 8);

        if (digits.length <= 2) return digits;
        if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
        return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }

    function isoToMMDDYYYY(iso) {
        if (!iso) return '';
        const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return '';
        const [, yyyy, mm, dd] = match;
        return `${mm}/${dd}/${yyyy}`;
    }

    function mmddyyyyToISO(value) {
        const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!match) return '';

        const [, mm, dd, yyyy] = match;
        const month = Number(mm);
        const day = Number(dd);
        const year = Number(yyyy);

        if (
            Number.isNaN(month) ||
            Number.isNaN(day) ||
            Number.isNaN(year) ||
            month < 1 || month > 12 ||
            day < 1 || day > 31
        ) {
            return '';
        }

        return `${yyyy}-${mm}-${dd}`;
    }

    function openNativePicker(ref) {
        if (!ref?.current) return;

        if (typeof ref.current.showPicker === 'function') {
            ref.current.showPicker();
        } else {
            ref.current.focus();
            ref.current.click();
        }
    }

    const handleFilter = (e) => {
        e.preventDefault();

        router.get(
            route(dutyLogs?'admin.duty-meals.logs.index':'admin.logs.index'),
            {
                search,
                module: moduleFilter,
                action: actionFilter,
                status: statusFilter,
                start_date: mmddyyyyToISO(startDate),
                end_date: mmddyyyyToISO(endDate),
            },
            { preserveState: true }
        );
    };

    const clearFilters = () => {
        setSearch('');
        setModuleFilter('');
        setActionFilter('');
        setStatusFilter('');
        setStartDate('');
        setEndDate('');
        router.get(route('admin.logs.index'));
    };

    const handleExport = () => {
        const params = new URLSearchParams({
            search,
            module: moduleFilter,
            action: actionFilter,
            status: statusFilter,
            start_date: mmddyyyyToISO(startDate),
            end_date: mmddyyyyToISO(endDate),
        }).toString();
        
        window.location.href = route(dutyLogs?'admin.duty-meals.logs.export':'admin.logs.export') + '?' + params;
    };

    const getStatusBadge = (status) => {
        const styles = {
            success: 'bg-green-100 text-green-800 border-green-200',
            warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            danger: 'bg-red-100 text-red-800 border-red-200 font-bold animate-pulse',
        };

        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.success}`}>
                {(status || 'success').toUpperCase()}
            </span>
        );
    };

    return (
        <SidebarLayout
            activeModule={dutyLogs?"Duty Meal":"Admin"}
            sidebarLinks={dutyLogs?getDutyMealLinks(auth):getAdminLinks(auth)}
            header={<h2 className="text-xl font-semibold leading-tight text-gray-800">{dutyLogs?'Duty Meal Logs':'System Logs & Security'}</h2>}
        >
            <Head title="System Logs" />

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6 relative">
                
                {/* Filters */}
                <form onSubmit={handleFilter} className="flex flex-col gap-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

                        {/* Search */}
                        <input
                            type="text"
                            placeholder="Search logs or users..."
                            className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm w-full"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />

                        {/* MODULES */}
                        <select
                            className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm w-full"
                            value={moduleFilter}
                            onChange={(e) => setModuleFilter(e.target.value)}
                        >
                            {dutyLogs ? <><option value="">All Duty Meal logs</option>{['Duty Meal Setup','Duty Meal Overview','Duty Meal Archive'].map(name=><option key={name} value={name}>{name}</option>)}</> : <><option value="">All Modules</option>
                            <option value="Authentication">Authentication</option>
                            <option value="Employee Management">Employee Management</option>
                            <option value="Organizational Chart">Organizational Chart</option>
                            <option value="Announcements">Announcements</option>
                            <option value="Company Content">Company Content</option>
                            <option value="Document Repository">Document Repository</option>
                            <option value="HR Module">HR Module</option>
                            <option value="Manpower Requests">Manpower Requests</option>
                            <option value="Feedback">Feedback</option>
                            <option value="PR/PO Module">PR/PO Module</option>
                            <option value="Duty Meal Module">Duty Meal Module</option>
                            <option value="Profile">Profile</option>
                        </>}</select>

                        {/* ACTIONS */}
                        <select
                            className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm w-full"
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                        >
                            <option value="">All Actions</option>
                            <option value="Login">Login</option>
                            <option value="Failed Login">Failed Login</option>
                            <option value="Logout">Logout</option>
                            <option value="Update">Update</option>
                            <option value="Delete">Delete</option>
                            <option value="Create">Create</option>
                        </select>

                        {/* STATUS FILTER */}
                        <select
                            className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm w-full"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">All Status</option>
                            <option value="success">Success</option>
                            <option value="warning">Warning</option>
                            <option value="danger">Danger</option>
                        </select>

                        {/* START DATE */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Start Date (MM/DD/YYYY)"
                                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md w-full pr-10"
                                value={startDate}
                                onChange={(e) => setStartDate(formatDateInput(e.target.value))}
                            />
                            <input
                                ref={startDatePickerRef}
                                type="date"
                                value={mmddyyyyToISO(startDate)}
                                onChange={(e) => setStartDate(isoToMMDDYYYY(e.target.value))}
                                className="absolute opacity-0 w-0 h-full"
                            />
                            <button type="button" onClick={() => openNativePicker(startDatePickerRef)} className="absolute right-2 top-2">
                                📅
                            </button>
                        </div>

                        {/* END DATE */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="End Date (MM/DD/YYYY)"
                                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md w-full pr-10"
                                value={endDate}
                                onChange={(e) => setEndDate(formatDateInput(e.target.value))}
                            />
                            <input
                                ref={endDatePickerRef}
                                type="date"
                                value={mmddyyyyToISO(endDate)}
                                onChange={(e) => setEndDate(isoToMMDDYYYY(e.target.value))}
                                className="absolute opacity-0 w-0 h-full"
                            />
                            <button type="button" onClick={() => openNativePicker(endDatePickerRef)} className="absolute right-2 top-2">
                                📅
                            </button>
                        </div>

                    </div>

                    {/* BUTTON ACTIONS */}
                    <div className="flex justify-between items-center w-full mt-2 border-t pt-4 border-gray-100">
                        {/* Left Side: Filter & Clear */}
                        <div className="flex gap-2">
                            <button type="submit" className="bg-slate-800 hover:bg-slate-700 transition duration-150 text-white px-4 py-2 rounded-md font-medium text-sm">
                                Filter Results
                            </button>
                            <button type="button" onClick={clearFilters} className="bg-gray-100 hover:bg-gray-200 transition duration-150 text-gray-800 px-4 py-2 rounded-md font-medium text-sm">
                                Clear Filters
                            </button>
                        </div>

                        {/* Right Side: Export */}
                        <button 
                            type="button" 
                            onClick={handleExport}
                            className="border border-gray-300 bg-white hover:bg-gray-50 transition duration-150 text-gray-700 px-4 py-2 rounded-md shadow-sm font-medium flex items-center gap-2 text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Export Logs
                        </button>
                    </div>
                </form>

                {/* TABLE */}
                <div className="overflow-auto border rounded-lg relative">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left font-semibold text-gray-700 uppercase tracking-wider text-xs">Timestamp</th>
                                <th className="px-6 py-3 text-left font-semibold text-gray-700 uppercase tracking-wider text-xs">User</th>
                                <th className="px-6 py-3 text-left font-semibold text-gray-700 uppercase tracking-wider text-xs">Module & Action</th>
                                <th className="px-6 py-3 text-left font-semibold text-gray-700 uppercase tracking-wider text-xs">Description</th>
                                <th className="px-6 py-3 text-left font-semibold text-gray-700 uppercase tracking-wider text-xs">Security</th>
                                <th className="px-6 py-3 text-left font-semibold text-gray-700 uppercase tracking-wider text-xs">Status</th>{canDeleteLogs&&<th className="px-6 py-3 text-left text-xs">Actions</th>}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100 bg-white">
                            {logs.data.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50 transition duration-150">
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-mono text-xs">
                                        {new Date(log.created_at).toLocaleString('en-US', {
                                            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit'
                                        })}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {log.user ? log.user.name : 'System'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-gray-800">{log.module}</div>
                                        <div className="text-xs font-semibold text-indigo-600 mt-0.5">{log.action}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 min-w-[200px]">{log.description}</td>
                                    <td className="px-6 py-4 text-gray-500 font-mono text-xs whitespace-nowrap">
                                        <span className="bg-gray-100 px-2 py-1 rounded">IP: {log.ip_address}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(log.status)}</td>{canDeleteLogs&&<td className="px-6 py-4"><button type="button" className="font-semibold text-red-700" onClick={()=>{if(window.confirm('Delete this log entry permanently?'))router.delete(route(dutyLogs?'admin.duty-meals.logs.destroy':'admin.logs.destroy',log.id),{preserveScroll:true});}}>Delete</button></td>}
                                </tr>
                            ))}
                            
                            {logs.data.length === 0 && (
                                <tr>
                                    <td colSpan={canDeleteLogs?7:6} className="px-6 py-8 text-center text-gray-500 bg-gray-50">
                                        <div className="flex flex-col items-center justify-center">
                                            <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                            No logs found matching your criteria.
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination component */}
                <div className="mt-6">
                   <Pagination links={logs.links} />
                </div>
            </div>
        </SidebarLayout>
    );
}