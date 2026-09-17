import ConfirmModal from '@/Components/ConfirmModal';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { getDutyMealLinks, canEditModule } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { formatAppDate } from '@/Utils/date';
import { Head, router, usePage } from '@inertiajs/react';
import { Fragment, useMemo, useState } from 'react';

export default function Index({ auth, dutymeals = [], employees = [], departments = [], positions = [], branches = [] }) {
    
    const dutyMealsLinks = getDutyMealLinks(auth);
    const canEditDutyMeals = canEditModule(auth, 'duty_meal_setup_roster');
    const { system } = usePage().props;

    const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);

    const [overviewBranch, setOverviewBranch] = useState('All');

    const [dateFilterType, setDateFilterType] = useState('this_month'); 
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    // Global Confirm Modal
    const [confirmDialog, setConfirmDialog] = useState({ 
        isOpen: false, title: '', message: '', confirmText: '', confirmColor: '', onConfirm: () => {} 
    });
    
    const closeConfirmModal = () => setConfirmDialog({ ...confirmDialog, isOpen: false,});
        
    const [selectedRosterId, setSelectedRosterId] = useState(null);

    // INLINE EDITING STATES
    const [editingShiftId, setEditingShiftId] = useState(null); 
    const [editingChoiceId, setEditingChoiceId] = useState(null); 
    
    const [isEditingMeals, setIsEditingMeals] = useState(false);
    const [editMealData, setEditMealData] = useState({ main: '', alt: '' });

    const [poolMealChoices, setPoolMealChoices] = useState({});
    const [poolNotes, setPoolNotes] = useState({}); // 🟢 ADDED: State to hold the special request notes

    // Derive the selected roster directly from the fresh props
    const selectedRoster = dutymeals.find(m => String(m.id) === String(selectedRosterId));

    const closeModal = () => {
        if (isPoolModalOpen) return; 
        
        setSelectedRosterId(null);
        setEditingShiftId(null);
        setEditingChoiceId(null);
        setIsEditingMeals(false); // Reset meal editing state
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

    // --- ACTION HANDLERS ---
    const startEditingMeals = () => {
        if (!canEditDutyMeals || selectedRoster?.is_locked) return;
        setEditMealData({ main: selectedRoster.main_meal, alt: selectedRoster.alt_meal || '' });
        setIsEditingMeals(true);
    };

    const saveMeals = () => {
        if (!selectedRoster || !canEditDutyMeals) return;
        router.patch(route('admin.duty-meals.update-meals', selectedRoster.id), {
            main_meal: editMealData.main,
            alt_meal: editMealData.alt
        }, {
            preserveScroll: true,
            onSuccess: () => setIsEditingMeals(false)
        });
    };

    const handleChoiceUpdate = (participantId, newChoice) => {
        if (!canEditDutyMeals) return;
        router.patch(route('admin.participants.update-choice', participantId), {
            choice: newChoice
        }, { preserveScroll: true });
    };

    const handleShiftUpdate = (participantId, newShiftType) => {
        if (!canEditDutyMeals) return;
        router.patch(route('admin.participants.update-shift', participantId), { 
            shift_type: newShiftType 
        }, { preserveScroll: true });
    };

   const handleRemove = (employeeName, participantId) => {
        if (!canEditDutyMeals) return;
        setConfirmDialog({
            isOpen: true,
            title: 'Remove Staff from Roster',
            message: `Are you sure you want to remove ${employeeName} from this duty meal? \n\nThis will delete their meal selection.`,
            confirmText: 'Remove from Roster',
            confirmColor: 'bg-red-600 hover:bg-red-500',
            onConfirm: () => {
                router.delete(route('admin.participants.remove', participantId), { 
                    preserveScroll: true,
                    onSuccess: () => closeConfirmModal(),
                });
            }
        });
    };

    const [poolSearch, setPoolSearch] = useState('');
    const [poolDept, setPoolDept] = useState('All');
    const [poolPos, setPoolPos] = useState('');

    const availablePoolPositions = (poolDept === 'All') 
        ? positions 
        : positions.filter(pos => String(pos.department_id) === String(poolDept));

        const filteredPoolEmployees = employees.filter(emp => {
        
        if (selectedRoster?.participants.some(p => p.user?.id === emp.id)) return false;

        const matchesSearch = emp.name.toLowerCase().includes(poolSearch.toLowerCase());
        const matchesDept = poolDept === 'All' || String(emp.department_id) === String(poolDept);
        const matchesPos = poolPos === '' || String(emp.position_id) === String(poolPos);

        return matchesSearch && matchesDept && matchesPos;
    });

   const handleEmergencyAdd = (employeeId, choice) => {
        if (!selectedRoster || !selectedRoster.id) return;

        router.post(route('admin.duty-meals.add-participant', selectedRoster.id), {
            user_id: employeeId,
            choice: choice || 'main',
            custom_request: poolNotes[employeeId] || '' // 🟢 ADDED: Send note payload
        }, {
            preserveScroll: true,
            preserveState: true, 
            onSuccess: () => {
                setPoolSearch(''); 
                setPoolMealChoices(prev => ({ ...prev, [employeeId]: 'main' }));
                setPoolNotes(prev => ({ ...prev, [employeeId]: '' })); // 🟢 ADDED: Clear note after saving
            },
        });
    };

   const filteredDutyMeals = useMemo(() => {
        let filtered = dutymeals;

        // A. Filter by Branch
        if (overviewBranch !== 'All') {
            filtered = filtered.filter(m => String(m.branch_id) === String(overviewBranch));
        }

        // B. Setup Date Math Helpers
        const today = new Date(`${system?.serverDate || '1970-01-01'}T00:00:00`);
        today.setHours(0, 0, 0, 0);

        const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1; 
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        // C. Filter by Date
        filtered = filtered.filter(m => {
            const mealDate = new Date(m.duty_date);
            mealDate.setHours(0, 0, 0, 0);

            if (dateFilterType === 'today') return mealDate.getTime() === today.getTime();
            if (dateFilterType === 'this_week') return mealDate >= startOfWeek && mealDate <= endOfWeek;
            if (dateFilterType === 'this_month') return mealDate.getMonth() === today.getMonth() && mealDate.getFullYear() === today.getFullYear();
            if (dateFilterType === 'custom') {
                const start = customStartDate ? new Date(customStartDate).setHours(0,0,0,0) : -Infinity;
                const end = customEndDate ? new Date(customEndDate).setHours(0,0,0,0) : Infinity;
                return mealDate.getTime() >= start && mealDate.getTime() <= end;
            }
            return true;
        });

        return filtered;
    }, [dutymeals, overviewBranch, dateFilterType, customStartDate, customEndDate, system?.serverDate]);


    // Group the filtered meals by Week!
    const groupedDutyMeals = useMemo(() => {
        const groups = {};

        filteredDutyMeals.forEach(meal => {
            const mealDate = new Date(meal.duty_date);
            const day = mealDate.getDay();
            
            // Calculate the Monday of this meal's week
            const diff = mealDate.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(mealDate);
            monday.setDate(diff);

            // Create a readable label, e.g., "Week of Apr 13, 2026"
            const weekLabel = `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

            if (!groups[weekLabel]) {
                groups[weekLabel] = [];
            }
            groups[weekLabel].push(meal);
        });

        return Object.entries(groups); 
    }, [filteredDutyMeals]);


    // STATS CRUNCHER (Now includes Shifts)
    const stats = useMemo(() => {
        let totalMeals = 0; let totalMain = 0; let totalAlt = 0; let totalSpecial = 0;
        let totalDay = 0; let totalGraveyard = 0; let totalStraight = 0;

        filteredDutyMeals.forEach(meal => {
            meal.participants.forEach(p => {
                totalMeals++;
                if (p.choice === 'main') totalMain++;
                if (p.choice === 'alt') totalAlt++;
                if (p.choice === 'special') totalSpecial++;

                if (p.shift_type === 'day') totalDay++;
                if (p.shift_type === 'graveyard') totalGraveyard++;
                if (p.shift_type === 'straight') totalStraight++;
            });
        });

        return { totalMeals, totalMain, totalAlt, totalSpecial, totalDay, totalGraveyard, totalStraight };
    }, [filteredDutyMeals]); 

    return (
        <SidebarLayout activeModule="Duty Meals"
                        sidebarLinks={dutyMealsLinks}
                        header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Duty Meal Panel
                </h2>}>
            <Head title="Duty Meal Dashboard" />

            {/* --- OVERVIEW DASHBOARD --- */}
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                    <h2 className="text-lg font-medium text-gray-900">Overview Statistics</h2>
                    
                    {/* FILTER ROW */}
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={dateFilterType}
                            onChange={(e) => {
                                setDateFilterType(e.target.value);
                                setCustomStartDate(''); 
                                setCustomEndDate('');
                            }}
                            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-medium text-gray-700 bg-white"
                        >
                            <option value="today">Today</option>
                            <option value="this_week">This Week</option>
                            <option value="this_month">This Month</option>
                            <option value="all">All Active</option>
                            <option value="custom">Custom Range...</option>
                        </select>

                        {dateFilterType === 'custom' && (
                            <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-md border border-gray-200 w-full sm:w-auto">
                                <input 
                                    type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="text-sm border-gray-300 rounded-md shadow-sm py-1.5 focus:border-indigo-500 focus:ring-indigo-500 w-full sm:w-auto"
                                />
                                <span className="text-xs text-gray-500 font-medium">to</span>
                                <input 
                                    type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="text-sm border-gray-300 rounded-md shadow-sm py-1.5 focus:border-indigo-500 focus:ring-indigo-500 w-full sm:w-auto"
                                />
                            </div>
                        )}

                        {branches.length > 1 && (
                            <select
                                value={overviewBranch}
                                onChange={(e) => setOverviewBranch(e.target.value)}
                                className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-medium text-gray-700 bg-white w-full sm:w-auto"
                            >
                                <option value="All">All Branches</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg border border-gray-100 p-4 sm:p-5 shadow-sm flex items-center">
                        <div className="mr-4 rounded-full bg-blue-50 p-3 text-black">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs sm:text-sm font-medium text-gray-500">Total Participants</p>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.totalMeals}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-100 p-4 sm:p-5 shadow-sm flex items-center">
                        <div className="mr-4 rounded-full bg-indigo-50 p-3 text-black">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs sm:text-sm font-medium text-gray-500">Main Orders</p>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.totalMain}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-100 p-4 sm:p-5 shadow-sm flex items-center">
                        <div className="mr-4 rounded-full bg-amber-50 p-3 text-black">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs sm:text-sm font-medium text-gray-500">Alt Orders</p>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.totalAlt}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-100 p-4 sm:p-5 shadow-sm flex items-center">
                        <div className="mr-4 rounded-full bg-purple-50 p-3 text-black">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs sm:text-sm font-medium text-gray-500">Special Requests</p>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.totalSpecial}</p>
                        </div>
                    </div>
                </div>

                {/* --- SHIFT STATISTICS --- */}
                <h3 className="text-sm font-semibold text-gray-700 mt-6 mb-3 px-1">Shift Distribution</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm flex items-center">
                        <div className="mr-4 rounded-full bg-yellow-50 p-3 text-yellow-600">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500">Day Shifts</p>
                            <p className="text-lg font-bold text-gray-900">{stats.totalDay}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm flex items-center">
                        <div className="mr-4 rounded-full bg-emerald-50 p-3 text-emerald-600">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500">Straight Shifts</p>
                            <p className="text-lg font-bold text-gray-900">{stats.totalStraight}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm flex items-center">
                        <div className="mr-4 rounded-full bg-indigo-50 p-3 text-indigo-600">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500">Graveyard Shifts</p>
                            <p className="text-lg font-bold text-gray-900">{stats.totalGraveyard}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* HEADER SECTION WITH EXPORT BUTTON AND SYSTEM LOGS TRACKING */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-medium text-gray-900">Duty Meal Rosters</h2>
                </div>
                <div>
                    <a
                        href={filteredDutyMeals.length > 0 ? route('admin.duty-meals.export', { 
                            ids: filteredDutyMeals.map(m => m.id).join(','),
                            filter: dateFilterType === 'custom' ? `Custom Range (${customStartDate} to ${customEndDate})` : dateFilterType
                        }) : '#'}
                        onClick={(e) => { if(filteredDutyMeals.length === 0) e.preventDefault(); }}
                        className={`inline-flex items-center px-4 py-2 bg-green-600 border border-transparent rounded-md font-semibold text-xs text-white uppercase tracking-widest hover:bg-green-700 active:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition ease-in-out duration-150 shadow-sm ${filteredDutyMeals.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Export Current List to Excel"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export List
                    </a>
                </div>
            </div>

            {/* TABLE SECTION*/}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <tbody className="bg-white divide-y divide-gray-200">
                            {groupedDutyMeals.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="px-6 py-8 text-center text-sm text-gray-500">
                                        No duty meals found for this branch.
                                    </td>
                                </tr>
                            ) : (
                                groupedDutyMeals.map(([weekLabel, meals]) => (
                                    <Fragment key={weekLabel}>
                                        {/* The Week Header Row */}
                                        <tr className="bg-gray-50/80 border-y border-gray-200">
                                            <td colSpan="3" className="px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                {weekLabel}
                                            </td>
                                        </tr>
                                        {/* The actual Daily Meals inside that week */}
                                        {meals.map((meal) => (
                                            <tr key={meal.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => setSelectedRosterId(meal.id)}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {new Date(meal.duty_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{meal.branch?.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{meal.participants_count} Staff</td>
                                            </tr>
                                        ))}
                                    </Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* THE CHOICES MODAL */}
            <Modal show={!!selectedRoster} onClose={closeModal} maxWidth="2xl">
                {selectedRoster && (
                    <div className="flex flex-col max-h-[90vh] sm:max-h-[85vh]">
                        {/* Styled Modal Header - Mobile Responsive */}
                        <div className="bg-gray-50 px-4 sm:px-6 py-4 border-b border-gray-200 flex justify-between items-start rounded-t-lg">
                            <div className="w-full pr-4">
                                <h2 className="text-base sm:text-lg font-bold text-gray-900 flex flex-wrap items-center gap-2">
                                    <span>{selectedRoster.branch?.name}</span>
                                    <span className="text-gray-400 hidden sm:inline">-</span>
                                    <span>{formatAppDate(selectedRoster.duty_date, system?.timezone)}</span>
                                    
                                    {selectedRoster.is_locked && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-1 sm:mt-0">
                                            <svg className="mr-1 h-3 w-3 text-red-800" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                            </svg>
                                            Locked
                                        </span>
                                    )}
                                </h2>
                                
                                {/* Edit Meals Section */}
                                <div className="mt-2 min-h-[30px]">
                                    {isEditingMeals ? (
                                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                            <input 
                                                type="text" 
                                                value={editMealData.main} 
                                                onChange={e => setEditMealData({...editMealData, main: e.target.value})} 
                                                className="text-xs border-gray-300 rounded shadow-sm focus:ring-indigo-500 py-1.5 px-2 w-full sm:w-48" 
                                                placeholder="Main Meal" 
                                            />
                                            <input 
                                                type="text" 
                                                value={editMealData.alt} 
                                                onChange={e => setEditMealData({...editMealData, alt: e.target.value})} 
                                                className="text-xs border-gray-300 rounded shadow-sm focus:ring-amber-500 py-1.5 px-2 w-full sm:w-48" 
                                                placeholder="Alt Meal (Optional)" 
                                            />
                                            <div className="flex gap-2 mt-1 sm:mt-0">
                                                <button onClick={saveMeals} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs hover:bg-indigo-700 font-medium transition">
                                                    Save
                                                </button>
                                                <button onClick={() => setIsEditingMeals(false)} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-xs hover:bg-gray-300 font-medium transition">
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center flex-wrap gap-2 group">
                                            <p className="text-xs sm:text-sm text-gray-600">
                                                <span className="font-medium text-indigo-600">Main:</span> {selectedRoster.main_meal} &nbsp;<span className="text-gray-300">|</span>&nbsp; 
                                                <span className="font-medium text-amber-600">Alt:</span> {selectedRoster.alt_meal || 'None'}
                                            </p>
                                            {!selectedRoster.is_locked && (
                                                <button 
                                                    onClick={startEditingMeals} 
                                                    className="text-gray-400 hover:text-indigo-600 transition-colors p-1 rounded-full hover:bg-gray-200 opacity-100 sm:opacity-0 sm:group-hover:opacity-100" 
                                                    title="Edit Meal Options"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 focus:outline-none p-1.5 rounded-full hover:bg-gray-200 transition bg-gray-100 sm:bg-transparent flex-shrink-0">
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
                                            <th className="px-3 sm:px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {selectedRoster.participants.map((p) => {
                                            const empDetails = getEmployeeDetails(p.user?.id);
                                            return (
                                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                                {/* Employee Name & Titles */}
                                                <td className="px-3 sm:px-5 py-2.5 sm:py-3 whitespace-nowrap">
                                                    <div className="text-xs sm:text-sm font-medium text-gray-900">{p.user?.name}</div>
                                                    <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                                                        {getDepartmentName(empDetails.department_id)} 
                                                        <span className="mx-1 text-gray-300 hidden sm:inline">•</span> 
                                                        <br className="sm:hidden" />
                                                        {getPositionName(empDetails.position_id)}
                                                    </div>
                                                </td>
                                                
                                                {/* INLINE EDIT: Shift Badge */}
                                                <td 
                                                    className={`px-3 sm:px-5 py-2.5 sm:py-3 whitespace-nowrap ${canEditDutyMeals && !selectedRoster.is_locked ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                                                    onClick={() => canEditDutyMeals && !selectedRoster.is_locked && setEditingShiftId(p.id)}
                                                >
                                                    {editingShiftId === p.id ? (
                                                        <div className="relative inline-block">
                                                            <select
                                                                autoFocus
                                                                value={p.shift_type || ''} 
                                                                onChange={(e) => {
                                                                    handleShiftUpdate(p.id, e.target.value);
                                                                    setEditingShiftId(null);
                                                                }}
                                                                onBlur={() => setEditingShiftId(null)}
                                                                onClick={(e) => e.stopPropagation()} 
                                                                // FIX: Added bg-none to hide Tailwind arrow
                                                                className={`appearance-none bg-none inline-flex items-center py-0.5 pl-1.5 sm:pl-2 pr-5 sm:pr-6 text-[9px] sm:text-[10px] font-medium rounded border shadow-sm focus:outline-none focus:ring-1 focus:ring-offset-0 cursor-pointer transition-colors
                                                                    ${!p.shift_type ? 'bg-gray-100 text-gray-800 border-gray-300 focus:ring-gray-400' :
                                                                    p.shift_type === 'graveyard' ? 'bg-indigo-100 text-indigo-800 border-indigo-200 focus:ring-indigo-400' : 
                                                                    p.shift_type === 'straight' ? 'bg-emerald-100 text-emerald-800 border-emerald-200 focus:ring-emerald-400' : 
                                                                    'bg-amber-100 text-amber-800 border-amber-200 focus:ring-amber-400'}`}
                                                            >
                                                                <option value="" disabled>Select Shift</option>
                                                                <option value="day">☀️ Day Shift</option>
                                                                <option value="straight">⏱️ Straight</option>
                                                                <option value="graveyard">🌙 Graveyard</option>
                                                            </select>
                                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-current opacity-60">
                                                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div title="Click to edit shift" className="inline-block">
                                                            {p.shift_type === 'graveyard' && <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">🌙 Graveyard</span>}
                                                            {p.shift_type === 'straight' && <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">⏱️ Straight</span>}
                                                            {p.shift_type === 'day' && <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">☀️ Day Shift</span>}
                                                            
                                                            {(!p.shift_type || p.shift_type === 'none') && <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200 italic">Unassigned</span>}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* INLINE EDIT: Choice Badge */}
                                                <td 
                                                    className={`px-3 sm:px-5 py-2.5 sm:py-3 whitespace-nowrap ${canEditDutyMeals && !selectedRoster.is_locked ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                                                    onClick={() => canEditDutyMeals && !selectedRoster.is_locked && setEditingChoiceId(p.id)}
                                                >
                                                    {editingChoiceId === p.id ? (
                                                        <div className="relative inline-block">
                                                            <select
                                                                autoFocus
                                                                value={p.choice || 'none'}
                                                                onChange={(e) => {
                                                                    handleChoiceUpdate(p.id, e.target.value);
                                                                    setEditingChoiceId(null);
                                                                }}
                                                                onBlur={() => setEditingChoiceId(null)}
                                                                onClick={(e) => e.stopPropagation()} 
                                                                // FIX: Added bg-none to hide Tailwind arrow here too
                                                                className={`appearance-none bg-none inline-flex items-center py-0.5 pl-2 pr-5 sm:pr-6 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider rounded-full border shadow-sm focus:outline-none focus:ring-1 focus:ring-offset-0 cursor-pointer transition-colors
                                                                    ${p.choice === 'none' ? 'bg-gray-100 text-gray-500 border-gray-200 focus:ring-gray-400' : 
                                                                    p.choice === 'main' ? 'bg-blue-100 text-blue-800 border-blue-200 focus:ring-blue-400' : 
                                                                    p.choice === 'special' ? 'bg-purple-100 text-purple-800 border-purple-200 focus:ring-purple-400' :
                                                                    'bg-amber-100 text-amber-800 border-amber-200 focus:ring-amber-400'}`}
                                                            >
                                                                <option value="none" disabled>Pending</option>
                                                                <option value="main">Main</option>
                                                                <option value="alt">Alt</option>
                                                                <option value="special">Special</option>
                                                            </select>
                                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-current opacity-60">
                                                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div title="Click to edit meal choice">
                                                            {p.choice === 'none' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium bg-gray-100 text-gray-500 italic border border-gray-200">Pending</span>}
                                                            {p.choice === 'main' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider">Main</span>}
                                                            {p.choice === 'alt' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">Alt</span>}
                                                            {/* ADDED SPECIAL CHOICE BADGE */}
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
                                                    )}
                                                </td>

                                                <td className="px-3 sm:px-5 py-2.5 sm:py-3 whitespace-nowrap text-right text-sm font-medium">
                                                    {canEditDutyMeals ? (
                                                        <button 
                                                            type="button" 
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleRemove(p.user?.name, p.id);
                                                            }}
                                                            className="rounded-full p-1 sm:p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none"
                                                            title="Remove from Roster"
                                                        >
                                                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">Read-only</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )})}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {!selectedRoster.is_locked && canEditDutyMeals && (
                            <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-end rounded-b-lg">
                                <PrimaryButton className="w-full sm:w-auto text-center justify-center" onClick={() => setIsPoolModalOpen(true)}>
                                    + Add Staff from Pool
                                </PrimaryButton>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* --- THE NEW EMPLOYEE POOL MODAL (Standard Width: 3xl) --- */}
            <Modal show={isPoolModalOpen} onClose={() => setIsPoolModalOpen(false)} maxWidth="3xl">
                <div className="p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-medium text-gray-900">Add Staff to Roster</h2>
                        <button onClick={() => setIsPoolModalOpen(false)} className="text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded-full hover:bg-gray-100 transition bg-gray-100 sm:bg-transparent">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Filter Controls - Now with more breathing room */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <TextInput 
                            placeholder="Search name..." 
                            className="w-full sm:flex-1 text-sm"
                            value={poolSearch} 
                            onChange={e => setPoolSearch(e.target.value)} 
                        />
                        <select 
                            className="w-full sm:flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                            value={poolDept} 
                            onChange={e => { setPoolDept(e.target.value); setPoolPos(''); }}
                        >
                            <option value="All">All Depts</option>
                            {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                        </select>
                        <select 
                            className="w-full sm:flex-1 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm text-sm disabled:bg-gray-100"
                            value={poolPos} 
                            onChange={e => setPoolPos(e.target.value)}
                            disabled={poolDept !== 'All' && availablePoolPositions.length === 0}
                        >
                            <option value="">All Positions</option>
                            {availablePoolPositions.map(pos => <option key={pos.id} value={pos.id}>{pos.name}</option>)}
                        </select>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-md h-[350px] sm:h-[400px] overflow-y-auto">
                        {filteredPoolEmployees.length === 0 ? (
                            <div className="p-8 text-center text-sm text-gray-500 flex flex-col items-center justify-center h-full">
                                <svg className="h-10 w-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                No available employees match your search.
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {filteredPoolEmployees.map(emp => (
                                    <li key={emp.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 hover:bg-gray-50 transition gap-3 sm:gap-4">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {getDepartmentName(emp.department_id)} 
                                                <span className="mx-1 text-gray-300">•</span> 
                                                {getPositionName(emp.position_id)}
                                            </p>
                                        </div>
                                        
                                        {/* 🟢 NEW: Modified the layout to fit the text input next to the select dropdown */}
                                        <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                            <select
                                                value={poolMealChoices[emp.id] || 'main'}
                                                onChange={(e) => setPoolMealChoices({ ...poolMealChoices, [emp.id]: e.target.value })}
                                                className="text-xs border-gray-300 rounded shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1.5 pl-2 pr-6 w-[100px] shrink-0"
                                            >
                                                <option value="main">Main Meal</option>
                                                <option value="alt">Alt Meal</option>
                                                <option value="special">Special</option>
                                            </select>
                                            
                                            {/* 🟢 ADDED: Custom Request Input */}
                                            <input 
                                                type="text"
                                                placeholder="Notes (e.g. No rice)"
                                                value={poolNotes[emp.id] || ''}
                                                onChange={(e) => setPoolNotes({ ...poolNotes, [emp.id]: e.target.value })}
                                                className="text-xs border-gray-300 rounded shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-1.5 px-2 w-full sm:w-[130px]"
                                            />

                                            <SecondaryButton 
                                                onClick={() => handleEmergencyAdd(emp.id, poolMealChoices[emp.id] || 'main')}
                                                className="text-xs px-3 py-1.5 justify-center sm:justify-start whitespace-nowrap shrink-0"
                                            >
                                                + Add
                                            </SecondaryButton>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </Modal>

             {/* Global Confirmation Modal */}
             <ConfirmModal 
                show={confirmDialog.isOpen}
                onClose={closeConfirmModal}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText={confirmDialog.confirmText}
                confirmColor={confirmDialog.confirmColor}
                onConfirm={confirmDialog.onConfirm}
            />
        </SidebarLayout>
    );
}