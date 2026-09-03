import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { getDutyMealLinks } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head, Link, useForm, usePage, router } from '@inertiajs/react';
import { useMemo, useState, useEffect } from 'react';

// 🟢 HELPER: Extracts the precise shift a person has from the Attendance Engine
const getShiftDetails = (emp, dateString, dayName) => {
    if (!emp) return { isOff: false, shiftType: null };
    
    // 1. Check Overrides First
    const override = emp.mapped_overrides?.[dateString];
    if (override) {
        // 🟢 BUG FIX: Ensure leaves are also treated as off days for meals
        return { isOff: override.is_off_day || override.is_leave, shiftType: override.shift_type };
    }

    // 2. Check Master Schedules
    const activeSchedule = emp.mapped_schedules?.find(sch => dateString >= sch.start_date && dateString <= sch.end_date);
    if (activeSchedule) {
        // 🟢 BUG FIX: Read from the new 7-Day Pattern logic instead of the deprecated off_days array!
        if (activeSchedule.pattern && activeSchedule.pattern[dayName]) {
            const dayConfig = activeSchedule.pattern[dayName];
            return {
                isOff: dayConfig.is_off_day || dayConfig.is_leave,
                shiftType: dayConfig.shift_type,
            };
        }

        // Legacy fallback
        return {
            isOff: activeSchedule.off_days?.includes(dayName),
            shiftType: activeSchedule.shift_type,
        };
    }

    return { isOff: false, shiftType: null };
};

// 🟢 HELPER: Maps Attendance shifts to Duty Meal shifts
const mapShiftType = (attendanceShift) => {
    if (attendanceShift === 'Straight Duty') return 'straight';
    if (attendanceShift === 'Graveyard Shift') return 'graveyard';
    return 'day'; // Default fallback
};

