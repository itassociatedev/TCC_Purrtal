import ConfirmModal from '@/Components/ConfirmModal';
import { getStaffDutyMealLinks } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { formatAppDate } from '@/Utils/date';
import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

const MealCard = ({ meal, selection, onSelectionChange }) => {
    const { system } = usePage().props;
    
    // BUG FIX: Added a fallback `|| ''` to prevent crashes when branch_name is null in the database
    const isMakati = (meal.branch_name || '').toLowerCase().includes('makati');
    
    const isStrictlyLocked = meal.is_locked || meal.choice !== 'none';
    const currentChoice = isStrictlyLocked ? meal.choice : (selection?.choice || '');
    const currentSite = isStrictlyLocked ? (meal.site || '') : (selection?.site || '');
    const currentNote = isStrictlyLocked ? (meal.custom_request || '') : (selection?.custom_request || '');

    // Auto-clear comment when 'main' or 'alt' is selected so hidden data doesn't submit
    useEffect(() => {
        if ((currentChoice === 'main' || currentChoice === 'alt') && currentNote !== '') {
            onSelectionChange(meal.participant_id, 'custom_request', '');
        }
    }, [currentChoice]);

    // Dynamically change label and placeholder based on current selection
    let noteLabel = "Optional Request";
    let inputPlaceholder = "e.g., Extra Rice or 2 Bananas";

    if (currentChoice === 'special') {
        noteLabel = "Special Request";
        inputPlaceholder = "e.g., 2 Bananas, 2 Eggs";
    }

    if (isStrictlyLocked && !currentNote) {
        inputPlaceholder = "No special requests made.";
    }

    return (
        <div className="bg-white rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 flex flex-col relative group overflow-hidden">
            
            {/* STYLISH HEADER */}
            <div className="px-5 pt-5 pb-4 flex justify-between items-start border-b border-slate-50/50">
                <div className="flex items-center gap-4">
                    {/* Modern Date Block */}
                    <div className="flex flex-col items-center justify-center bg-indigo-50 text-indigo-600 rounded-2xl min-w-[64px] p-2 shadow-sm border border-indigo-100/50">
                        <span className="text-sm font-black text-center leading-none">
                            {formatAppDate(meal.duty_date, system?.timezone, { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest mt-1">
                            {formatAppDate(meal.duty_date, system?.timezone, { weekday: 'short' })}
                        </span>
                    </div>
                    
                    <div>
                        <div className="flex items-center space-x-1.5 mb-1">
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{meal.branch_name || 'N/A'}</span>
                        </div>
                        
                        {/* Status Badges */}
                        {meal.is_locked ? (
                            <span className="inline-flex items-center px-2.5 py-1 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-full uppercase tracking-wide border border-rose-100">
                                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Locked
                            </span>
                        ) : meal.choice !== 'none' ? (
                            <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full uppercase tracking-wide border border-emerald-100">
                                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                Saved Choice
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2.5 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-full uppercase tracking-wide border border-amber-100 animate-pulse">
                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5"></div>
                                Action Needed
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* BODY - PLUSH TILES */}
            <div className="px-5 pb-5 flex-grow flex flex-col gap-5">
                
                <div className="space-y-3 mt-2">
                    {/* 1. MAIN MEAL */}
                    <label className={`relative flex cursor-pointer rounded-2xl border p-4 focus:outline-none transition-all duration-200 ${
                        currentChoice === 'main' 
                        ? 'bg-indigo-50/50 border-indigo-400 shadow-sm ring-1 ring-indigo-400' 
                        : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                    } ${isStrictlyLocked ? 'opacity-70 cursor-not-allowed' : ''}`}>
                        <input type="radio" name={`choice-${meal.participant_id}`} value="main" className="hidden" checked={currentChoice === 'main'} onChange={(e) => onSelectionChange(meal.participant_id, 'choice', e.target.value)} disabled={isStrictlyLocked}/>
                        <div className="flex w-full items-center justify-between">
                            <div className="flex items-center">
                                <div className="flex flex-col">
                                    <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${currentChoice === 'main' ? 'text-indigo-600' : 'text-slate-400'}`}>Main Meal</span>
                                    <span className={`text-sm font-semibold ${currentChoice === 'main' ? 'text-indigo-900' : 'text-slate-700'}`}>{meal.main_meal}</span>
                                </div>
                            </div>
                            {currentChoice === 'main' && (
                                <svg className="h-6 w-6 text-indigo-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                    </label>

                    {/* 2. ALTERNATIVE MEAL */}
                    {meal.alt_meal && (
                        <label className={`relative flex cursor-pointer rounded-2xl border p-4 focus:outline-none transition-all duration-200 ${
                            currentChoice === 'alt' 
                            ? 'bg-indigo-50/50 border-indigo-400 shadow-sm ring-1 ring-indigo-400' 
                            : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                        } ${isStrictlyLocked ? 'opacity-70 cursor-not-allowed' : ''}`}>
                            <input type="radio" name={`choice-${meal.participant_id}`} value="alt" className="hidden" checked={currentChoice === 'alt'} onChange={(e) => onSelectionChange(meal.participant_id, 'choice', e.target.value)} disabled={isStrictlyLocked}/>
                            <div className="flex w-full items-center justify-between">
                                <div className="flex items-center">
                                    <div className="flex flex-col">
                                        <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${currentChoice === 'alt' ? 'text-indigo-600' : 'text-slate-400'}`}>Alternative Meal</span>
                                        <span className={`text-sm font-semibold ${currentChoice === 'alt' ? 'text-indigo-900' : 'text-slate-700'}`}>{meal.alt_meal}</span>
                                    </div>
                                </div>
                                {currentChoice === 'alt' && (
                                    <svg className="h-6 w-6 text-indigo-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                        </label>
                    )}

                    {/* 3. SPECIAL REQUEST */}
                    <label className={`relative flex cursor-pointer rounded-2xl border p-4 focus:outline-none transition-all duration-200 ${
                        currentChoice === 'special' 
                        ? 'bg-indigo-50/50 border-indigo-400 shadow-sm ring-1 ring-indigo-400' 
                        : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                    } ${isStrictlyLocked ? 'opacity-70 cursor-not-allowed' : ''}`}>
                        <input type="radio" name={`choice-${meal.participant_id}`} value="special" className="hidden" checked={currentChoice === 'special'} onChange={(e) => onSelectionChange(meal.participant_id, 'choice', e.target.value)} disabled={isStrictlyLocked}/>
                        <div className="flex w-full items-center justify-between">
                            <div className="flex items-center">
                                <div className="flex flex-col">
                                    <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${currentChoice === 'special' ? 'text-indigo-600' : 'text-slate-400'}`}>Special Request</span>
                                    <span className={`text-sm font-semibold ${currentChoice === 'special' ? 'text-indigo-900' : 'text-slate-700'}`}>Build Your Own / Custom</span>
                                </div>
                            </div>
                            {currentChoice === 'special' && (
                                <svg className="h-6 w-6 text-indigo-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                    </label>
                </div>

                {/* MAKATI SITE SELECTION (Pill Style) */}
                {isMakati && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <label className="flex items-center text-[10px] font-bold text-slate-500 mb-2.5 uppercase tracking-widest">
                            Location Site <span className="text-rose-500 ml-1 text-sm leading-none">*</span>
                        </label>
                        <div className="flex p-1 bg-slate-200/60 rounded-xl shadow-inner">
                            <label className={`flex-1 text-center py-2 px-3 rounded-lg transition-all duration-200 cursor-pointer text-sm font-bold ${
                                currentSite === 'Back Office' 
                                ? 'bg-white text-indigo-700 shadow shadow-black/5' 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            } ${isStrictlyLocked ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                <input type="radio" name={`site-${meal.participant_id}`} value="Back Office" className="hidden" checked={currentSite === 'Back Office'} onChange={(e) => onSelectionChange(meal.participant_id, 'site', e.target.value)} disabled={isStrictlyLocked}/>
                                Back Office
                            </label>

                            <label className={`flex-1 text-center py-2 px-3 rounded-lg transition-all duration-200 cursor-pointer text-sm font-bold ${
                                currentSite === 'Clinic' 
                                ? 'bg-white text-indigo-700 shadow shadow-black/5' 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            } ${isStrictlyLocked ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                <input type="radio" name={`site-${meal.participant_id}`} value="Clinic" className="hidden" checked={currentSite === 'Clinic'} onChange={(e) => onSelectionChange(meal.participant_id, 'site', e.target.value)} disabled={isStrictlyLocked}/>
                                Clinic
                            </label>
                        </div>
                    </div>
                )}

                {/* REQUEST INPUT BOX OR SELECTED MEAL CONFIRMATION */}
                <div className="mt-auto">
                    {/* IF MAIN/ALT IS CHOSEN -OR- IF SPECIAL IS CHOSEN AND LOCKED: Hide input, show message */}
                    {(currentChoice === 'main' || currentChoice === 'alt' || (isStrictlyLocked && currentChoice === 'special')) ? (
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3 animate-fade-in-up">
                            <svg className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                            <p className="text-sm font-medium text-emerald-800 leading-snug">
                                Your meal on <strong>{formatAppDate(meal.duty_date, system?.timezone, { month: 'long', day: 'numeric' })}</strong> is <strong>{currentChoice === 'main' ? meal.main_meal : currentChoice === 'alt' ? meal.alt_meal : currentNote}</strong>.
                            </p>
                        </div>
                    ) : (
                        /* OTHERWISE: Show the input field so they can type their special request */
                        <>
                            <label className="flex items-center text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">
                                <svg className="w-3.5 h-3.5 mr-1.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                {noteLabel}
                                {/* Show red asterisk if the field is currently required */}
                                {currentChoice === 'special' && (
                                    <span className="text-rose-500 ml-1 text-sm leading-none">*</span>
                                )}
                            </label>
                            <input 
                                type="text" 
                                placeholder={inputPlaceholder}
                                className={`w-full text-sm py-3 px-4 bg-slate-50 border rounded-xl shadow-sm focus:bg-white focus:ring-4 transition-all font-medium placeholder-slate-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed ${
                                    currentChoice === 'special' && !currentNote.trim()
                                    ? 'border-amber-300 focus:border-amber-400 focus:ring-amber-500/10' 
                                    : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-500/10'
                                }`}
                                value={currentNote}
                                onChange={(e) => onSelectionChange(meal.participant_id, 'custom_request', e.target.value)}
                                disabled={isStrictlyLocked}
                                required={currentChoice === 'special'}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function Index({ auth, myDutyMeals = [] }) {
    const DutyMealLinks = getStaffDutyMealLinks();

    // 1. FILTER STATES
    const [statusFilter, setStatusFilter] = useState('Pending');
    const [monthFilter, setMonthFilter] = useState('');

    const availableMonths = useMemo(() => {
        const months = new Map();
        myDutyMeals.forEach(meal => {
            const mealDate = new Date(meal.duty_date);
            // 🟢 FIXED: Removed Monday logic from month filter
            const val = `${mealDate.getFullYear()}-${String(mealDate.getMonth() + 1).padStart(2, '0')}`;
            const label = mealDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            if (!months.has(val)) months.set(val, label);
        });
        return Array.from(months.entries()).sort((a, b) => b[0].localeCompare(a[0])); 
    }, [myDutyMeals]);

    useEffect(() => {
        if (!monthFilter && availableMonths.length > 0) {
            const current = new Date();
            const currentVal = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
            
            if (availableMonths.some(([val]) => val === currentVal)) {
                setMonthFilter(currentVal);
            } else {
                setMonthFilter(availableMonths[0][0]);
            }
        }
    }, [availableMonths, monthFilter]);

    // 2. GROUP AND FILTER LOGIC (🟢 NEW: Groups by contiguous 7-day blocks)
    const activeGroupedMeals = useMemo(() => {
        // Sort all meals by branch first, then exact date ascending
        const sortedMeals = [...myDutyMeals].sort((a, b) => {
            if (a.branch_id !== b.branch_id) return (a.branch_id || 0) - (b.branch_id || 0);
            return new Date(a.duty_date) - new Date(b.duty_date);
        });

        const groups = [];
        let currentGroup = null;

        sortedMeals.forEach(meal => {
            const mealDate = new Date(meal.duty_date);
            mealDate.setHours(0, 0, 0, 0);

            // If no group exists, or branch changed -> Start a new block
            if (!currentGroup || currentGroup.branch_id !== meal.branch_id) {
                currentGroup = {
                    branch_id: meal.branch_id,
                    branch_name: meal.branch_name,
                    startDate: mealDate,
                    meals: [meal]
                };
                groups.push(currentGroup);
            } else {
                // Check if meal belongs in current 7-day block
                const diffTime = Math.abs(mealDate - currentGroup.startDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 7) { 
                    currentGroup.meals.push(meal);
                } else {
                    // Start new block
                    currentGroup = {
                        branch_id: meal.branch_id,
                        branch_name: meal.branch_name,
                        startDate: mealDate,
                        meals: [meal]
                    };
                    groups.push(currentGroup);
                }
            }
        });

        // Convert the groups objects into the array format the UI expects
        let entries = groups.map(g => {
            const startStr = g.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endObj = new Date(g.meals[g.meals.length - 1].duty_date);
            const endStr = endObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            const groupLabel = g.meals.length > 1 ? `${startStr} - ${endStr}` : startStr;

            return [groupLabel, g.meals, g.startDate];
        });

        // Apply visual filters
        if (monthFilter && monthFilter !== 'All') {
            entries = entries.filter(([_, __, startDate]) => {
                const groupMonthVal = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
                return groupMonthVal === monthFilter;
            });
        }

        if (statusFilter !== 'All') {
            entries = entries.filter(([_, meals]) => {
                const pendingCount = meals.filter(m => !m.is_locked && m.choice === 'none').length;
                if (statusFilter === 'Pending') return pendingCount > 0;
                if (statusFilter === 'Completed') return pendingCount === 0;
                return true;
            });
        }

        // Final sort ascending
        return entries.sort((a, b) => a[2] - b[2]);

    }, [myDutyMeals, monthFilter, statusFilter]);

    // 3. PAGINATION & MASTER STATE
    const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
    const [selections, setSelections] = useState({});
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (currentGroupIndex >= activeGroupedMeals.length) {
            setCurrentGroupIndex(Math.max(0, activeGroupedMeals.length - 1));
        }
    }, [activeGroupedMeals.length, currentGroupIndex, monthFilter, statusFilter]);

    useEffect(() => {
        const initialSelections = {};
        myDutyMeals.forEach(meal => {
            if (!meal.is_locked && meal.choice === 'none') {
                initialSelections[meal.participant_id] = {
                    participant_id: meal.participant_id,
                    choice: '',
                    site: '', 
                    custom_request: ''
                };
            }
        });
        setSelections(initialSelections);
    }, [myDutyMeals]);

    const handleSelectionChange = (participantId, field, value) => {
        setSelections(prev => ({
            ...prev,
            [participantId]: { ...prev[participantId], [field]: value }
        }));
    };

    // 4. SUBMIT HANDLER
    const [confirmDialog, setConfirmDialog] = useState({ 
        isOpen: false, title: '', message: '', confirmText: '', confirmColor: '', onConfirm: () => {} 
    });
    const closeConfirmModal = () => setConfirmDialog({ ...confirmDialog, isOpen: false });

    const handleBulkLockIn = (groupSelectionsToSubmit, groupLabel) => {
        setConfirmDialog({
            isOpen: true,
            title: `Lock In Choices`,
            message: `Are you sure you want to lock in your ${groupSelectionsToSubmit.length} meal choices for this block (${groupLabel})? You will not be able to change them after this.`,
            confirmText: 'Lock In My Meals',
            confirmColor: 'bg-indigo-600 hover:bg-indigo-700',
            onConfirm: () => {
                setIsProcessing(true);
                router.post(route('staff.duty-meals.bulk-lock-in'), {
                    selections: groupSelectionsToSubmit
                }, {
                    preserveScroll: true,
                    onSuccess: () => {
                        closeConfirmModal();
                        setIsProcessing(false);
                        setCurrentGroupIndex(0); 
                    },
                    onError: () => setIsProcessing(false)
                });
            }
        });
    };
    
    return (
        <SidebarLayout 
            user={auth.user}
            activeModule='Duty Meals'
            sidebarLinks={DutyMealLinks}
            header={<h2 className="text-xl font-semibold leading-tight text-slate-800">Duty Meal Panel</h2>}
        >
            <Head title="My Duty Meals" />

            <div className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">My Duty Meals</h2>
                        <p className="text-slate-500 mt-2 font-medium">Select your meal preferences for your upcoming shifts.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <select
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                            className="text-sm bg-white border-slate-200 rounded-xl shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-semibold text-slate-700 py-2.5 pl-4 pr-10"
                        >
                            <option value="All">All Months</option>
                            {availableMonths.map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                            ))}
                        </select>
                        
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="text-sm bg-white border-slate-200 rounded-xl shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-semibold text-slate-700 py-2.5 pl-4 pr-10"
                        >
                            <option value="Pending">Pending Action</option>
                            <option value="Completed">Completed Groups</option>
                            <option value="All">All Statuses</option>
                        </select>
                    </div>
                </div>

                {activeGroupedMeals.length === 0 ? (
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-16 text-center flex flex-col items-center">
                        <div className={`rounded-2xl p-5 mb-5 ${statusFilter === 'Pending' ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-400'}`}>
                            {statusFilter === 'Pending' ? (
                                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            )}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">
                            {statusFilter === 'Pending' ? "You're all caught up!" : "No meals found"}
                        </h3>
                        <p className="text-slate-500 mt-2 font-medium">
                            {statusFilter === 'Pending' 
                                ? "No pending duty meals require your action right now. Enjoy your day!" 
                                : "No rosters match your current filter settings."}
                        </p>
                    </div>
                ) : (
                    <div className="mb-12">
                        
                        {activeGroupedMeals.length > 1 && (
                            <div className="flex items-center justify-between mb-8 bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100 max-w-sm mx-auto">
                                <button
                                    onClick={() => setCurrentGroupIndex(prev => prev - 1)}
                                    disabled={currentGroupIndex === 0}
                                    className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors ${
                                        currentGroupIndex === 0 
                                        ? 'text-slate-300 bg-transparent cursor-not-allowed' 
                                        : 'text-indigo-600 hover:bg-indigo-50'
                                    }`}
                                >
                                    &larr; Prev
                                </button>
                                
                                <span className="text-sm font-semibold text-slate-500">
                                    Group <span className="text-slate-900 font-black">{currentGroupIndex + 1}</span> of {activeGroupedMeals.length}
                                </span>
                                
                                <button
                                    onClick={() => setCurrentGroupIndex(prev => prev + 1)}
                                    disabled={currentGroupIndex === activeGroupedMeals.length - 1}
                                    className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors ${
                                        currentGroupIndex === activeGroupedMeals.length - 1 
                                        ? 'text-slate-300 bg-transparent cursor-not-allowed' 
                                        : 'text-indigo-600 hover:bg-indigo-50'
                                    }`}
                                >
                                    Next &rarr;
                                </button>
                            </div>
                        )}

                        {(() => {
                            const currentGroup = activeGroupedMeals[currentGroupIndex];
                            if (!currentGroup) return null;
                            
                            const [groupLabel, mealsInGroup] = currentGroup;
                            
                            const pendingMealsInGroup = mealsInGroup.filter(m => !m.is_locked && m.choice === 'none');
                            const totalRequired = pendingMealsInGroup.length;
                            
                            const readyToSubmit = pendingMealsInGroup
                                .filter(m => {
                                    const s = selections[m.participant_id];
                                    if (!s || s.choice === '') return false; 
                                    
                                    const isMakati = (m.branch_name || '').toLowerCase().includes('makati');
                                    if (isMakati && (!s.site || s.site === '')) return false; 
                                    
                                    if (s.choice === 'special' && (!s.custom_request || s.custom_request.trim() === '')) return false;
                                    
                                    return true;
                                })
                                .map(m => selections[m.participant_id]);
                                
                            const currentSelected = readyToSubmit.length;
                            const isFullySelected = totalRequired > 0 && currentSelected === totalRequired;

                            return (
                                <div className="animate-fade-in-up">
                                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-slate-200/80 pb-6">
                                        <div>
                                            <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1 block">Roster Group</span>
                                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{groupLabel}</h3>
                                        </div>
                                        
                                        {totalRequired > 0 && (
                                            <button
                                                onClick={() => handleBulkLockIn(readyToSubmit, groupLabel)}
                                                disabled={isProcessing || !isFullySelected}
                                                className={`inline-flex items-center px-8 py-3.5 border border-transparent rounded-2xl font-black text-[13px] text-white uppercase tracking-widest shadow-sm transition-all duration-200 ${
                                                    (isProcessing || !isFullySelected) 
                                                    ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                                                    : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 focus:ring-4 focus:ring-indigo-500/20'
                                                }`}
                                            >
                                                {isProcessing 
                                                    ? 'Processing...' 
                                                    : isFullySelected 
                                                        ? 'Lock In Choices' 
                                                        : `Complete ${totalRequired - currentSelected} more to lock in`
                                                }
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                                        {mealsInGroup.map((meal) => (
                                            <MealCard 
                                                key={meal.participant_id} 
                                                meal={meal} 
                                                selection={selections[meal.participant_id]}
                                                onSelectionChange={handleSelectionChange}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

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