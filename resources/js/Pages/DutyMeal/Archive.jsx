import ConfirmModal from '@/Components/ConfirmModal';
import DangerButton from '@/Components/DangerButton';
import Modal from '@/Components/Modal';
import { getDutyMealLinks, canEditModule } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { formatAppDate } from '@/Utils/date';
import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

// Notice we added employees, departments, and positions to the props
export default function Archive({ auth, archivedMealsByWeek, availableDates, currentFilter, employees = [], departments = [], positions = [] }) {
    const dutyMealsLinks = getDutyMealLinks(auth);
    const { system } = usePage().props;
    
    // Global Confirm Modal State
    const [confirmDialog, setConfirmDialog] = useState({ 
        isOpen: false, title: '', message: '', onConfirm: () => {} 
    });
    const closeConfirmModal = () => setConfirmDialog({ ...confirmDialog, isOpen: false });

    // 🟢 ADDED: State for the viewing Modal
    const [selectedRosterId, setSelectedRosterId] = useState(null);

    // Flatten the grouped object to find the specific roster when clicked
    const allArchivedMeals = Object.values(archivedMealsByWeek).flat();
    const selectedRoster = allArchivedMeals.find(m => String(m.id) === String(selectedRosterId));

    // Handle Month/Year Filter Change
    const handleFilterChange = (e) => {
        const [year, month] = e.target.value.split('-');
        router.get(route('admin.duty-meals.archive'), { year, month }, { preserveState: true });
    };

    // --- DELETION HANDLERS ---
    // 1. Delete Single Roster
    const handleDeleteRoster = (e, id, dateStr) => {
        e.stopPropagation(); // 🟢 ADDED: Prevent opening the modal when clicking delete
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Roster',
            message: `Are you sure you want to permanently delete the roster for ${dateStr}?`,
            onConfirm: () => {
                router.delete(route('admin.duty-meals.destroy', id), { onSuccess: closeConfirmModal });
            }
        });
    };

    // 2. Delete Entire Week
    const handleDeleteWeek = (weekName, mealsInWeek) => {
        const ids = mealsInWeek.map(m => m.id);
        setConfirmDialog({
            isOpen: true,
            title: `Delete ${weekName}`,
            message: `Are you sure you want to delete all ${ids.length} rosters in ${weekName}?`,
            onConfirm: () => {
                router.post(route('admin.duty-meals.bulk-delete'), { ids }, { onSuccess: closeConfirmModal });
            }
        });
    };

    // 3. Delete Entire Month
    const handleDeleteMonth = () => {
        const allIds = allArchivedMeals.map(m => m.id);
        if (allIds.length === 0) return;

        setConfirmDialog({
            isOpen: true,
            title: 'Delete Entire Month',
            message: `WARNING: You are about to permanently delete all ${allIds.length} rosters for this month. This cannot be undone.`,
            onConfirm: () => {
                router.post(route('admin.duty-meals.bulk-delete'), { ids: allIds }, { onSuccess: closeConfirmModal });
            }
        });
    };

    // --- LOOKUP HELPERS FOR UI ---
    const getDepartmentName = (deptId) => {
        if (!deptId) return 'Unassigned';
        const found = departments.find(d => String(d.id) === String(deptId));
        return found ? found.name : 'Unassigned';
    };

    const getPositionName = (posId) => {
        if (!posId) return 'No Position';
        const found = positions.find(pos => String(pos.id) === String(posId));
        return found ? found.name : 'No Position';
    };

    const getEmployeeDetails = (userId) => {
        return employees.find(emp => String(emp.id) === String(userId)) || {};
    };

    return (
        <SidebarLayout activeModule="Duty Meals" sidebarLinks={dutyMealsLinks} header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Archive Panel</h2>}>
            <Head title="Duty Meal Archive" /><div className="mb-4 flex flex-wrap gap-3"><a className="rounded border border-gray-300 bg-white px-4 py-2 text-sm" href={route('admin.duty-meals.export',{ids:allArchivedMeals.map(meal=>meal.id).join(',')})}>Export archive</a>{canEditModule(auth,'duty_meal_setup_roster') && <a className="rounded border border-gray-300 bg-white px-4 py-2 text-sm" href={route('admin.duty-meals.create')}>Import roster in Setup</a>}</div>

            {/* HEADER & FILTERS */}
            <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold text-gray-900">Archived Rosters</h1>
                
                <div className="flex items-center gap-4">
                    <select 
                        className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        value={`${currentFilter.year}-${currentFilter.month}`}
                        onChange={handleFilterChange}
                    >
                        {availableDates.length === 0 && <option value={`${currentFilter.year}-${currentFilter.month}`}>No Archives Found</option>}
                        {availableDates.map(date => {
                            const label = formatAppDate(`${date.year}-${String(date.month).padStart(2, '0')}-01`, system?.timezone, { month: 'long', year: 'numeric' });
                            return <option key={`${date.year}-${date.month}`} value={`${date.year}-${date.month}`}>{label}</option>;
                        })}
                    </select>

                    {auth.user.role_id === 1 && Object.keys(archivedMealsByWeek).length > 0 && (
                        <DangerButton onClick={handleDeleteMonth}>
                            Delete Entire Month
                        </DangerButton>
                    )}
                </div>
            </div>

            {/* WEEKLY GROUPING DISPLAY */}
            {Object.keys(archivedMealsByWeek).length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-100 p-8 text-center text-gray-500">
                    No archived rosters found for this month.
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(archivedMealsByWeek).map(([weekName, meals]) => (
                        <div key={weekName} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{weekName}</h3>
                                {auth.user.role_id === 1 && (
                                    <button onClick={() => handleDeleteWeek(weekName, meals)} className="text-xs text-red-600 hover:text-red-800 font-medium">
                                        Delete Week
                                    </button>
                                )}
                            </div>
                            <table className="min-w-full divide-y divide-gray-200">
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {meals.map((meal) => (
                                        // 🟢 ADDED: onClick handler to open the modal
                                        <tr key={meal.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => setSelectedRosterId(meal.id)}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {formatAppDate(meal.duty_date, system?.timezone, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{meal.branch?.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{meal.participants_count} Staff</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {auth.user.role_id === 1 && (
                                                    <button onClick={(e) => handleDeleteRoster(e, meal.id, formatAppDate(meal.duty_date, system?.timezone))} className="text-red-600 hover:text-red-900 px-2 py-1">
                                                        Delete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            )}

            {/* 🟢 ADDED: THE VIEWING MODAL (Read-Only) */}
            <Modal show={!!selectedRoster} onClose={() => setSelectedRosterId(null)} maxWidth="2xl">
                {selectedRoster && (
                    <div className="flex flex-col max-h-[90vh] sm:max-h-[85vh]">
                        {/* Styled Modal Header */}
                        <div className="bg-gray-50 px-4 sm:px-6 py-4 border-b border-gray-200 flex justify-between items-start rounded-t-lg">
                            <div className="w-full pr-4">
                                <h2 className="text-base sm:text-lg font-bold text-gray-900 flex flex-wrap items-center gap-2">
                                    <span>{selectedRoster.branch?.name}</span>
                                    <span className="text-gray-400 hidden sm:inline">-</span>
                                    <span>{formatAppDate(selectedRoster.duty_date, system?.timezone)}</span>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800 mt-1 sm:mt-0">
                                        Archived
                                    </span>
                                </h2>
                                
                                <div className="mt-2 min-h-[30px]">
                                    <div className="flex items-center flex-wrap gap-2 group">
                                        <p className="text-xs sm:text-sm text-gray-600">
                                            <span className="font-medium text-indigo-600">Main:</span> {selectedRoster.main_meal} &nbsp;<span className="text-gray-300">|</span>&nbsp; 
                                            <span className="font-medium text-amber-600">Alt:</span> {selectedRoster.alt_meal || 'None'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setSelectedRosterId(null)} className="text-gray-400 hover:text-gray-600 focus:outline-none p-1.5 rounded-full hover:bg-gray-200 transition bg-gray-100 sm:bg-transparent flex-shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        {/* Display the Staff Choices Table */}
                        <div className="overflow-y-auto flex-1 p-4 sm:p-6 w-full">
                            <div className="border border-gray-200 rounded-lg overflow-x-auto shadow-sm w-full">
                                <table className="min-w-full divide-y divide-gray-200 w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift</th>
                                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Choice</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {selectedRoster.participants.map((p) => {
                                            const empDetails = getEmployeeDetails(p.user?.id);
                                            return (
                                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-3 sm:px-5 py-2.5 sm:py-3 whitespace-nowrap">
                                                    <div className="text-xs sm:text-sm font-medium text-gray-900">{p.user?.name}</div>
                                                    <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                                                        {getDepartmentName(empDetails.department_id)} 
                                                        <span className="mx-1 text-gray-300 hidden sm:inline">•</span> 
                                                        <br className="sm:hidden" />
                                                        {getPositionName(empDetails.position_id)}
                                                    </div>
                                                </td>
                                                
                                                <td className="px-3 sm:px-5 py-2.5 sm:py-3 whitespace-nowrap">
                                                    <div className="inline-block">
                                                        {p.shift_type === 'graveyard' && <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">🌙 Graveyard</span>}
                                                        {p.shift_type === 'straight' && <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">⏱️ Straight</span>}
                                                        {p.shift_type === 'day' && <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">☀️ Day Shift</span>}
                                                        {(!p.shift_type || p.shift_type === 'none') && <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200 italic">Unassigned</span>}
                                                    </div>
                                                </td>

                                                <td className="px-3 sm:px-5 py-2.5 sm:py-3 whitespace-nowrap">
                                                    <div className="inline-block">
                                                        {p.choice === 'none' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium bg-gray-100 text-gray-500 italic border border-gray-200">Pending</span>}
                                                        {p.choice === 'main' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider">Main</span>}
                                                        {p.choice === 'alt' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">Alt</span>}
                                                        {p.choice === 'special' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">Special</span>}
                                                        
                                                        {p.site && (
                                                            <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">
                                                                {p.site}
                                                            </span>
                                                        )}
                                                        {p.custom_request && (
                                                            <div className="text-[9px] sm:text-[10px] text-gray-500 italic mt-1 leading-tight max-w-[80px] sm:max-w-[120px] truncate" title={p.custom_request}>
                                                                Note: {p.custom_request}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )})}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* GLOBAL CONFIRM MODAL */}
            <ConfirmModal 
                show={confirmDialog.isOpen}
                onClose={closeConfirmModal}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText="Permanently Delete"
                confirmColor="bg-red-600 hover:bg-red-700"
                onConfirm={confirmDialog.onConfirm}
            />
        </SidebarLayout>
    );
}