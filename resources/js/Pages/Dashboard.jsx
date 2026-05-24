import AnnouncementComments from '@/Components/AnnouncementComments';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { getDashboardLinks } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { formatAppDate } from '@/Utils/date';
import { Head, usePage } from '@inertiajs/react';
import { useMemo, useRef, useState } from 'react';

export default function Dashboard({ auth, announcements, priorities = [] }) {
    const dashboardLinks = getDashboardLinks();
    const { system } = usePage().props;
    
    // 1. Safely grab the list
    const allAnnouncements = announcements.data || announcements || [];

    // --- FILTER STATES ---
    const [titleSearch, setTitleSearch] = useState('');
    const [selectedPriorityId, setSelectedPriorityId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // --- PRIORITY OPTIONS (supports passed priorities OR derives from announcements) ---
    const priorityOptions = useMemo(() => {
        if (Array.isArray(priorities) && priorities.length > 0) {
            return priorities;
        }

        const map = new Map();

        allAnnouncements.forEach((item) => {
            if (item?.priority_level_id) {
                map.set(item.priority_level_id, {
                    id: item.priority_level_id,
                    name: item.priority_level?.name || `Priority ${item.priority_level_id}`,
                    color: item.priority_level?.color || '#4F46E5',
                });
            }
        });

        return Array.from(map.values()).sort((a, b) => Number(a.id) - Number(b.id));
    }, [priorities, allAnnouncements]);

    const userRole = String(auth.user?.role?.name || '').toLowerCase();
    const isGlobalViewer = userRole === 'admin' || userRole.includes('director');
    const userBranchId = auth.user?.branch_id;

    // --- FILTER LOGIC ---
    const announcementList = useMemo(() => {
        const source = Array.isArray(allAnnouncements) ? allAnnouncements : [];

        return source.filter((item) => {
            // 🟢 NO BRANCH FILTER NEEDED! The backend already secured the data.
            const matchesTitle =
                !titleSearch ||
                (item.title || '')
                    .toLowerCase()
                    .includes(titleSearch.toLowerCase().trim());

            const matchesPriority =
                !selectedPriorityId ||
                String(item.priority_level_id) === String(selectedPriorityId);

            let matchesDate = true;
            // ... (keep your existing date logic here exactly as is) ...

            return matchesTitle && matchesPriority && matchesDate;
        });
    }, [allAnnouncements, titleSearch, selectedPriorityId, startDate, endDate, isGlobalViewer, userBranchId]);

    // 2. Chunk announcements into groups of 6 (3 top, 3 bottom) per slide
    const chunkedAnnouncements = [];
    for (let i = 0; i < announcementList.length; i += 6) {
        chunkedAnnouncements.push(announcementList.slice(i, i + 6));
    }

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

    // --- CAROUSEL AND PROGRESS BAR STATE ---
    const carouselRef = useRef(null);
    const [activeSlide, setActiveSlide] = useState(0);

    // Updates the active dot/progress bar when the user scrolls or swipes
    const handleScroll = (e) => {
        if (!carouselRef.current) return;
        const scrollPos = e.target.scrollLeft;
        const slideWidth = e.target.offsetWidth;
        const current = Math.round(scrollPos / slideWidth);
        if (current !== activeSlide) {
            setActiveSlide(current);
        }
    };

    const goToSlide = (index) => {
        if (carouselRef.current) {
            carouselRef.current.scrollTo({ left: index * carouselRef.current.offsetWidth, behavior: 'smooth' });
        }
    };

    // Looping Logic: Go Left
    const scrollLeft = () => {
        if (activeSlide === 0) {
            goToSlide(chunkedAnnouncements.length - 1);
        } else {
            goToSlide(activeSlide - 1);
        }
    };

    // Looping Logic: Go Right
    const scrollRight = () => {
        if (activeSlide === chunkedAnnouncements.length - 1) {
            goToSlide(0);
        } else {
            goToSlide(activeSlide + 1);
        }
    };

    const normalizeHexColor = (hexColor) => {
        const fallback = '#4F46E5';
        let hex = (hexColor || fallback).replace('#', '');

        if (hex.length === 3) {
            hex = hex.split('').map((c) => c + c).join('');
        }

        if (hex.length !== 6) {
            hex = fallback.replace('#', '');
        }

        return `#${hex}`;
    };

    const getPastelStyle = (hexColor) => {
        const normalized = normalizeHexColor(hexColor);
        const hex = normalized.replace('#', '');
        
        const r = parseInt(hex.substring(0, 2), 16) || 79;
        const g = parseInt(hex.substring(2, 4), 16) || 70;
        const b = parseInt(hex.substring(4, 6), 16) || 229;

        return {
            backgroundColor: `rgba(${r}, ${g}, ${b}, 0.25)`, 
            color: normalized,                               
            borderColor: normalized, 
        };
    };

    const getGlassStyle = (hexColor) => {
        const normalized = normalizeHexColor(hexColor);
        const hex = normalized.replace('#', '');

        const r = parseInt(hex.substring(0, 2), 16) || 79;
        const g = parseInt(hex.substring(2, 4), 16) || 70;
        const b = parseInt(hex.substring(4, 6), 16) || 229;

        return {
            backgroundColor: `rgba(${r}, ${g}, ${b}, 0.18)`,
            color: normalized,
            borderColor: `rgba(${r}, ${g}, ${b}, 0.28)`,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
        };
    };

    const getSolidBadgeStyle = (hexColor) => {
        const normalized = normalizeHexColor(hexColor);

        return {
            backgroundColor: normalized,
            color: '#ffffff',
            borderColor: normalized,
        };
    };

    const openAnnouncementModal = (announcement) => {
        setSelectedAnnouncement(announcement);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setTimeout(() => setSelectedAnnouncement(null), 300);
    };

    return (
        <SidebarLayout
            activeModule="General"
            sidebarLinks={dashboardLinks}
            headerClassName="mx-auto mb-1 w-full max-w-[96rem] sm:mb-6 2xl:max-w-[112rem]"
            header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Announcements</h2>}
        >
            <Head title="Announcements" />

            <style>{`
                .hide-scroll::-webkit-scrollbar { display: none; }
                .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }

                .announcement-card .announcement-badge {
                    background: var(--badge-solid-bg);
                    color: var(--badge-solid-text);
                    border-color: var(--badge-solid-border);
                    backdrop-filter: none;
                    -webkit-backdrop-filter: none;
                }

                .announcement-card:hover .announcement-badge {
                    background: var(--badge-glass-bg);
                    color: var(--badge-glass-text);
                    border-color: var(--badge-glass-border);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                }
            `}</style>

            <div className="py-0 sm:py-12">
                <div className="mx-auto w-full max-w-[96rem] sm:px-2 lg:px-4 2xl:max-w-[112rem]">
                    
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-700 uppercase tracking-wide">All Announcement</h3>
                        <span className="text-xs text-gray-400 italic md:hidden">Swipe to see more &rarr;</span>
                    </div>

                    {/* Filters */}
                    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div>
                                <InputLabel htmlFor="filter_title" value="Search Title" />
                                <TextInput
                                    id="filter_title"
                                    className="mt-1 block w-full"
                                    value={titleSearch}
                                    onChange={(e) => setTitleSearch(e.target.value)}
                                    placeholder="Search by title..."
                                />
                            </div>

                            <div>
                                <InputLabel htmlFor="filter_priority" value="Category" />
                                <select
                                    id="filter_priority"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    value={selectedPriorityId}
                                    onChange={(e) => setSelectedPriorityId(e.target.value)}
                                >
                                    <option value="">All Categories</option>
                                    {priorityOptions.map((priority) => (
                                        <option key={priority.id} value={priority.id}>
                                            {priority.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <InputLabel htmlFor="filter_start_date" value="Start Date" />
                                <input
                                    id="filter_start_date"
                                    type="date"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>

                            <div>
                                <InputLabel htmlFor="filter_end_date" value="End Date" />
                                <input
                                    id="filter_end_date"
                                    type="date"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <SecondaryButton
                                onClick={() => {
                                    setTitleSearch('');
                                    setSelectedPriorityId('');
                                    setStartDate('');
                                    setEndDate('');
                                }}
                            >
                                Reset Filters
                            </SecondaryButton>
                        </div>
                    </div>

                    {/* Results Count */}
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-600">
                            Showing {announcementList.length} announcement{announcementList.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        {chunkedAnnouncements.length > 1 && (
                            <button 
                                onClick={scrollLeft} 
                                className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-black shadow-sm transition-all focus:outline-none hover:scale-105 hover:shadow-md lg:flex"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                </svg>
                            </button>
                        )}

                        <div 
                            ref={carouselRef} 
                            onScroll={handleScroll}
                            className="flex-1 flex overflow-x-auto snap-x snap-mandatory hide-scroll scroll-smooth pb-4 pt-2"
                        >
                            {chunkedAnnouncements.length === 0 ? (
                                <div className="w-full rounded-lg border border-gray-100 bg-white p-6 text-center text-gray-500 shadow-sm">
                                    No announcements found.
                                </div>
                            ) : (
                                chunkedAnnouncements.map((pageOfSix, pageIndex) => (
                                    <div key={pageIndex} className="w-full shrink-0 snap-center px-1">
                                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                                            {pageOfSix.map((item) => {
                                                const priorityName = item.priority_level?.name || 'Notice';
                                                const badgeColor = item.priority_level?.color || '#4F46E5';
                                                const solidBadgeStyle = getSolidBadgeStyle(badgeColor);
                                                const glassBadgeStyle = getGlassStyle(badgeColor);

                                                return (
                                                    <div 
                                                        key={item.id} 
                                                        onClick={() => openAnnouncementModal(item)} 
                                                        className="announcement-card relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer"
                                                        style={{
                                                            '--badge-solid-bg': solidBadgeStyle.backgroundColor,
                                                            '--badge-solid-text': solidBadgeStyle.color,
                                                            '--badge-solid-border': solidBadgeStyle.borderColor,
                                                            '--badge-glass-bg': glassBadgeStyle.backgroundColor,
                                                            '--badge-glass-text': glassBadgeStyle.color,
                                                            '--badge-glass-border': glassBadgeStyle.borderColor,
                                                        }}
                                                    >
                                                        <div className="absolute right-3 top-3 z-20">
                                                            <span 
                                                                className="announcement-badge rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm transition-all duration-200"
                                                            >
                                                                {priorityName}
                                                            </span>
                                                        </div>

                                                        {item.attachment_path && (
                                                            <div className="absolute left-3 top-3 z-20">
                                                                <span className="flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold text-gray-70 shadow-sm backdrop-blur-md">
                                                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
                                                                    </svg>
                                                                    Has File
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* ✅ FIXED: Changed to aspect-[16/9] to match the cropper perfectly */}
                                                        <div className="aspect-[16/9] w-full shrink-0 bg-gray-100 relative overflow-hidden flex items-center justify-center">
                                                            {item.image_path ? (
                                                                <img 
                                                                    src={`/storage/${item.image_path}`} 
                                                                    alt={item.title} 
                                                                    className="absolute left-1/2 top-1/2" 
                                                                    style={{
                                                                        transform: `translate(calc(-50% + ${item.image_offset_x ?? 0}px), calc(-50% + ${item.image_offset_y ?? 0}px)) scale(${item.image_zoom ?? 1})`,
                                                                        transformOrigin: 'center center',
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        objectFit: 'contain',
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="flex h-full items-center justify-center text-sm text-gray-400 font-medium italic">No Attachment</div>
                                                            )}
                                                            <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent h-14 z-10 pointer-events-none"></div>
                                                        </div>
                                                        
                                                        <div className="flex flex-1 flex-col p-5">
                                                            <h4 className="mb-1 pr-12 text-lg font-bold text-gray-900 leading-tight">{item.title}</h4>
                                                            <p className="mb-3 text-[11px] font-medium text-gray-500 uppercase tracking-tighter">
                                                                By {item.author} • {formatAppDate(item.created_at, system?.timezone)}
                                                            </p>
                                                            
                                                            <p className="mb-4 flex-1 whitespace-pre-wrap text-sm text-gray-600 leading-relaxed italic border-l-2 border-gray-100 pl-3 line-clamp-3">
                                                                {item.content}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {chunkedAnnouncements.length > 1 && (
                            <button 
                                onClick={scrollRight} 
                                className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-black shadow-sm transition-all focus:outline-none hover:scale-105 hover:shadow-md lg:flex"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {chunkedAnnouncements.length > 1 && (
                        <div className="flex justify-center items-center mt-4 gap-2">
                            {chunkedAnnouncements.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => goToSlide(idx)}
                                    className={`h-2.5 rounded-full transition-all duration-300 ${
                                        activeSlide === idx 
                                            ? 'w-8 bg-indigo-600 shadow-sm' 
                                            : 'w-2.5 bg-gray-300 hover:bg-gray-400'
                                    }`}
                                    aria-label={`Go to page ${idx + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <Modal show={isModalOpen} onClose={closeModal} maxWidth="2xl">
                {selectedAnnouncement && (
                    <div className="flex flex-col bg-white overflow-hidden max-h-[85vh]">
                        
                        {/* ✅ IMAGE SECTION (Fixed at top) */}
                        {selectedAnnouncement.image_path && (
                            <div className="relative w-full h-64 sm:h-80 shrink-0 bg-gray-50 border-b border-gray-200 overflow-hidden flex items-center justify-center">
                                <img 
                                    src={`/storage/${selectedAnnouncement.image_path}`} 
                                    alt={selectedAnnouncement.title} 
                                    className="absolute left-1/2 top-1/2" 
                                    style={{
                                        transform: `translate(calc(-50% + ${selectedAnnouncement.image_offset_x ?? 0}px), calc(-50% + ${selectedAnnouncement.image_offset_y ?? 0}px)) scale(${selectedAnnouncement.image_zoom ?? 1})`,
                                        transformOrigin: 'center center',
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain',
                                    }}
                                />
                            </div>
                        )}
                        
                        {/* ✅ SCROLLABLE CONTENT SECTION (Takes up remaining space) */}
                        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedAnnouncement.title}</h2>
                                    <p className="text-sm font-medium text-gray-500">
                                        Posted by {selectedAnnouncement.author} on {formatAppDate(selectedAnnouncement.created_at, system?.timezone)}
                                    </p>
                                </div>
                                <span className="rounded-md border px-3 py-1 text-xs font-black uppercase tracking-wider shrink-0" style={getPastelStyle(selectedAnnouncement.priority_level?.color)}>
                                    {selectedAnnouncement.priority_level?.name || 'Notice'}
                                </span>
                            </div>
                            <hr className="my-6 border-gray-100" />
                            
                            {/* Text Content */}
                            <div className="prose max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                                {selectedAnnouncement.content}
                            </div>

                            {/* Attachment */}
                            {selectedAnnouncement.attachment_path && (
                                <div className="mt-8 border-t border-gray-100 pt-6">
                                    <h4 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Attached File</h4>
                                    <a 
                                        href={`/storage/${selectedAnnouncement.attachment_path}`} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-4 py-3 rounded-lg hover:bg-indigo-100 hover:text-indigo-800 transition-colors shadow-sm w-full sm:w-auto"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                                        </svg>
                                        Download / View Document
                                    </a>
                                </div>
                            )}

                            <div className="mt-8 border-t border-gray-200 pt-4">
                                <AnnouncementComments announcement={selectedAnnouncement} />
                            </div>
                            
                        </div>

                        {/* ✅ SOLID FIXED FOOTER (Never scrolls, text cuts off cleanly above it) */}
                        <div className="bg-gray-50 px-6 py-4 sm:px-8 border-t border-gray-200 flex justify-end shrink-0">
                            <button 
                                onClick={closeModal} 
                                className="rounded-md bg-white px-6 py-2.5 text-sm font-bold text-gray-700 border border-gray-300 hover:bg-gray-100 transition-colors shadow-sm"
                            >
                                Close
                            </button>
                        </div>

                    </div>  
                )}
            </Modal>
            
        </SidebarLayout>
    );
}