import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { getDutyMealLinks } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';

export default function CreateDutyMeal({ auth, employees = [], branches = [], departments = [], positions = [] }) {
    const dutyMealsLinks = getDutyMealLinks(auth);
    const { system } = usePage().props;
    const canEditDutyMeals = auth?.user?.acl_permissions?.duty_meal_setup_roster === 'full' || auth?.user?.acl_permissions?.duty_meal_setup_roster === 'edit';
    
    // --- SMART DEFAULT BRANCH LOGIC ---
    const defaultBranch = branches.length > 0 
        ? (branches.find(b => b.id === auth?.user?.branch_id)?.id || branches[0].id) 
        : '';

    const { data, setData, post, processing, errors } = useForm({
        branch_id: defaultBranch,
        week_start: '', 
        schedule: [] // Holds 7 days
    });

    const [activeTab, setActiveTab] = useState(0); 
    const [departmentFilter, setDepartmentFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPosition, setFilterPosition] = useState('');

    const availablePositions = (departmentFilter === 'All') 
        ? positions 
        : positions.filter(pos => String(pos.department_id) === String(departmentFilter));

    const tomorrow = new Date(`${system?.serverDate || '1970-01-01'}T00:00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];

    // --- WEEK GENERATOR HELPER (🟢 FIXED: Starts on exact selected date) ---
    const generateWeekSchedule = (selectedDateStr) => {
        if (!selectedDateStr) return [];
        
        // Use the exact date the user picked
        const startDate = new Date(`${selectedDateStr}T00:00:00`);

        const newSchedule = [];
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            
            // Fix formatting to ensure local YYYY-MM-DD
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const date = String(currentDate.getDate()).padStart(2, '0');
            
            newSchedule.push({
                date: `${year}-${month}-${date}`,
                dayName: currentDate.toLocaleDateString('en-US', { weekday: 'long' }), 
                main_meal: '',
                alt_meal: '',
                participants: []
            });
        }
        return newSchedule;
    };

    const handleWeekChange = (e) => {
        if (!canEditDutyMeals) return;
        const dateVal = e.target.value;
        const newSched = generateWeekSchedule(dateVal);
        setData({
            ...data,
            week_start: newSched[0]?.date || '', 
            schedule: newSched
        });
        setActiveTab(0); 
    };

    // 🟢 SAFE FALLBACKS
    const activeDay = data.schedule ? data.schedule[activeTab] || {} : {};
    const activeParticipants = activeDay.participants || [];
    const hasSelectedWeek = data.schedule && data.schedule.length === 7;

    const handleMealChange = (field, value) => {
        if (!canEditDutyMeals || !hasSelectedWeek) return;
        const newSchedule = [...data.schedule];
        newSchedule[activeTab] = { ...newSchedule[activeTab], [field]: value };
        setData('schedule', newSchedule);
    };

    // Calculate real-time shift analytics for the active day
    const activeDayStats = useMemo(() => {
        if (!activeParticipants || activeParticipants.length === 0) return { day: 0, straight: 0, grave: 0, total: 0 };
        return activeParticipants.reduce((acc, p) => {
            if (p.shift_type === 'day') acc.day++;
            if (p.shift_type === 'straight') acc.straight++;
            if (p.shift_type === 'graveyard') acc.grave++;
            acc.total++;
            return acc;
        }, { day: 0, straight: 0, grave: 0, total: 0 });
    }, [activeParticipants]);

    // --- LOOKUP & FILTER HELPERS ---
    const getDepartmentName = (deptId) => {
        const found = departments.find(d => String(d.id) === String(deptId));
        return found ? found.name : 'Unassigned';
    };
    const getPositionName = (posId) => {
        const found = positions.find(pos => String(pos.id) === String(posId));
        return found ? found.name : 'No Position';
    };

    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const selectedBranchId = Number(data.branch_id);
            const matchesBranch = Number(emp.branch_id) === selectedBranchId || 
                (emp.assigned_branch_ids && emp.assigned_branch_ids.includes(selectedBranchId));
            const matchesDept = departmentFilter === 'All' || String(emp.department_id) === String(departmentFilter);
            const matchesPosition = filterPosition === '' || String(emp.position_id) === String(filterPosition);
            const matchesSearch = (emp.name || '').toLowerCase().includes(searchQuery.trim().toLowerCase());
            return matchesBranch && matchesDept && matchesSearch && matchesPosition;
        });
    }, [employees, data.branch_id, departmentFilter, filterPosition, searchQuery]);

    const toggleStaff = (employee) => {
        if (!canEditDutyMeals) return;
        if (!hasSelectedWeek) return alert('Please select a week start date first.');
        const isAlreadySelected = activeParticipants.some(p => p.id === employee.id);
        
        let newParticipants;
        if (isAlreadySelected) {
            newParticipants = activeParticipants.filter(p => p.id !== employee.id);
        } else {
            newParticipants = [...activeParticipants, { 
                id: employee.id, name: employee.name, department: employee.department_id, 
                position: employee.position_id, shift_type: 'day' 
            }];
        }
        const newSchedule = [...data.schedule];
        newSchedule[activeTab] = { ...activeDay, participants: newParticipants };
        setData('schedule', newSchedule);
    };

    const changeShiftType = (employeeId, newShift) => {
        if (!canEditDutyMeals) return;
        const newParticipants = activeParticipants.map(p => 
            p.id === employeeId ? { ...p, shift_type: newShift } : p
        );
        const newSchedule = [...data.schedule];
        newSchedule[activeTab] = { ...activeDay, participants: newParticipants };
        setData('schedule', newSchedule);
    };

    // --- BULK SELECTION FUNCTIONS ---
    const selectAllFiltered = () => {
        if (!canEditDutyMeals || !hasSelectedWeek) return;
        const currentIds = new Set(activeParticipants.map(p => p.id));
        const newParticipants = [...activeParticipants];
        filteredEmployees.forEach(emp => {
            if (!currentIds.has(emp.id)) {
                newParticipants.push({
                    id: emp.id, name: emp.name, department: emp.department_id, 
                    position: emp.position_id, shift_type: 'day'
                });
            }
        });
        const newSchedule = [...data.schedule];
        newSchedule[activeTab] = { ...activeDay, participants: newParticipants };
        setData('schedule', newSchedule);
    };

    const deselectAllFiltered = () => {
        if (!canEditDutyMeals || !hasSelectedWeek) return;
        const filteredIds = new Set(filteredEmployees.map(emp => emp.id));
        const newParticipants = activeParticipants.filter(p => !filteredIds.has(p.id));
        
        const newSchedule = [...data.schedule];
        newSchedule[activeTab] = { ...activeDay, participants: newParticipants };
        setData('schedule', newSchedule);
    };

    const submit = (e) => {
        e.preventDefault();
        if (!canEditDutyMeals) return;
        post(route('admin.duty-meals.store'));
    };

    const totalWeeklyStaff = (data.schedule || []).reduce((total, day) => total + (day?.participants?.length || 0), 0);
    
    const allFilteredSelected = hasSelectedWeek && filteredEmployees.length > 0 && 
        filteredEmployees.every(emp => activeParticipants.some(p => p.id === emp.id));

    return (
        <SidebarLayout activeModule="Duty Meals" sidebarLinks={dutyMealsLinks}
            header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Duty Meal Panel</h2>}>
            <Head title="Setup Weekly Roster" />

            <form onSubmit={submit} className="pb-12">
                {/* HEADER & GLOBAL ACTIONS */}
                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900">Weekly Roster & Meals</h1>
                        <p className="text-sm text-gray-500 mt-1">Design your week, assign staff shifts, and set the daily menu.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link href={route('admin.duty-meals.index')}>
                            <SecondaryButton type="button">Cancel</SecondaryButton>
                        </Link>
                        <PrimaryButton disabled={processing || !hasSelectedWeek || totalWeeklyStaff === 0 || !canEditDutyMeals} className={!canEditDutyMeals ? 'opacity-60 cursor-not-allowed' : ''}>
                            {canEditDutyMeals ? `Publish Roster (${totalWeeklyStaff} Shifts)` : 'View Only'}
                        </PrimaryButton>
                    </div>
                </div>

                {/* WEEK & BRANCH SETUP */}
                <div className="mb-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-6">
                    <div className="flex-1">
                        <InputLabel htmlFor="week_picker" value="🗓️ Select Starting Date" className="font-bold" />
                        <TextInput id="week_picker" type="date" className="mt-2 block w-full" 
                            onChange={handleWeekChange} min={minDate} required disabled={!canEditDutyMeals} />
                        <InputError message={errors.week_start} className="mt-2" />
                    </div>
                    
                    <div className="flex-1">
                        <InputLabel htmlFor="branch_id" value="🏢 Select Branch" className="font-bold" />
                        <select id="branch_id" 
                            className={`mt-2 block w-full rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 
                                ${branches.length <= 1 ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`}
                            value={data.branch_id} onChange={e => setData('branch_id', e.target.value)} 
                            disabled={branches.length <= 1 || !canEditDutyMeals} required>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* WEEKLY WORKSPACE */}
                {hasSelectedWeek ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        
                        {/* THE 7-DAY NAVIGATION */}
                        <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50 hide-scrollbar">
                            {data.schedule.map((day, index) => {
                                const isFilled = (day.participants || []).length > 0;
                                return (
                                    <button key={day.date || index} type="button" onClick={() => setActiveTab(index)}
                                        className={`flex-1 min-w-[120px] py-4 px-2 text-center transition-all relative
                                            ${activeTab === index 
                                                ? 'bg-white text-indigo-700' 
                                                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                                        disabled={!canEditDutyMeals}
                                    >
                                        {/* Active Tab Indicator Line */}
                                        {activeTab === index && <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600"></div>}
                                        
                                        <div className="font-bold text-sm tracking-wide">{day.dayName}</div>
                                        <div className="text-xs mt-1">{day.date ? day.date.split('-').slice(1).join('/') : ''}</div>
                                        
                                        {/* Activity Indicator Pill */}
                                        <div className="mt-2 flex justify-center">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isFilled ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-500'}`}>
                                                {(day.participants || []).length} Staff
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* ACTIVE DAY WORKSPACE */}
                        <div className="p-6 bg-gray-50/50">
                            
                            {/* DAY CONTROLS & MEALS */}
                            <div className="flex flex-col lg:flex-row gap-6 mb-6">
                                {/* Meals */}
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative">
                                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                                        Editing: {activeDay.dayName}
                                    </div>
                                    
                                    <div>
                                        <InputLabel value="🍗 Main Meal" />
                                        <TextInput placeholder="e.g. Chicken Adobo w/ Rice" className="mt-1 block w-full text-sm" 
                                            value={activeDay.main_meal || ''} onChange={e => handleMealChange('main_meal', e.target.value)} disabled={!canEditDutyMeals} />
                                    </div>
                                    <div>
                                        <InputLabel value="🥗 Alternative Meal" />
                                        <TextInput placeholder="e.g. Tofu Stir-fry" className="mt-1 block w-full text-sm" 
                                            value={activeDay.alt_meal || ''} onChange={e => handleMealChange('alt_meal', e.target.value)} disabled={!canEditDutyMeals} />
                                    </div>
                                </div>
                            </div>

                            {/* STAFF SPLIT SCREEN */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                
                                {/* ⬅️ LEFT: THE POOL */}
                                <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[600px] overflow-hidden">
                                    <div className="bg-gray-900 p-4 shrink-0 flex justify-between items-center text-white">
                                        <h2 className="font-semibold text-gray-100">Available Staff</h2>
                                        
                                        {/* SLEEK DARK MODE SELECT/DESELECT BUTTON */}
                                        <button 
                                            type="button" 
                                            onClick={allFilteredSelected ? deselectAllFiltered : selectAllFiltered} 
                                            disabled={!canEditDutyMeals}
                                            className={`text-xs font-bold px-3 py-1.5 rounded transition-colors border focus:outline-none ${
                                                !canEditDutyMeals
                                                    ? 'bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed'
                                                    : allFilteredSelected 
                                                        ? 'bg-gray-700 text-gray-200 border-gray-500 hover:bg-gray-600' 
                                                        : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700 hover:text-white'
                                            }`}
                                        >
                                            {allFilteredSelected ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                    
                                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-3 shrink-0">
                                        <TextInput placeholder="🔍 Search employee name..." className="w-full text-sm"
                                            value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setFilterPosition(''); }} disabled={!canEditDutyMeals} />
                                        <div className="flex gap-2">
                                            <select className="flex-1 rounded-md border-gray-300 text-sm py-1.5" value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} disabled={!canEditDutyMeals}>
                                                <option value="All">All Departments</option>
                                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                            <select className="flex-1 rounded-md border-gray-300 text-sm py-1.5" value={filterPosition} onChange={e => setFilterPosition(e.target.value)} disabled={departmentFilter==='All' || !canEditDutyMeals}>
                                                <option value="">All Positions</option>
                                                {availablePositions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-2">
                                        {filteredEmployees.length === 0 ? (
                                            <div className="text-center text-gray-400 py-10 text-sm font-medium">No matches found.</div>
                                        ) : (
                                            <div className="grid gap-1.5">
                                                {filteredEmployees.map(emp => {
                                                    const isSelected = activeParticipants.some(p => p.id === emp.id);
                                                    return (
                                                        <div key={emp.id} onClick={() => toggleStaff(emp)}
                                                            className={`group flex items-center justify-between p-3 rounded-lg border transition select-none
                                                                ${!canEditDutyMeals
                                                                    ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-70'
                                                                    : isSelected
                                                                        ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-500 cursor-pointer'
                                                                        : 'bg-white border-gray-200 hover:border-gray-400 cursor-pointer'}`}>
                                                            <div>
                                                                <p className={`text-sm font-bold ${isSelected ? 'text-indigo-900' : 'text-gray-800'}`}>{emp.name}</p>
                                                                <p className="text-[11px] text-gray-500 mt-0.5">{getDepartmentName(emp.department_id)} • {getPositionName(emp.position_id)}</p>
                                                            </div>
                                                            <div className={`h-6 w-6 rounded-full flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 group-hover:border-gray-400'}`}>
                                                                {isSelected && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ➡️ RIGHT: SELECTED ROSTER */}
                                <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[600px] overflow-hidden">
                                    {/* Dashboard Header for the Day */}
                                    <div className="bg-indigo-900 p-4 shrink-0 flex justify-between items-center text-white">
                                        <h2 className="font-semibold">{activeDay.dayName || 'Day'}'s Roster</h2>
                                        <span className="bg-indigo-700 px-3 py-1 rounded-full text-xs font-bold shadow-inner">
                                            {activeDayStats.total} Total Staff
                                        </span>
                                    </div>

                                    {/* Shift Breakdown Stats */}
                                    <div className="flex bg-indigo-50 border-b border-indigo-100 shrink-0">
                                        <div className="flex-1 py-2 text-center border-r border-indigo-100">
                                            <div className="text-xl font-black text-amber-600">{activeDayStats.day}</div>
                                            <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">☀️ Day</div>
                                        </div>
                                        <div className="flex-1 py-2 text-center border-r border-indigo-100">
                                            <div className="text-xl font-black text-emerald-600">{activeDayStats.straight}</div>
                                            <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">⏱️ Straight</div>
                                        </div>
                                        <div className="flex-1 py-2 text-center">
                                            <div className="text-xl font-black text-indigo-600">{activeDayStats.grave}</div>
                                            <div className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">🌙 Graveyard</div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 overflow-y-auto bg-gray-50 p-2">
                                        {activeParticipants.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                                <div className="text-4xl mb-3">👻</div>
                                                <p className="font-medium text-gray-600">No one scheduled for {activeDay.dayName}</p>
                                                <p className="text-xs mt-1">Select staff from the pool on the left.</p>
                                            </div>
                                        ) : (
                                            <div className="grid gap-2">
                                                {activeParticipants.map(p => (
                                                    <div key={p.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900">{p.name}</p>
                                                            <p className="text-[11px] text-gray-500">{getDepartmentName(p.department)}</p>
                                                        </div>

                                                        {/* 1-Click Segmented Shift Buttons */}
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 shadow-inner">
                                                                <button type="button" onClick={() => changeShiftType(p.id, 'day')}
                                                                    disabled={!canEditDutyMeals}
                                                                    className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${p.shift_type === 'day' ? 'bg-white shadow text-amber-600 ring-1 ring-amber-400' : 'text-gray-500'} ${canEditDutyMeals ? 'hover:text-gray-700' : 'cursor-not-allowed opacity-60'}`}>
                                                                    Day
                                                                </button>
                                                                <button type="button" onClick={() => changeShiftType(p.id, 'straight')}
                                                                    disabled={!canEditDutyMeals}
                                                                    className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${p.shift_type === 'straight' ? 'bg-white shadow text-emerald-600 ring-1 ring-emerald-400' : 'text-gray-500'} ${canEditDutyMeals ? 'hover:text-gray-700' : 'cursor-not-allowed opacity-60'}`}>
                                                                    Str
                                                                </button>
                                                                <button type="button" onClick={() => changeShiftType(p.id, 'graveyard')}
                                                                    disabled={!canEditDutyMeals}
                                                                    className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${p.shift_type === 'graveyard' ? 'bg-white shadow text-indigo-600 ring-1 ring-indigo-400' : 'text-gray-500'} ${canEditDutyMeals ? 'hover:text-gray-700' : 'cursor-not-allowed opacity-60'}`}>
                                                                    Grave
                                                                </button>
                                                            </div>
                                                            
                                                            {/* Remove Button */}
                                                            <button type="button" onClick={() => toggleStaff(p)} disabled={!canEditDutyMeals} className={`p-2 rounded-full transition-colors ${canEditDutyMeals ? 'text-gray-300 hover:text-red-500 hover:bg-red-50' : 'text-gray-200 cursor-not-allowed'}`}>
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 text-center mt-6 shadow-sm">
                        <div className="text-6xl mb-4">📅</div>
                        <h3 className="text-lg font-bold text-gray-900">Your Canvas is Empty</h3>
                        <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">Please select a starting date and location at the top of the screen to begin building your weekly duty meal roster.</p>
                    </div>
                )}
            </form>
        </SidebarLayout>
    );
}