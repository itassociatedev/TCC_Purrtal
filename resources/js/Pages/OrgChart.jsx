import MemberAvatar from '@/Components/MemberAvatar';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { getDashboardLinks } from '@/Config/navigation';
import { Head } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

/*
|--------------------------------------------------------------------------
| UI HELPERS
|--------------------------------------------------------------------------
*/

function scrollByAmount(ref, amount) {
    if (!ref.current) return;
    ref.current.scrollBy({ left: amount, behavior: 'smooth' });
}

function getTouchHandlers(ref) {
    let startX = 0;
    let scrollLeft = 0;
    let isDragging = false;

    return {
        onTouchStart: (e) => {
            if (!ref.current) return;
            isDragging = true;
            startX = e.touches[0].pageX - ref.current.offsetLeft;
            scrollLeft = ref.current.scrollLeft;
        },
        onTouchMove: (e) => {
            if (!isDragging || !ref.current) return;
            const x = e.touches[0].pageX - ref.current.offsetLeft;
            const walk = (x - startX) * 1.1;
            ref.current.scrollLeft = scrollLeft - walk;
        },
        onTouchEnd: () => {
            isDragging = false;
        },
    };
}

/*
|--------------------------------------------------------------------------
| CARD COMPONENTS
|--------------------------------------------------------------------------
*/

function MemberCard({ member }) {
    return (
        <div className="group relative flex w-full flex-col items-center rounded-3xl border border-gray-200 bg-white p-5 text-center shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md min-h-[235px]">
            <MemberAvatar member={member} className="mb-4 h-24 w-24" />

            <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
                <h4 className="line-clamp-2 text-xl font-semibold leading-7 text-gray-900">
                    {member?.name || 'No Name'}
                </h4>

                <div className="mt-2 inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-indigo-700 transition-colors group-hover:bg-indigo-100">
                    {member?.position}
                </div>
            </div>
        </div>
    );
}

