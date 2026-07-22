import Modal from '@/Components/Modal';
import { getHRAdminLinks } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { moduleHasAccess } from '@/Config/navigation';

export default function FeedbackSubmissions({ auth, submissions }) {
    const adminSidebarLinks = getHRAdminLinks(auth);
    if (!moduleHasAccess(auth, 'hr')) {
        return (
            <SidebarLayout activeModule="HR ADMIN" sidebarLinks={adminSidebarLinks}>
                <Head title="Access Denied" />
                <div className="py-12 max-w-4xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                        <p className="text-gray-600">You do not have permission to view this section.</p>
                    </div>
                </div>
            </SidebarLayout>
        );
    }
    
    const dataList = submissions?.data || [];

    const [viewingFeedback, setViewingFeedback] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [sortField, setSortField] = useState('date_submitted');
    const [sortDirection, setSortDirection] = useState('desc');

    const uniqueTypes = useMemo(() => {
        const types = dataList.map(s => s.type).filter(Boolean);
        return [...new Set(types)];
    }, [dataList]);

    const filteredSubmissions = useMemo(() => {
        return dataList.filter(item => {
            const searchLower = searchQuery.toLowerCase().trim();
            // 🟢 UPDATED: Use the secure display name from the controller
            const employeeName = (item.user_name_display || '').toLowerCase();
            const subject = (item.subject || '').toLowerCase();
            const matchesSearch = !searchLower || employeeName.includes(searchLower) || subject.includes(searchLower);

            const matchesType = !filterType || item.type === filterType;

            let matchesDate = true;
            if (startDate || endDate) {
                const itemDate = new Date(item.created_at);
                itemDate.setHours(0, 0, 0, 0);

                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    if (itemDate < start) matchesDate = false;
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (itemDate > end) matchesDate = false;
                }
            }

            return matchesSearch && matchesType && matchesDate;
        });
    }, [dataList, searchQuery, filterType, startDate, endDate]);

    const sortedSubmissions = useMemo(() => {
        return [...filteredSubmissions].sort((a, b) => {
            let aValue = '';
            let bValue = '';

            switch (sortField) {
                case 'date_submitted':
                    aValue = new Date(a.created_at).getTime();
                    bValue = new Date(b.created_at).getTime();
                    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;

                case 'type':
                    aValue = String(a.type || '').toLowerCase();
                    bValue = String(b.type || '').toLowerCase();
                    break;

                default:
                    return 0;
            }

            const comparison = aValue.localeCompare(bValue, undefined, {
                numeric: true,
                sensitivity: 'base',
            });

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [filteredSubmissions, sortField, sortDirection]);

    const toggleSort = (field) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection(field === 'date_submitted' ? 'desc' : 'asc');
        }
    };

    const renderHeaderSortButton = (field) => {
        const isActive = sortField === field;
        const upClass = isActive && sortDirection === 'asc' ? 'text-gray-900' : 'text-gray-300';
        const downClass = isActive && sortDirection === 'desc' ? 'text-gray-900' : 'text-gray-300';

        return (
            <button
                type="button"
                onClick={() => toggleSort(field)}
                className="ml-2 inline-flex items-center justify-center hover:opacity-80 transition"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                    <g className={upClass} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 17V7" />
                        <path d="M4 10l3-3 3 3" />
                    </g>
                    <g className={downClass} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 7v10" />
                        <path d="M14 14l3 3 3-3" />
                    </g>
                </svg>
            </button>
        );
    };

    const getTypeColor = (type) => {
        switch (String(type).toLowerCase()) {
            case 'recommendation': return 'bg-emerald-100 text-emerald-800';
            case 'issue report': return 'bg-red-100 text-red-800';
            default: return 'bg-blue-100 text-blue-800';
        }
    };

    return (
        <SidebarLayout activeModule="HR ADMIN" sidebarLinks={adminSidebarLinks}>
            <Head title="Feedback Submissions" />

            <div className="py-8">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    
                    <div className="mb-6 flex justify-between items-end">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900">Feedback Submissions</h1>
                            <p className="text-gray-500 text-sm mt-1">Review and manage feedback submitted by employees.</p>
                        </div>
                    </div>

                    <div className="mb-6 bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="relative">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Search</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Name or subject..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Feedback Type</label>
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                                >
                                    <option value="">All Types</option>
                                    {uniqueTypes.map((type, idx) => (
                                        <option key={idx} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                                />
                            </div>
                        </div>

                        {(searchQuery || filterType || startDate || endDate) && (
                            <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
                                <button
                                    onClick={() => { setSearchQuery(''); setFilterType(''); setStartDate(''); setEndDate(''); }}
                                    className="text-sm text-gray-500 hover:text-gray-800 font-semibold bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-md transition-colors"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                        <div className="overflow-x-auto overflow-y-auto max-h-[400px] relative w-full custom-scrollbar">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            <div className="flex items-center">
                                                <span>Date Submitted</span>
                                                {renderHeaderSortButton('date_submitted')}
                                            </div>
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            <div className="flex items-center">
                                                <span>Type</span>
                                                {renderHeaderSortButton('type')}
                                            </div>
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Subject</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {sortedSubmissions.length > 0 ? (
                                        sortedSubmissions.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {item.created_at_display}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeColor(item.type)}`}>
                                                        {item.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                                    {item.subject}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {/* 🟢 UPDATED: Use the secure display name from the controller */}
                                                    <span className={item.is_anonymous ? "font-semibold italic text-gray-400" : ""}>
                                                        {item.user_name_display}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button 
                                                        onClick={() => setViewingFeedback(item)}
                                                        className="text-indigo-600 hover:text-indigo-900 font-bold transition-colors"
                                                    >
                                                        Read Feedback
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                                {searchQuery || filterType || startDate || endDate ? 'No feedback matches your filters.' : 'No feedback submissions found.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>

            <Modal show={!!viewingFeedback} onClose={() => setViewingFeedback(null)} maxWidth="2xl">
                {viewingFeedback && (
                    <div className="p-6 max-h-[85vh] overflow-y-auto flex flex-col">
                        
                        <div className="flex justify-between items-start mb-4 border-b pb-4 shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{viewingFeedback.subject}</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    Submitted by <span className={`font-semibold ${viewingFeedback.is_anonymous ? 'italic text-gray-400' : 'text-gray-700'}`}>{viewingFeedback.user_name_display}</span> on {viewingFeedback.created_at_display}
                                </p>
                            </div>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${getTypeColor(viewingFeedback.type)}`}>
                                {viewingFeedback.type}
                            </span>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-gray-800 whitespace-pre-wrap text-sm leading-relaxed mb-6 shrink-0">
                            {viewingFeedback.message}
                        </div>

                        {viewingFeedback.image_path && (
                            <div className="mb-6 shrink-0">
                                <h3 className="text-sm font-bold text-gray-700 mb-2">Attached Image:</h3>
                                <div className="relative w-full h-64 md:h-80 bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
                                    <img 
                                        src={`/storage/${viewingFeedback.image_path}`} 
                                        alt="Feedback Attachment" 
                                        className="absolute inset-0 w-full h-full object-contain p-2"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-4 border-t mt-auto shrink-0">
                            <button 
                                onClick={() => setViewingFeedback(null)}
                                className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-bold rounded hover:bg-gray-300 transition-colors"
                            >
                                Close Window
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </SidebarLayout>
    );
}