export default function CreateDutyMeal({ auth, employees = [], branches = [], departments = [], positions = [] }) {
    const dutyMealsLinks = getDutyMealLinks(auth);
    const { system } = usePage().props;
    const canEditDutyMeals = auth?.user?.acl_permissions?.duty_meal_setup_roster === 'full' || auth?.user?.acl_permissions?.duty_meal_setup_roster === 'edit';
    
    // --- SMART DEFAULT BRANCH LOGIC ---
    const defaultBranch = branches.length > 0 
        ? (branches.find(b => b.id === auth?.user?.branch_id)?.id || branches[0].id) 
        : '';

    // 🟢 VIEW MODE TOGGLE (Manual vs Auto) - Defaulted to manual
    const [viewMode, setViewMode] = useState('manual');

    // 🟢 MULTI-BRANCH MODAL STATES & UNIFIED PUBLISH MODAL
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [multiBranchStaffList, setMultiBranchStaffList] = useState([]);
    const [keepStaffMap, setKeepStaffMap] = useState({});
    
    // 🟢 FEATURE 1: Missing Schedules State
    const [missingDepts, setMissingDepts] = useState([]);

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

    // --- WEEK GENERATOR HELPER ---
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

    // 🟢 AUTO-FILL LOGIC ENGINE
    const applyAutoFill = (startDateStr, branchId) => {
        if (!startDateStr || !branchId) return;
        const newSched = generateWeekSchedule(startDateStr);

        // Filter employees belonging to the selected branch
        const branchEmps = employees.filter(emp => {
            const selectedBranchId = Number(branchId);
            return Number(emp.branch_id) === selectedBranchId || 
                (emp.assigned_branch_ids && emp.assigned_branch_ids.includes(selectedBranchId));
        });

        // Populate participants based on their Attendance Schedule
        newSched.forEach((day, index) => {
            const existingDay = data.schedule[index];
            if (existingDay) {
                day.main_meal = existingDay.main_meal;
                day.alt_meal = existingDay.alt_meal;
            }

            branchEmps.forEach(emp => {
                const shift = getShiftDetails(emp, day.date, day.dayName);
                // The updated getShiftDetails now properly flags isOff as true for leaves and pattern off-days!
                if (shift.shiftType && !shift.isOff) {
                    day.participants.push({
                        id: emp.id,
                        name: emp.name,
                        department: emp.department_id,
                        position: emp.position_id,
                        shift_type: mapShiftType(shift.shiftType)
                    });
                }
            });
        });

        setData(prev => ({ ...prev, week_start: startDateStr, branch_id: branchId, schedule: newSched }));
    };

    const handleWeekChange = (e) => {
        if (!canEditDutyMeals) return;
        const dateVal = e.target.value;
        if (viewMode === 'auto') {
            applyAutoFill(dateVal, data.branch_id);
        } else {
            const newSched = generateWeekSchedule(dateVal);
            setData({ ...data, week_start: dateVal, schedule: newSched });
        }
        setActiveTab(0); 
    };

    const handleBranchChange = (e) => {
        if (!canEditDutyMeals) return;
        const newBranchId = e.target.value;
        if (viewMode === 'auto' && data.week_start) {
            applyAutoFill(data.week_start, newBranchId);
        } else {
            setData('branch_id', newBranchId);
        }
    };

    // Auto-sync when switching TO Auto Mode
    useEffect(() => {
        if (viewMode === 'auto' && data.week_start && data.branch_id) {
            applyAutoFill(data.week_start, data.branch_id);
        }
    }, [viewMode]);

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

    // Auto Mode specific meal changer (no active tab needed)
    const handleMealChangeAuto = (index, field, value) => {
        if (!canEditDutyMeals || !hasSelectedWeek) return;
        const newSchedule = [...data.schedule];
        newSchedule[index] = { ...newSchedule[index], [field]: value };
        setData('schedule', newSchedule);
    };

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

    // 🟢 NEW: Compute if any day with scheduled staff is missing their Main or Alt Meal
    const hasMissingMeals = useMemo(() => {
        if (!data.schedule) return false;
        return data.schedule.some(day => {
            const staffCount = (day.participants || []).length;
            const mainMeal = (day.main_meal || '').trim();
            const altMeal = (day.alt_meal || '').trim();
            // Both meals are strictly required if staff are scheduled for this day
            return staffCount > 0 && (!mainMeal || !altMeal);
        });
    }, [data.schedule]);

    // --- LOOKUP & FILTER HELPERS ---
    const getDepartmentName = (deptId) => {
        const found = departments.find(d => String(d.id) === String(deptId));
        return found ? found.name : 'Unassigned';
    };
    const getPositionName = (posId) => {
        const found = positions.find(pos => String(pos.id) === String(posId));
        return found ? found.name : 'No Position';
    };
    const getBranchName = (branchId) => {
        const found = branches.find(b => String(b.id) === String(branchId));
        return found ? found.name : 'Branch';
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

    // 🟢 SUBMIT INTERCEPTOR FOR MULTI-BRANCH CHECK & MISSING SCHEDULES
    const submit = (e) => {
        e.preventDefault();
        if (!canEditDutyMeals) return;

        // 1. Gather all unique participant IDs across the 7 days
        const participantIds = new Set();
        data.schedule.forEach(day => {
            (day.participants || []).forEach(p => participantIds.add(p.id));
        });

        // 2. Filter employees who have multiple assigned branches (assigned_branch_ids.length > 1)
        const multiBranchEmps = employees.filter(emp => 
            participantIds.has(emp.id) && emp.assigned_branch_ids && emp.assigned_branch_ids.length > 1
        );

        // Default all multi-branch staff to 'Keep' (true)
        const initialMap = {};
        multiBranchEmps.forEach(emp => {
            initialMap[emp.id] = true;
        });
        setKeepStaffMap(initialMap);
        setMultiBranchStaffList(multiBranchEmps);

        // 3. 🟢 FEATURE 1: Check for missing attendance schedules in the branch
        const branchEmps = employees.filter(emp => {
            const selectedBranchId = Number(data.branch_id);
            return Number(emp.branch_id) === selectedBranchId || 
                (emp.assigned_branch_ids && emp.assigned_branch_ids.includes(selectedBranchId));
        });

        const mDepts = new Set();
        branchEmps.forEach(emp => {
            let hasMissing = false;
            // Scan through all 7 days of the selected week
            data.schedule.forEach(day => {
                const shift = getShiftDetails(emp, day.date, day.dayName);
                if (!shift.isOff && !shift.shiftType) {
                    hasMissing = true;
                }
            });
            // If they are missing an attendance schedule, flag their department
            if (hasMissing) {
                mDepts.add(getDepartmentName(emp.department_id));
            }
        });

        setMissingDepts(Array.from(mDepts));
        setIsPublishModalOpen(true);
    };

    // 🟢 FINAL PUBLISH AFTER MODAL CONFIRMATION
    const handleConfirmPublish = () => {
        const updatedSchedule = data.schedule.map(day => ({
            ...day,
            participants: (day.participants || []).filter(p => keepStaffMap[p.id] !== false)
        }));

        router.post(route('admin.duty-meals.store'), {
            ...data,
            schedule: updatedSchedule
        }, {
            onSuccess: () => setIsPublishModalOpen(false)
        });
    };

    const totalWeeklyStaff = (data.schedule || []).reduce((total, day) => total + (day?.participants?.length || 0), 0);
    
    const allFilteredSelected = hasSelectedWeek && filteredEmployees.length > 0 && 
        filteredEmployees.every(emp => activeParticipants.some(p => p.id === emp.id));

    return (
        <SidebarLayout activeModule="Duty Meals" sidebarLinks={dutyMealsLinks}
            header={
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-xl font-semibold leading-tight text-gray-800">Duty Meal Setup</h2>
                    
                    {/* 🟢 VIEW MODE TOGGLE */}
                    <div className="inline-flex rounded-lg bg-gray-200 p-1">
                        <button
                            type="button"
                            onClick={() => setViewMode('manual')}
                            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${viewMode === 'manual' ? 'bg-white text-gray-900 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Manual Setup
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('auto')}
                            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${viewMode === 'auto' ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            Auto-Generate
                        </button>
                    </div>
                </div>
            }>
            <Head title="Setup Weekly Roster" />

            {/* 🟢 INJECTED CSS FOR MODAL ANIMATIONS */}
            <style>{`
                @keyframes modalPop {
                    0% { opacity: 0; transform: scale(0.95) translateY(10px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-modal-pop { animation: modalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                
                @keyframes backdropFade {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
                .animate-backdrop-fade { animation: backdropFade 0.3s ease-out forwards; }
            `}</style>

            <form onSubmit={submit} className="pb-12">
                {/* HEADER & GLOBAL ACTIONS */}
                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900">
                            {viewMode === 'auto' ? 'Auto-Generate Roster' : 'Weekly Roster & Meals'}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {viewMode === 'auto' ? 'Instantly build your roster using data from the Attendance Module.' : 'Manually design your week and assign staff shifts.'}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link href={route('admin.duty-meals.index')}>
                            <SecondaryButton type="button">Cancel</SecondaryButton>
                        </Link>
                        {/* 🟢 PUBLISH BUTTON LOGIC: Disabled if meal inputs are missing */}
                        <PrimaryButton 
                            disabled={processing || !hasSelectedWeek || totalWeeklyStaff === 0 || !canEditDutyMeals || hasMissingMeals} 
                            className={(!canEditDutyMeals || hasMissingMeals) ? 'opacity-60 cursor-not-allowed' : ''}
                            title={hasMissingMeals ? 'Please provide both Main and Alternative meals for all days with scheduled staff before publishing.' : ''}
                        >
                            {canEditDutyMeals ? `Publish Roster (${totalWeeklyStaff} Shifts)` : 'View Only'}
                        </PrimaryButton>
                    </div>
                </div>

                {/* WEEK & BRANCH SETUP */}
                <div className="mb-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-6">
                    <div className="flex-1">
                        <InputLabel htmlFor="week_picker" value="🗓️ Select Starting Date" className="font-bold" />
                        <TextInput id="week_picker" type="date" className="mt-2 block w-full" 
                            value={data.week_start} onChange={handleWeekChange} min={minDate} required disabled={!canEditDutyMeals} />
                        <InputError message={errors.week_start} className="mt-2" />
                    </div>
                    
                    <div className="flex-1">
                        <InputLabel htmlFor="branch_id" value="🏢 Select Branch" className="font-bold" />
                        <select id="branch_id" 
                            className={`mt-2 block w-full rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 
                                ${branches.length <= 1 ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`}
                            value={data.branch_id} onChange={handleBranchChange} 
                            disabled={branches.length <= 1 || !canEditDutyMeals} required>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                </div>


                {/* ======================================================= */}
                {/* 🟢 AUTO-GENERATE VIEW (Fast & Streamlined)              */}
                {/* ======================================================= */}
                {viewMode === 'auto' && (
                    <>
                        {hasSelectedWeek ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 animate-fade-in-up">
                                {data.schedule.map((day, index) => (
                                    <div key={day.date} className="bg-white p-5 rounded-xl border border-indigo-100 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-5">
                                            <div>
                                                <h3 className="font-bold text-gray-900 text-lg">{day.dayName}</h3>
                                                <p className="text-xs font-medium text-gray-500">{day.date}</p>
                                            </div>
                                            <div className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 text-center shadow-inner">
                                                <span className="block text-lg font-black leading-none mb-0.5">{day.participants.length}</span>
                                                Staff Working
                                            </div>
                                        </div>
                                        <div className="space-y-4 flex-1 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                                            {/* 🟢 ADDED: Required validation styling and asterisks */}
                                            <div>
                                                <InputLabel className="text-xs">
                                                    🍗 Main Meal {day.participants.length > 0 && <span className="text-rose-500 ml-1">*</span>}
                                                </InputLabel>
                                                <TextInput 
                                                    placeholder="e.g. Chicken Adobo w/ Rice" 
                                                    className={`mt-1.5 block w-full text-sm shadow-sm ${day.participants.length > 0 && !(day.main_meal || '').trim() ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500' : ''}`}
                                                    value={day.main_meal || ''} 
                                                    onChange={e => handleMealChangeAuto(index, 'main_meal', e.target.value)} 
                                                    disabled={!canEditDutyMeals} 
                                                    required={day.participants.length > 0}
                                                />
                                            </div>
                                            <div>
                                                <InputLabel className="text-xs">
                                                    🥗 Alternative Meal {day.participants.length > 0 && <span className="text-rose-500 ml-1">*</span>}
                                                </InputLabel>
                                                <TextInput 
                                                    placeholder="e.g. Tofu Stir-fry" 
                                                    className={`mt-1.5 block w-full text-sm shadow-sm ${day.participants.length > 0 && !(day.alt_meal || '').trim() ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500' : ''}`}
                                                    value={day.alt_meal || ''} 
                                                    onChange={e => handleMealChangeAuto(index, 'alt_meal', e.target.value)} 
                                                    disabled={!canEditDutyMeals} 
                                                    required={day.participants.length > 0}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                
                                {/* Instructions Card for the 8th slot */}
                                <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 shadow-sm flex flex-col justify-center items-center text-center border-dashed">
                                    <div className="text-4xl mb-3">🚀</div>
                                    <h3 className="font-bold text-indigo-900">Roster Auto-Generated!</h3>
                                    <p className="text-xs text-indigo-700 mt-2">The system has automatically read your Attendance Schedules. Just fill in the meals and click Publish above!</p>
                                    <p className="text-[10px] text-indigo-500 mt-4 italic">Need to make a manual adjustment? Switch to "Manual Setup" at the top.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-dashed border-indigo-200 p-16 text-center mt-6 shadow-sm bg-indigo-50/30">
                                <div className="text-6xl mb-4">⚡</div>
                                <h3 className="text-lg font-bold text-indigo-900">Ready to Automate?</h3>
                                <p className="mt-2 text-sm text-indigo-700 max-w-md mx-auto">Select a starting date and location above. The system will instantly pull all scheduled staff from the Attendance module.</p>
                            </div>
                        )}
                    </>
                )}

                {viewMode === 'manual' && (
                    <>
                        {hasSelectedWeek ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
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
                                                {activeTab === index && <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600"></div>}
                                                <div className="font-bold text-sm tracking-wide">{day.dayName}</div>
                                                <div className="text-xs mt-1">{day.date ? day.date.split('-').slice(1).join('/') : ''}</div>
                                                <div className="mt-2 flex justify-center">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isFilled ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-500'}`}>
                                                        {(day.participants || []).length} Staff
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="p-6 bg-gray-50/50">
                                    <div className="flex flex-col lg:flex-row gap-6 mb-6">
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative">
                                            <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                                                Editing: {activeDay.dayName}
                                            </div>
                                            {/* 🟢 ADDED: Required validation styling and asterisks */}
                                            <div>
                                                <InputLabel>
                                                    🍗 Main Meal {(activeDay.participants || []).length > 0 && <span className="text-rose-500 ml-1">*</span>}
                                                </InputLabel>
                                                <TextInput placeholder="e.g. Chicken Adobo w/ Rice" 
                                                    className={`mt-1 block w-full text-sm ${(activeDay.participants || []).length > 0 && !(activeDay.main_meal || '').trim() ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500' : ''}`} 
                                                    value={activeDay.main_meal || ''} onChange={e => handleMealChange('main_meal', e.target.value)} disabled={!canEditDutyMeals} required={(activeDay.participants || []).length > 0} />
                                            </div>
                                            <div>
                                                <InputLabel>
                                                    🥗 Alternative Meal {(activeDay.participants || []).length > 0 && <span className="text-rose-500 ml-1">*</span>}
                                                </InputLabel>
                                                <TextInput placeholder="e.g. Tofu Stir-fry" 
                                                    className={`mt-1 block w-full text-sm ${(activeDay.participants || []).length > 0 && !(activeDay.alt_meal || '').trim() ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500' : ''}`} 
                                                    value={activeDay.alt_meal || ''} onChange={e => handleMealChange('alt_meal', e.target.value)} disabled={!canEditDutyMeals} required={(activeDay.participants || []).length > 0} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                        <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[600px] overflow-hidden">
                                            <div className="bg-gray-900 p-4 shrink-0 flex justify-between items-center text-white">
                                                <h2 className="font-semibold text-gray-100">Available Staff</h2>
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

                                        <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[600px] overflow-hidden">
                                            <div className="bg-indigo-900 p-4 shrink-0 flex justify-between items-center text-white">
                                                <h2 className="font-semibold">{activeDay.dayName || 'Day'}'s Roster</h2>
                                                <span className="bg-indigo-700 px-3 py-1 rounded-full text-xs font-bold shadow-inner">
                                                    {activeDayStats.total} Total Staff
                                                </span>
                                            </div>

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
                    </>
                )}
            </form>

            {/* 🟢 UNIFIED PUBLISH CONFIRMATION MODAL */}
            {isPublishModalOpen && (
                <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity animate-backdrop-fade" onClick={() => setIsPublishModalOpen(false)}></div>

                        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>
                        <div className="inline-block transform overflow-hidden rounded-xl bg-white text-left align-bottom shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:align-middle relative z-10 animate-modal-pop">
                            <div className="p-6">
                                <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                                    <h2 className="text-lg font-bold text-gray-900">Publish Roster Confirmation</h2>
                                    <button onClick={() => setIsPublishModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full">
                                        ✕
                                    </button>
                                </div>

                                {/* 🟢 FEATURE 1: MISSING SCHEDULES WARNING */}
                                {missingDepts.length > 0 && (
                                    <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
                                        <svg className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <div>
                                            <h3 className="text-sm font-bold text-amber-800">Missing Schedules Detected</h3>
                                            <p className="text-xs text-amber-700 mt-1">
                                                Some active employees in the following departments do not have Attendance Schedules set for this week and will be excluded from the Duty Meal roster:
                                            </p>
                                            <p className="text-xs font-black text-amber-900 mt-2 block">
                                                {missingDepts.join(', ')}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* EXISTING MULTI-BRANCH LOGIC */}
                                {multiBranchStaffList.length > 0 && (
                                    <div className="mt-6">
                                        <h3 className="text-sm font-bold text-gray-900 mb-2">Multi-Branch Staff Review</h3>
                                        <p className="text-xs text-gray-600 mb-3">
                                            The following staff members are assigned to multiple branches. Please choose whether to <strong>Keep</strong> or <strong>Remove</strong> them from this roster:
                                        </p>
                                        <div className="max-h-[250px] overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg bg-gray-50">
                                            {multiBranchStaffList.map(emp => {
                                                const isKeeping = keepStaffMap[emp.id] !== false;
                                                const assignedBranchNames = (emp.assigned_branch_ids || []).map(bId => getBranchName(bId)).join(', ');

                                                return (
                                                    <div key={emp.id} className="p-4 flex items-center justify-between bg-white">
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900">{emp.name}</p>
                                                            <p className="text-xs text-gray-500 mt-0.5">Assigned Branches: <span className="font-medium text-indigo-600">{assignedBranchNames}</span></p>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setKeepStaffMap(prev => ({ ...prev, [emp.id]: true }))}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                    isKeeping 
                                                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                }`}
                                                            >
                                                                Keep
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setKeepStaffMap(prev => ({ ...prev, [emp.id]: false }))}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                                    !isKeeping 
                                                                    ? 'bg-red-600 text-white shadow-sm' 
                                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                }`}
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-200">
                                    <SecondaryButton onClick={() => setIsPublishModalOpen(false)}>
                                        Cancel & Review
                                    </SecondaryButton>
                                    {/* 🟢 FEATURE 7: Removed Text Input, restored normal Publish Button */}
                                    <PrimaryButton 
                                        onClick={handleConfirmPublish}
                                        disabled={processing}
                                    >
                                        Confirm & Publish Roster
                                    </PrimaryButton>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </SidebarLayout>
    );
}