function SideCarousel({ title, children }) {
    const scrollRef = useRef(null);
    const touchHandlers = getTouchHandlers(scrollRef);

    return (
        <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5">
            <h5 className="mb-4 text-base font-semibold text-gray-800">{title}</h5>

            <div className="relative">
                <button
                    type="button"
                    onClick={() => scrollByAmount(scrollRef, -320)}
                    className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-gray-300 bg-white p-2 shadow-sm lg:flex"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                </button>

                <div
                    ref={scrollRef}
                    className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto px-0 lg:px-10 pb-4"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    {...touchHandlers}
                >
                    {children}
                </div>

                <button
                    type="button"
                    onClick={() => scrollByAmount(scrollRef, 320)}
                    className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-gray-300 bg-white p-2 shadow-sm lg:flex"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| ORG CHART VIEWER
|--------------------------------------------------------------------------
*/
function OrgChartMapViewer({ svgPath }) {
    const containerRef = useRef(null);
    const imageRef = useRef(null);

    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [isImageReady, setIsImageReady] = useState(false);
    
    const [showCtrlMessage, setShowCtrlMessage] = useState(false);
    const [showTouchMessage, setShowTouchMessage] = useState(false);
    const ctrlMessageTimeout = useRef(null);
    const touchMessageTimeout = useRef(null);

    const fitViewRef = useRef({ scale: 1, x: 0, y: 0 });
    const dragRef = useRef({ isDragging: false, lastX: 0, lastY: 0 });
    const touchRef = useRef({ lastX: 0, lastY: 0, lastDistance: 0 });

    const MIN_SCALE = 0.2;
    const MAX_SCALE = 4;
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    const applyFitToScreen = () => {
        const container = containerRef.current;
        if (!container || !imageSize.width || !imageSize.height) return;

        const availableWidth = Math.max(container.clientWidth - 16, 1);
        const availableHeight = Math.max(container.clientHeight - 16, 1);
        const widthScale = availableWidth / imageSize.width;
        const heightScale = availableHeight / imageSize.height;
        const fitScale = Math.min(widthScale, heightScale) * 0.98;

        const x = Math.max((container.clientWidth - imageSize.width * fitScale) / 2, 0);
        const y = Math.max((container.clientHeight - imageSize.height * fitScale) / 2, 0);

        fitViewRef.current = { scale: fitScale, x, y };
        setScale(fitScale);
        setPosition({ x, y });
    };

    const resetView = () => {
        const { scale: fitScale, x, y } = fitViewRef.current;
        setScale(fitScale);
        setPosition({ x, y });
    };

    const zoomAtPoint = (clientX, clientY, deltaScale) => {
        const container = containerRef.current;
        if (!container || !isImageReady) return;
        const rect = container.getBoundingClientRect();
        
        setScale(prevScale => {
            const nextScale = clamp(prevScale * deltaScale, MIN_SCALE, MAX_SCALE);
            if (nextScale === prevScale) return prevScale;

            setPosition(prevPos => {
                const offsetX = clientX - rect.left;
                const offsetY = clientY - rect.top;
                const worldX = (offsetX - prevPos.x) / prevScale;
                const worldY = (offsetY - prevPos.y) / prevScale;
                return { x: offsetX - worldX * nextScale, y: offsetY - worldY * nextScale };
            });
            return nextScale;
        });
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleNativeEvents = (e) => {
            if (e.type === 'wheel') {
                if (e.ctrlKey || e.metaKey) e.preventDefault();
            } else if (e.type === 'touchmove') {
                if (e.touches.length >= 2) e.preventDefault();
            }
        };

        container.addEventListener('wheel', handleNativeEvents, { passive: false });
        container.addEventListener('touchmove', handleNativeEvents, { passive: false });

        return () => {
            container.removeEventListener('wheel', handleNativeEvents);
            container.removeEventListener('touchmove', handleNativeEvents);
        };
    }, []);

    const handleWheel = (e) => {
        if (e.ctrlKey || e.metaKey) {
            const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
            zoomAtPoint(e.clientX, e.clientY, zoomFactor);
            setShowCtrlMessage(false);
        } else {
            setShowCtrlMessage(true);
            if (ctrlMessageTimeout.current) clearTimeout(ctrlMessageTimeout.current);
            ctrlMessageTimeout.current = setTimeout(() => setShowCtrlMessage(false), 2000);
        }
    };

    const handleMouseDown = (e) => {
        if (!isImageReady) return;
        e.preventDefault();
        setIsDragging(true);
        dragRef.current.isDragging = true;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
    };

    const handleMouseMove = (e) => {
        if (!dragRef.current.isDragging) return;
        const dx = e.clientX - dragRef.current.lastX;
        const dy = e.clientY - dragRef.current.lastY;
        setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
    };

    const handleMouseUp = () => { setIsDragging(false); dragRef.current.isDragging = false; };
    const handleMouseLeave = () => { setIsDragging(false); dragRef.current.isDragging = false; };

    const handleTouchStart = (e) => {
        if (!isImageReady) return;
        if (e.touches.length === 2) {
            touchRef.current.lastX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            touchRef.current.lastY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            touchRef.current.lastDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            setShowTouchMessage(false);
        } else if (e.touches.length === 1) {
            setShowTouchMessage(true);
            if (touchMessageTimeout.current) clearTimeout(touchMessageTimeout.current);
            touchMessageTimeout.current = setTimeout(() => setShowTouchMessage(false), 2000);
        }
    };

    const handleTouchMove = (e) => {
        if (!isImageReady) return;
        if (e.touches.length === 2) {
            const currentX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const currentY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const currentDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );

            const dx = currentX - touchRef.current.lastX;
            const dy = currentY - touchRef.current.lastY;
            if (dx !== 0 || dy !== 0) {
                setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            }

            if (touchRef.current.lastDistance > 0) {
                const deltaScale = currentDistance / touchRef.current.lastDistance;
                if (Math.abs(deltaScale - 1) > 0.01) {
                    zoomAtPoint(currentX, currentY, deltaScale);
                }
            }

            touchRef.current.lastX = currentX;
            touchRef.current.lastY = currentY;
            touchRef.current.lastDistance = currentDistance;
        }
    };

    const handleTouchEnd = (e) => {
        if (e.touches.length < 2) touchRef.current.lastDistance = 0;
    };

    const zoomIn = () => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.15);
    };

    const zoomOut = () => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.87);
    };

    useEffect(() => {
        const handleWindowMouseUp = () => {
            setIsDragging(false);
            dragRef.current.isDragging = false;
        };
        window.addEventListener('mouseup', handleWindowMouseUp);
        return () => window.removeEventListener('mouseup', handleWindowMouseUp);
    }, []);

    useEffect(() => {
        if (!isImageReady) return;
        applyFitToScreen();
        const container = containerRef.current;
        if (!container || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => applyFitToScreen());
        observer.observe(container);
        return () => observer.disconnect();
    }, [isImageReady, imageSize.width, imageSize.height]);

    const handleImageLoad = () => {
        const img = imageRef.current;
        if (!img) return;
        setImageSize({
            width: img.naturalWidth || img.width || 0,
            height: img.naturalHeight || img.height || 0,
        });
        setIsImageReady(true);
    };

    return (
        <div className="mb-12 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-2xl font-bold text-gray-900">Organizational Chart</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Hold <kbd className="rounded border border-gray-300 bg-gray-100 px-1 font-sans text-xs font-semibold text-gray-600 shadow-sm">Ctrl</kbd> to zoom on desktop, or pinch with two fingers on mobile.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button type="button" onClick={zoomOut} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">−</button>
                    <button type="button" onClick={zoomIn} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">+</button>
                    <button type="button" onClick={resetView} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">Reset</button>
                </div>
            </div>

            <div className="relative">
                {(showCtrlMessage || showTouchMessage) && (
                    <div className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 transform rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white shadow-md transition-opacity duration-300">
                        {showCtrlMessage ? 'Use Ctrl + Scroll to zoom' : 'Use two fingers to pan or zoom'}
                    </div>
                )}

                <div
                    ref={containerRef}
                    className={`relative h-[420px] overflow-hidden bg-gray-50 md:h-[560px] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onWheel={handleWheel}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                >
                    {svgPath ? (
                        <div className="absolute left-0 top-0 will-change-transform" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
                            <img ref={imageRef} src={svgPath} alt="Organizational Chart" draggable={false} onLoad={handleImageLoad} className="block max-w-none select-none" />
                        </div>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <p className="text-gray-500 font-medium">No organizational chart has been uploaded yet.</p>
                        </div>
                    )}
                    <div className="pointer-events-none absolute bottom-4 right-4 rounded-xl bg-white/90 px-3 py-2 text-xs font-medium text-gray-600 shadow-sm border border-gray-200">
                        Zoom: {Math.round(scale * 100)}%
                    </div>
                </div>
            </div>
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| MAIN COMPONENT
|--------------------------------------------------------------------------
*/

export default function OrgChart({ auth, members, orgChartSvg = null, structure }) {
    const dashboardLinks = getDashboardLinks();
    const memberList = members || [];
    
    // UI State
    const [openSections, setOpenSections] = useState({});
    
    const normalizedOrgChartSvg = orgChartSvg && orgChartSvg.startsWith('/') ? orgChartSvg : orgChartSvg ? `/${orgChartSvg}` : null;

    const toggleSection = (name) => {
        setOpenSections((prev) => ({
            ...prev,
            [name]: !prev[name],
        }));
    };

    // Use the exact same Drag-and-Drop Sorting logic applied in the Admin Panel
    const sortMembersByBranchHierarchy = (branchName, membersInBranch) => {
        return [...membersInBranch].sort((a, b) => {
            const orderA = a.sort_order ?? 9999;
            const orderB = b.sort_order ?? 9999;
            
            if (orderA !== orderB) return orderA - orderB;
            
            const positionOrder = structure?.positions?.[branchName] || [];
            const orderMap = new Map(positionOrder.map((pos, index) => [pos, index]));
            
            const aIndex = orderMap.has(a.position) ? orderMap.get(a.position) : 999;
            const bIndex = orderMap.has(b.position) ? orderMap.get(b.position) : 999;
            
            if (aIndex !== bIndex) return aIndex - bIndex;

            return a.name.localeCompare(b.name);
        });
    };

    return (
        <SidebarLayout
            activeModule="General"
            sidebarLinks={dashboardLinks}
            header={<h2 className="text-xl font-semibold text-gray-800">Employee Directory</h2>}
        >
            <Head title="Employee Directory" />

            <div className="py-8">
                <div className="mx-auto max-w-7xl sm:px-4 lg:px-8">
                    <OrgChartMapViewer svgPath={normalizedOrgChartSvg} />

                    {/* GRIDS: EXECUTIVE / MANAGEMENT COMMITTEES */}
                    <div className="mb-12">
                        {structure?.branches?.map((branchName) => {
                            const isGridSection = branchName.toLowerCase().includes('committee') ||
                                                  branchName.toLowerCase().includes('execom') ||
                                                  branchName.toLowerCase().includes('mancomm');

                            if (!isGridSection) return null;

                            const membersInBranch = memberList.filter(m => m.branch === branchName);
                            if (membersInBranch.length === 0) return null;

                            const sortedMembers = sortMembersByBranchHierarchy(branchName, membersInBranch);

                            return (
                                <div key={branchName} className="mb-10">
                                    <div className="mb-5 border-b border-gray-200 pb-3">
                                        <h4 className="text-xl font-semibold text-gray-800">{branchName}</h4>
                                    </div>

                                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                                        {sortedMembers.map((member, index) => (
                                            <div key={`grid-member-${index}`} className="w-full">
                                                <MemberCard member={member} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ACCORDIONS: EMPLOYEES & DEPARTMENTS */}
                    <div>
                        <div className="mb-5 border-b border-gray-200 pb-3">
                            <h3 className="text-2xl font-bold text-gray-900">Employees</h3>
                        </div>

                        {structure?.branches?.map((branchName) => {
                            const isGridSection = branchName.toLowerCase().includes('committee') ||
                                                  branchName.toLowerCase().includes('execom') ||
                                                  branchName.toLowerCase().includes('mancomm');

                            if (isGridSection) return null;

                            const membersInBranch = memberList.filter(m => m.branch === branchName);
                            if (membersInBranch.length === 0) return null;

                            const sortedMembers = sortMembersByBranchHierarchy(branchName, membersInBranch);
                            
                            // Check the specific setting set by the Admin. Default to 'carousel'.
                            const branchViewMode = structure?.branchSettings?.[branchName] || 'carousel';

                            // Group sorted members dynamically by their position title (For Carousel Mode)
                            const groupedByPosition = sortedMembers.reduce((acc, member) => {
                                if (!acc[member.position]) acc[member.position] = [];
                                acc[member.position].push(member);
                                return acc;
                            }, {});

                            return (
                                <div key={branchName} className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white">
                                    <button
                                        onClick={() => toggleSection(branchName)}
                                        className="w-full px-5 py-3 text-left text-base font-semibold text-gray-800 transition hover:bg-gray-50 flex justify-between items-center"
                                    >
                                        <span>{branchName}</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`h-5 w-5 text-gray-500 transition-transform ${openSections[branchName] ? 'rotate-180' : ''}`}>
                                            <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 01-1.06 0l-6-6a.75.75 0 111.06-1.06L12 14.69l5.47-5.47a.75.75 0 111.06 1.06l-6 6z" clipRule="evenodd" />
                                        </svg>
                                    </button>

                                    {openSections[branchName] && (
                                        <div className="border-t border-gray-200 p-5 bg-gray-50/30">
                                            {/* RENDER BASED ON ADMIN'S VIEW MODE SETTING FOR THIS SPECIFIC BRANCH */}
                                            {branchViewMode === 'carousel' ? (
                                                <div className="space-y-6">
                                                    {Object.entries(groupedByPosition).map(([positionName, members]) => (
                                                        <div key={positionName}>
                                                            <SideCarousel title={positionName}>
                                                                {members.map((member, idx) => (
                                                                    <div key={`carousel-member-${idx}`} className="min-w-[300px] max-w-[300px] snap-start">
                                                                        <MemberCard member={member} />
                                                                    </div>
                                                                ))}
                                                            </SideCarousel>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                                                    {sortedMembers.map((member, idx) => (
                                                        <div key={`grid-member-${idx}`} className="w-full">
                                                            <MemberCard member={member} />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </SidebarLayout>
    );
}