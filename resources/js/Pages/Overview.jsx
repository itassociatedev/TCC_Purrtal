import Modal from '@/Components/Modal';
import { getDashboardLinks } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { formatAppDate } from '@/Utils/date';
import { Head, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import AnnouncementComments from '@/Components/AnnouncementComments';

export default function Overview({ auth, announcements, contents }) {
    const dashboardLinks = getDashboardLinks();
    const { system } = usePage().props;

    const allAnnouncements = Array.isArray(announcements?.data)
        ? announcements.data
        : Array.isArray(announcements)
            ? announcements
            : [];

    const announcementList = [...allAnnouncements]
        .sort((a, b) => {
            const dateA = new Date(a.created_at).getTime() || 0;
            const dateB = new Date(b.created_at).getTime() || 0;
            return dateB - dateA;
        })
        .slice(0, 6);

    const contentList = contents || [];

    const cardsPerPage = 3;
    const chunkedAnnouncements = [];
    for (let i = 0; i < announcementList.length; i += cardsPerPage) {
        chunkedAnnouncements.push(announcementList.slice(i, i + cardsPerPage));
    }

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

    const carouselRef = useRef(null);
    const [activeSlide, setActiveSlide] = useState(0);
    const [isAutoplayPaused, setIsAutoplayPaused] = useState(false);

    const getCarouselMetrics = () => {
        if (!carouselRef.current) return null;

        const firstPage = carouselRef.current.querySelector('[data-carousel-page="true"]');
        if (!firstPage) return null;

        const pageWidth = firstPage.getBoundingClientRect().width;
        const styles = window.getComputedStyle(carouselRef.current);
        const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;

        return {
            pageWidth,
            gap,
            fullStep: pageWidth + gap,
        };
    };

    const handleScroll = () => {
        const metrics = getCarouselMetrics();
        if (!metrics || !carouselRef.current) return;

        const current = Math.round(carouselRef.current.scrollLeft / metrics.fullStep);
        const safeIndex = Math.max(0, Math.min(current, chunkedAnnouncements.length - 1));

        setActiveSlide(safeIndex);
    };

    const goToSlide = (index) => {
        if (!carouselRef.current) return;

        const metrics = getCarouselMetrics();
        if (!metrics) return;

        const safeIndex = Math.max(0, Math.min(index, chunkedAnnouncements.length - 1));

        carouselRef.current.scrollTo({
            left: safeIndex * metrics.fullStep,
            behavior: 'smooth',
        });

        setActiveSlide(safeIndex);
    };

    const scrollLeft = () => {
        goToSlide(activeSlide === 0 ? chunkedAnnouncements.length - 1 : activeSlide - 1);
    };

    const scrollRight = () => {
        goToSlide(
            activeSlide === chunkedAnnouncements.length - 1 ? 0 : activeSlide + 1
        );
    };

    useEffect(() => {
        if (chunkedAnnouncements.length <= 1 || isAutoplayPaused) return;

        const interval = setInterval(() => {
            setActiveSlide((prev) => {
                const next = prev === chunkedAnnouncements.length - 1 ? 0 : prev + 1;

                if (carouselRef.current) {
                    const metrics = getCarouselMetrics();
                    if (metrics) {
                        carouselRef.current.scrollTo({
                            left: next * metrics.fullStep,
                            behavior: 'smooth',
                        });
                    }
                }

                return next;
            });
        }, 4000);

        return () => clearInterval(interval);
    }, [chunkedAnnouncements.length, isAutoplayPaused]);

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

    const getTwoSentencePreview = (text) => {
        if (!text) return '';

        const cleaned = text.replace(/\s+/g, ' ').trim();
        const matches = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
        const preview = matches.slice(0, 2).join(' ').trim();

        return matches.length > 2 ? `${preview}...` : preview;
    };

    const openAnnouncementModal = (announcement) => {
        setSelectedAnnouncement(announcement);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setTimeout(() => setSelectedAnnouncement(null), 300);
    };

    const isMissionContent = (c) => {
        const title = c?.title?.toLowerCase() || '';
        const slug = c?.slug?.toLowerCase() || '';
        const type = c?.type?.toLowerCase() || '';

        return type === 'mission' || slug === 'mission' || title.includes('mission');
    };

    const isVisionContent = (c) => {
        const title = c?.title?.toLowerCase() || '';
        const slug = c?.slug?.toLowerCase() || '';
        const type = c?.type?.toLowerCase() || '';

        return type === 'vision' || slug === 'vision' || title.includes('vision');
    };

    const mission = contentList.find((c) => isMissionContent(c));
    const vision = contentList.find((c) => isVisionContent(c));

    const otherContents = contentList.filter(
        (c) => !isMissionContent(c) && !isVisionContent(c)
    );

    const storyContents = otherContents.filter((item) => {
        const type = (item?.type || '').toLowerCase();
        const slug = (item?.slug || '').toLowerCase();
        const title = (item?.title || '').toLowerCase();

        return (
            type.includes('story') ||
            slug.includes('story') ||
            title.includes('story') ||
            title.includes('founder')
        );
    });

    const remainingContents = otherContents.filter((item) => !storyContents.includes(item));

    return (
        <SidebarLayout
            activeModule="General"
            sidebarLinks={dashboardLinks}
            headerClassName="mx-auto -mb-1 w-full max-w-[96rem] sm:mb-0 2xl:max-w-[112rem]"
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    <span className="mr-2">🐾</span>
                    Welcome to The Cat Clinic Purrtal, {auth.user.name}!
                </h2>
            }
        >
            <Head title="Dashboard" />

            <style>{`
                .hide-scroll::-webkit-scrollbar { display: none; }
                .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
                .smooth-snap { scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }
                .announcement-card .announcement-badge { background: var(--badge-solid-bg); color: var(--badge-solid-text); border-color: var(--badge-solid-border); backdrop-filter: none; -webkit-backdrop-filter: none; }
                .announcement-card:hover .announcement-badge { background: var(--badge-glass-bg); color: var(--badge-glass-text); border-color: var(--badge-glass-border); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
            `}</style>

            <div className="py-0 sm:py-12">
                <div className="mx-auto w-full max-w-[96rem] space-y-6 sm:px-2 lg:px-4 2xl:max-w-[112rem]">
                    
                    {/* ANNOUNCEMENTS SECTION */}
                    <section>
                        <div className="mb-6 flex items-end justify-between">
                            <h3 className="text-lg font-bold uppercase tracking-wide text-gray-700">
                                Latest Announcements
                            </h3>
                            <span className="text-xs italic text-gray-400 md:hidden">
                                Swipe to see more &rarr;
                            </span>
                        </div>

                        <div className="flex items-center gap-2 md:gap-4">
                            {chunkedAnnouncements.length > 1 && (
                                <button
                                    onClick={scrollLeft}
                                    onMouseEnter={() => setIsAutoplayPaused(true)}
                                    onMouseLeave={() => setIsAutoplayPaused(false)}
                                    className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-black shadow-sm transition-all hover:scale-105 hover:shadow-md focus:outline-none lg:flex"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                    </svg>
                                </button>
                            )}

                            <div
                                ref={carouselRef}
                                onScroll={handleScroll}
                                onMouseEnter={() => setIsAutoplayPaused(true)}
                                onMouseLeave={() => setIsAutoplayPaused(false)}
                                onTouchStart={() => setIsAutoplayPaused(true)}
                                onTouchEnd={() => setIsAutoplayPaused(false)}
                                className="hide-scroll smooth-snap flex w-full flex-1 gap-6 overflow-x-auto overflow-y-visible scroll-smooth bg-transparent px-0 py-1"
                            >
                                {chunkedAnnouncements.length === 0 ? (
                                    <div className="w-full rounded-lg border border-gray-100 bg-white p-6 text-center text-gray-500 shadow-sm">
                                        No announcements have been posted yet.
                                    </div>
                                ) : (
                                    chunkedAnnouncements.map((pageItems, pageIndex) => (
                                        <div
                                            key={pageIndex}
                                            data-carousel-page="true"
                                            className="w-full shrink-0 snap-start border-0 bg-transparent shadow-none"
                                        >
                                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                                                {pageItems.map((item) => {
                                                    const priorityName = item.priority_level?.name || 'Notice';
                                                    const badgeColor = item.priority_level?.color || '#4F46E5';
                                                    const solidBadgeStyle = getSolidBadgeStyle(badgeColor);
                                                    const glassBadgeStyle = getGlassStyle(badgeColor);

                                                    return (
                                                        <div
                                                            key={item.id}
                                                            onClick={() => openAnnouncementModal(item)}
                                                            className="announcement-card relative flex h-[500px] cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md transition-all hover:-translate-y-1 hover:shadow-lg"
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
                                                                <span className="announcement-badge rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm transition-all duration-200">
                                                                    {priorityName}
                                                                </span>
                                                            </div>

                                                            {item.attachment_path && (
                                                                <div className="absolute left-3 top-3 z-20">
                                                                    <span className="flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold text-gray-700 shadow-sm backdrop-blur-md">
                                                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
                                                                        </svg>
                                                                        Has File
                                                                    </span>
                                                                </div>
                                                            )}

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
                                                                    <div className="flex h-full items-center justify-center text-sm font-medium italic text-gray-400">
                                                                        No Attachment
                                                                    </div>
                                                                )}
                                                                <div className="absolute inset-0 h-14 bg-gradient-to-b from-black/30 to-transparent z-10 pointer-events-none"></div>
                                                            </div>
                                                
                                                            {/* Main text container */}
                                                            <div className="flex min-h-0 flex-1 flex-col pt-5 px-5 pb-0">
                                                                
                                                                {/* Group the Announcement Text */}
                                                                <div className="flex flex-col mb-4">
                                                                    <h4 className="mb-1 pr-12 break-words text-lg font-bold leading-tight text-gray-900 line-clamp-2">
                                                                        {item.title}
                                                                    </h4>
                                                                    <p className="mb-3 text-[11px] font-medium uppercase tracking-tighter text-gray-500 shrink-0">
                                                                        By {item.author} • {formatAppDate(item.created_at, system?.timezone)}
                                                                    </p>
                                                                    
                                                                    {/* 🔥 FIXED: Removed 'overflow-hidden' and 'line-clamp-2' to show the WHOLE text! */}
                                                                    <p className="whitespace-pre-wrap break-words border-l-2 border-gray-100 pl-3 text-sm leading-relaxed text-gray-600 italic">
                                                                        {getTwoSentencePreview(item.content)}
                                                                    </p>
                                                                </div>

                                                                {/* 🔥 FIXED: Removed the empty <div className="mt-auto"></div> spacer that was causing the huge gap */}

                                                                {/* 🔥 COMMENT PREVIEW BOX 🔥 */}
                                                                {/* mt-auto pushes this to the bottom safely without forcing an empty gap if the text is long */}
                                                                <div className="mt-auto shrink-0 border-t border-gray-200 bg-gray-50 -mx-5 px-5 pt-3 pb-4 rounded-b-lg">
                                                                    {/* 1. Show "View all" if there are multiple comments */}
                                                                    {item.comments?.length > 1 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation(); 
                                                                                openAnnouncementModal(item);
                                                                            }}
                                                                            className="text-[11px] font-semibold text-gray-500 hover:text-indigo-600 mb-1.5 transition-colors w-full text-left"
                                                                        >
                                                                            View all {item.comments.length} comments...
                                                                        </button>
                                                                    )}

                                                                    {/* 2. Show only the LATEST comment */}
                                                                    {item.comments?.length > 0 ? (
                                                                        item.comments.slice(-1).map((comment) => (
                                                                            <div 
                                                                                key={comment.id} 
                                                                                className="flex flex-col cursor-pointer transition-colors group w-full" 
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation(); 
                                                                                    openAnnouncementModal(item);
                                                                                }}
                                                                            >
                                                                                <div className="font-bold text-[11px] text-gray-800 group-hover:text-indigo-600 transition-colors">
                                                                                    {comment.user?.name || 'Unknown User'}
                                                                                </div>
                                                                                <div className="text-xs text-gray-600 w-full line-clamp-2 break-words mt-0.5 leading-relaxed">
                                                                                    {comment.content}
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation(); 
                                                                                openAnnouncementModal(item);
                                                                            }}
                                                                            className="text-xs text-gray-500 hover:text-indigo-600 transition-colors w-full text-left py-1"
                                                                        >
                                                                            Leave a comment...
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {/* --------------------------------------------- */}

                                                            </div>

                                                        </div>
                                                    );
                                                })}
                                                {pageItems.length < cardsPerPage &&
                                                    Array.from({ length: cardsPerPage - pageItems.length }).map((_, idx) => (
                                                        <div key={`placeholder-${pageIndex}-${idx}`} className="hidden h-[430px] rounded-lg border border-transparent bg-transparent lg:block" aria-hidden="true" />
                                                    ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {chunkedAnnouncements.length > 1 && (
                                <button
                                    onClick={scrollRight}
                                    onMouseEnter={() => setIsAutoplayPaused(true)}
                                    onMouseLeave={() => setIsAutoplayPaused(false)}
                                    className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-black shadow-sm transition-all hover:scale-105 hover:shadow-md focus:outline-none lg:flex"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {chunkedAnnouncements.length > 1 && (
                            <div
                                className="mb-2 mt-4 flex items-center justify-center gap-2"
                                onMouseEnter={() => setIsAutoplayPaused(true)}
                                onMouseLeave={() => setIsAutoplayPaused(false)}
                            >
                                {chunkedAnnouncements.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => goToSlide(idx)}
                                        className={`h-2.5 rounded-full transition-all duration-300 ${activeSlide === idx ? 'w-8 bg-indigo-600 shadow-sm' : 'w-2.5 bg-gray-300 hover:bg-gray-400'}`}
                                        aria-label={`Go to page ${idx + 1}`}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    {/* ABOUT US SECTION */}
                    <section>
                        <h3 className="mb-6 text-lg font-bold uppercase tracking-wide text-gray-700">
                            About Us
                        </h3>

                        {/* STORY CONTENTS */}
                        {storyContents.length > 0 && (
                            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                                {storyContents.map((item) => (
                                    <div key={item.id} className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
                                        
                                        {/* ✅ FIXED: Added Zoom Styles */}
                                        {item.image_path && (
                                            <div className="relative aspect-[16/9] w-full bg-gray-50 flex items-center justify-center border-b border-gray-100 overflow-hidden">
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
                                            </div>
                                        )}

                                        <div className="flex flex-1 flex-col p-8">
                                            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">
                                                {item.type || item.slug || 'Story'}
                                            </p>
                                            <h4 className="mb-4 text-2xl font-extrabold text-gray-900">
                                                {item.title}
                                            </h4>
                                            <div className="prose max-w-none whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-600">
                                                {item.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* MISSION AND VISION CONTENTS */}
                        {(mission || vision) && (
                            <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
                                {mission && (
                                    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
                                        
                                        {/* ✅ FIXED: Added Zoom Styles */}
                                        {mission.image_path && (
                                            <div className="relative aspect-[16/9] w-full bg-gray-50 flex items-center justify-center border-b border-gray-100 overflow-hidden">
                                                <img
                                                    src={`/storage/${mission.image_path}`}
                                                    alt="Mission"
                                                    className="absolute left-1/2 top-1/2"
                                                    style={{
                                                        transform: `translate(calc(-50% + ${mission.image_offset_x ?? 0}px), calc(-50% + ${mission.image_offset_y ?? 0}px)) scale(${mission.image_zoom ?? 1})`,
                                                        transformOrigin: 'center center',
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'contain',
                                                    }}
                                                />
                                            </div>
                                        )}
                                        <div className="flex flex-1 flex-col p-8">
                                            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">
                                                {mission.type}
                                            </p>
                                            <h4 className="mb-4 text-2xl font-extrabold text-gray-900">
                                                {mission.title}
                                            </h4>
                                            <div className="prose max-w-none whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                                                {mission.content}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {vision && (
                                    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
                                        
                                        {/* ✅ FIXED: Added Zoom Styles */}
                                        {vision.image_path && (
                                            <div className="relative aspect-[16/9] w-full bg-gray-50 flex items-center justify-center border-b border-gray-100 overflow-hidden">
                                                <img
                                                    src={`/storage/${vision.image_path}`}
                                                    alt="Vision"
                                                    className="absolute left-1/2 top-1/2"
                                                    style={{
                                                        transform: `translate(calc(-50% + ${vision.image_offset_x ?? 0}px), calc(-50% + ${vision.image_offset_y ?? 0}px)) scale(${vision.image_zoom ?? 1})`,
                                                        transformOrigin: 'center center',
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'contain',
                                                    }}
                                                />
                                            </div>
                                        )}
                                        <div className="flex flex-1 flex-col p-8">
                                            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">
                                                {vision.type}
                                            </p>
                                            <h4 className="mb-4 text-2xl font-extrabold text-gray-900">
                                                {vision.title}
                                            </h4>
                                            <div className="prose max-w-none whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                                                {vision.content}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* REMAINING CONTENTS */}
                        {remainingContents.length > 0 && (
                            <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                                {remainingContents.map((item) => (
                                    <div key={item.id} className="flex flex-col overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
                                        
                                        {/* ✅ FIXED: Added Zoom Styles */}
                                        {item.image_path && (
                                            <div className="relative aspect-[16/9] w-full bg-gray-50 flex items-center justify-center border-b border-gray-100 overflow-hidden">
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
                                            </div>
                                        )}

                                        <div className="p-8">
                                            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">
                                                {item.type || item.slug || 'Company Content'}
                                            </p>
                                            <h4 className="mb-4 text-2xl font-extrabold text-gray-900">
                                                {item.title}
                                            </h4>
                                            <div className="prose max-w-none whitespace-pre-wrap break-words break-all text-sm leading-relaxed text-gray-600">
                                                {item.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!mission && !vision && otherContents.length === 0 && (
                            <div className="rounded-lg border border-gray-100 bg-white p-6 text-center text-gray-500 shadow-sm">
                                No company content has been posted yet.
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {/* ✅ FIXED MODAL STRUCTURE */}
            <Modal show={isModalOpen} onClose={closeModal} maxWidth="2xl">
                {selectedAnnouncement && (
                    <div className="flex flex-col bg-white overflow-hidden max-h-[85vh]">
                        
                        {/* ✅ IMAGE SECTION (Fixed at top, Shrinks to 0 so it doesn't flex weirdly) */}
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
                                <span 
                                    className="rounded-md border px-3 py-1 text-xs font-black uppercase tracking-wider shrink-0" 
                                    style={getSolidBadgeStyle(selectedAnnouncement.priority_level?.color)}
                                >
                                    {selectedAnnouncement.priority_level?.name || 'Notice'}
                                </span>
                            </div>
                            <hr className="my-6 border-gray-100" />
                            
                            {/* Text Content */}
                            <div className="prose max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                                {selectedAnnouncement.content}
                                <AnnouncementComments 
                                announcement={
                                    allAnnouncements.find(a => a.id === selectedAnnouncement.id) || selectedAnnouncement
                                } 
                            />
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