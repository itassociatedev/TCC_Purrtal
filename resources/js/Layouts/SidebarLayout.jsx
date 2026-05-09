import ApplicationLogo from '@/Components/ApplicationLogo';
import Dropdown from '@/Components/Dropdown';
import FlashMessage from '@/Components/FlashMessage';
import { Link, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';

export default function SidebarLayout({
    header,
    children,
    sidebarLinks = [],
    activeModule = 'Dashboard',
    headerClassName = '',
}) {
    const { auth } = usePage().props;

    // ✅ SAFE VARIABLE: Uses optional chaining (?.) and a fallback string ('')
    const userRole = auth.user?.role?.name?.toLowerCase().trim() || '';

    const allowedPRRoles = [
    'procurement assist', 
    'procurement tl', 
    'director of corporate services and operations', 
    'admin', 
    'operations manager', 
    'inventory assist', 
    'inventory tl'
    ];

    const canCreatePR = allowedPRRoles.includes(userRole);
    
    // 🟢 Store notifications and count in local state
    const [localNotifications, setLocalNotifications] = useState(auth.notifications || []);
    const [localUnreadCount, setLocalUnreadCount] = useState(auth.unreadNotificationsCount || 0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // 🟢 Calculate hasMore dynamically
    const totalNotificationsCount = auth.totalNotificationsCount || 0;
    const hasMore = totalNotificationsCount > localNotifications.length;

    const loadMoreNotifications = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);

        try {
            const response = await axios.get(route('notifications.load-more'), {
                params: { offset: localNotifications.length }
            });

            const newNotifications = response.data.notifications;
            
            // Append the older notifications to our existing list
            setLocalNotifications(prev => [...prev, ...newNotifications]);
        } catch (error) {
            console.error("Failed to load older notifications", error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Keep local state synced if Inertia pushes fresh props from the server
    useEffect(() => {
        if (localNotifications.length <= (auth.notifications?.length || 0)) {
            setLocalNotifications(auth.notifications || []);
        }
        setLocalUnreadCount(auth.unreadNotificationsCount || 0);
    }, [auth.notifications, auth.unreadNotificationsCount]);

    // 🟢 Mark as read without deleting from the list
    const markAsRead = (notificationId, url) => {
        // 1. Instantly update UI: Mark as read and decrement count
        const notification = localNotifications.find(n => n.id === notificationId);
        if (notification && !notification.read_at) {
            setLocalNotifications(prev => prev.map(n => 
                n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
            ));
            setLocalUnreadCount(prev => Math.max(0, prev - 1));
            
            // 2. Silently tell the backend
            axios.post(route('notifications.read', notificationId));
        }

        // 3. Navigate if there's a URL attached
        if (url) {
            router.visit(url);
        }
    };

    const user = usePage().props.auth.user;
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    const currentModuleLabel =
        activeModule === 'Admin'
            ? 'Admin Module'
            : ['HR', 'HR MENU', 'HR ADMIN'].includes(activeModule)
              ? 'HR Module'
              : activeModule === 'Duty Meals'
                ? 'Select Module'
                : activeModule === 'Document Repository'
                  ? 'Select Module'
                  : activeModule === 'PR/PO Module'
                    ? 'PR/PO Module'
                    : 'Select Module';

    const priorityLinkLabel =
        activeModule === 'HR'
            ? 'HR Admin Overview'
            : activeModule === 'HR MENU'
              ? 'HR Admin Overview'
              : activeModule === 'HR ADMIN'
                ? 'HR Module Overview'
                : null;

    const priorityLink = priorityLinkLabel
        ? sidebarLinks.find((link) => link.label === priorityLinkLabel)
        : null;

    const regularSidebarLinks = priorityLink
        ? sidebarLinks.filter((link) => link.label !== priorityLinkLabel)
        : sidebarLinks;

    const customDocumentCategoryIcon = (
        <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 12h10M7 17h6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h8l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />
        </svg>
    );

    const priorityDefaultIcon = (
        <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
    );

    const iconSvg = {
        Overview: (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V9h6v12" />
            </svg>
        ),
        Announcements: (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 8a3 3 0 00-6 0v7a3 3 0 006 0V8z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h1m14 0h1" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17h6" />
            </svg>
        ),
        'About Us': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3m-12 0H3m15.364-6.364l-2.121 2.121m-9.192 9.192l-2.121 2.121m0-12.727l2.121 2.121m9.192 9.192l2.121 2.121" />
            </svg>
        ),
        'Organizational Directory': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h8M8 12h8M8 18h8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12" />
            </svg>
        ),
        'Resource Links': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
        ),
        'Duty Meals': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5l7 7-7 7" />
            </svg>
        ),
        'Duty Meal Overview': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5l7 7-7 7" />
            </svg>
        ),
        'Set Up Roster': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
        ),
        'Duty Meal Archive': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9-4v4m4-4v4" />
            </svg>
        ),
        'Document Overview': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 2h8l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4h8" />
            </svg>
        ),
        'Admin Overview': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        ),
        'Employee Management': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM16 16a5 5 0 10-10 0" />
            </svg>
        ),
        'Announcements & Notices': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 8a3 3 0 00-6 0v7a3 3 0 006 0V8z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h1m14 0h1" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17h6" />
            </svg>
        ),
        'Company Content Management': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4m0 0l-4-4m4 4H3" />
            </svg>
        ),
        'System Logs & Security': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v2h8z" />
            </svg>
        ),
        'HR Admin Overview': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
        'HR Module Overview': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 13h4v7H4v-7zM10 4h4v16h-4V4zM16 9h4v11h-4V9z" />
            </svg>
        ),
        'Manpower Request': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
        ),
        'Manpower Request Form': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
        ),
        'Approval Board': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
            </svg>
        ),
        'My Requests': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
            </svg>
        ),
        'Document Requests': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 11h8M8 15h5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h8l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />
            </svg>
        ),

        'Pending Document Requests': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 11h8M8 15h5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h8l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />
            </svg>
        ),
        'Form 2316 Approvals': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
            </svg>
        ),
        'Feedback Form': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        'Feedback Form Submissions': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8M8 13h5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" />
            </svg>
        ),
        'Products Masterlist': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
        ),
        'PR Form': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
        'PR Approval Board': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        'PO Generation': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M7 3h8l4 4v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 3v4h4" />
            </svg>
        ),
        // 🟢 NEW ICON FOR PR/PO STATUS ADDED HERE
        'PR/PO Status': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
        ),
    };

    const renderSidebarIcon = (link) => {
        if (link.icon === 'document-category') {
            return customDocumentCategoryIcon;
        }

        const IconComponent = typeof link.icon === 'function' ? link.icon : null;

        if (IconComponent) {
            return <IconComponent className="h-4 w-4 text-black" />;
        }

        return iconSvg[link.label] || <div className="h-4 w-4 rounded bg-gray-200" />;
    };

    const markAllAsRead = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (localUnreadCount === 0) return;

        // 1. Instantly update UI: Mark all unread as read and reset count to 0
        setLocalNotifications(prev => prev.map(n => 
            !n.read_at ? { ...n, read_at: new Date().toISOString() } : n
        ));
        setLocalUnreadCount(0);

        // 2. Silently tell the backend
        axios.post(route('notifications.mark-all-read'));
    };

    return (
        <div className="flex h-screen overflow-hidden bg-gray-100">
            <FlashMessage />

            {/* ✅ FIXED: Overlay raised to z-40 so it covers the header properly */}
            {isMobileSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 sm:hidden"
                    onClick={() => setIsMobileSidebarOpen(false)}
                />
            )}

            {/* ✅ FIXED: Sidebar raised to z-50 to float above everything else on mobile */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out sm:translate-x-0 sm:static sm:inset-0 ${
                    isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex h-20 items-center justify-center border-b border-gray-100 px-6">
                    <Link href={route('dashboard')} className="-ml-6 inline-flex items-center gap-0">
                        <ApplicationLogo className="block h-14 w-auto fill-current text-gray-800 sm:h-16" />
                        <span className="-ml-0.5 whitespace-nowrap text-lg font-semibold text-gray-800 sm:text-xl">
                            The Cat Clinic
                        </span>
                    </Link>
                </div>

                <div className="overflow-y-auto px-4 py-6 text-sm font-medium">
                    {!['General', 'Profile'].includes(activeModule) && (
                        <div className="mb-4">
                            <Link
                                href={route('dashboard')}
                                className="flex items-center gap-2 rounded-lg px-4 py-2 text-black hover:bg-gray-100 hover:text-black transition ease-in-out duration-150"
                            >
                                <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V9h6v12" />
                                </svg>
                                Dashboard
                            </Link>
                        </div>
                    )}

                    {['General', 'Profile'].includes(activeModule) && (
                        <div className="mb-4">
                            <div className="mb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Quick Links
                            </div>
                            <ul className="space-y-2">
                                <li>
                                    <Link
                                        href={route('staff.duty-meals.index')}
                                        className="flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                    >
                                        <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5l7 7-7 7" />
                                        </svg>
                                        Duty Meal
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href={route('admin.documents.index')}
                                        className="flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                    >
                                        <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 2h8l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4h8" />
                                        </svg>
                                        Document Repository
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    )}

                    {priorityLink && (
                        <div className="mb-4">
                            <Link
                                href={priorityLink.href}
                                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 ${
                                    priorityLink.active ? 'bg-gray-100 font-bold text-gray-900' : ''
                                }`}
                            >
                                {renderSidebarIcon(priorityLink) || priorityDefaultIcon}
                                <span>{priorityLink.label}</span>
                            </Link>
                        </div>
                    )}

                    <div className="mb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        General Menu
                    </div>

                    <ul className="space-y-2">
                        {regularSidebarLinks.map((link, index) => (
                            <li key={index}>
                                <Link
                                    href={link.href}
                                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 ${
                                        link.active ? 'bg-gray-100 font-bold text-gray-900' : ''
                                    }`}
                                >
                                    {renderSidebarIcon(link)}
                                    <span>{link.label}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {/* 🟢 RESOURCES SECTION */}
                    {['General', 'Profile'].includes(activeModule) && (
                        <div className="mt-8 mb-4">
                            <div className="mb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Resources
                            </div>
                            <ul className="space-y-2">
                                <li>
                                    <Link
                                        href={route('resources.internal')}
                                        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 ${
                                            route().current('resources.internal') ? 'bg-gray-100 font-bold text-gray-900' : ''
                                        }`}
                                    >
                                        <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                        Internal Links
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href={route('resources.external')}
                                        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 ${
                                            route().current('resources.external') ? 'bg-gray-100 font-bold text-gray-900' : ''
                                        }`}
                                    >
                                        <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                        </svg>
                                        External Links
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    )}
                </div>
            </aside>

            <div className="flex flex-1 flex-col overflow-hidden relative">
                
                {/* 🔽 CSS FIX FOR MOBILE NOTIFICATION DROPDOWN 🔽 */}
                <style>{`
                    @media (max-width: 639px) {
                        .mobile-notification-fix > div > .absolute.z-50,
                        .mobile-notification-fix .absolute.z-50 {
                            position: fixed !important;
                            top: 4.5rem !important; 
                            left: 50% !important;
                            right: auto !important;
                            transform: translateX(-50%) !important;
                            width: 95vw !important;
                            max-width: 400px !important;
                        }
                    }
                `}</style>

                {/* ✅ FIXED: Lowered Header to z-30 so the sidebar and overlay cover it when open */}
                <header className="relative z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-3 sm:px-6">
                    {/* Mobile Hamburger Menu */}
                    <button
                        onClick={() => setIsMobileSidebarOpen(true)}
                        className="text-gray-500 hover:text-gray-700 focus:outline-none sm:hidden"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    {/* Right Side Header Items - Reduced gap on mobile */}
                    <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-3">
                        
                        {/* 🔽 Wrapped Notifications Dropdown 🔽 */}
                        <div className="mobile-notification-fix">
                            <Dropdown>
                                <Dropdown.Trigger>
                                    <button
                                        type="button"
                                        className="relative inline-flex h-[36px] w-[36px] sm:h-[42px] sm:w-[42px] items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none"
                                        aria-label="Notifications"
                                    >
                                        <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0018 9.75V9a6 6 0 10-12 0v.75a8.967 8.967 0 00-2.312 6.022c1.733.64 3.563 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                                        </svg>
                                        
                                        {localUnreadCount > 0 && (
                                            <span className="absolute right-0 top-0 sm:right-1 sm:top-1 flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] sm:text-[10px] font-bold text-white ring-2 ring-white">
                                                {localUnreadCount}
                                            </span>
                                        )}
                                    </button>
                                </Dropdown.Trigger>
                                
                                <Dropdown.Content align="right" width="80">
                                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white">
                                        <span className="text-sm font-semibold text-gray-900">Notifications</span>
                                        {localUnreadCount > 0 && (
                                            <button onClick={markAllAsRead} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 focus:outline-none transition-colors">
                                                Mark all as read
                                            </button>
                                        )}
                                    </div>
                                    
                                    {localNotifications.length === 0 ? (
                                        <div className="px-4 py-3">
                                            <p className="mt-1 text-xs text-gray-500">No new notifications yet.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                                                {localNotifications.map((notification) => (
                                                    <button 
                                                        key={notification.id}
                                                        onClick={() => markAsRead(notification.id, notification.data.action_url)}
                                                        className={`block w-full text-left px-4 py-3 transition ${notification.read_at ? 'bg-white hover:bg-slate-50' : 'bg-indigo-50/60 hover:bg-indigo-50'}`}
                                                    >
                                                        <p className={`text-sm ${notification.read_at ? 'font-medium text-slate-600' : 'font-bold text-slate-900'}`}>
                                                            {notification.data.message}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            {notification.data.user_email || notification.data.details}
                                                        </p>
                                                    </button>
                                                ))}
                                            </div>

                                            {hasMore && (
                                                <div className="block bg-gray-50 text-center border-t border-gray-100 rounded-b-md">
                                                    <button 
                                                        onClick={loadMoreNotifications}
                                                        disabled={isLoadingMore}
                                                        className="block w-full py-2.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-gray-100 transition disabled:opacity-50"
                                                    >
                                                        {isLoadingMore ? 'Loading older alerts...' : 'Show Previous Notifications'}
                                                    </button>
                                                </div>
                                            )}
                                            
                                            {!hasMore && localNotifications.length > 0 && (
                                                <div className="block px-4 py-2.5 bg-gray-50 text-center border-t border-gray-100 rounded-b-md text-xs text-gray-400 font-medium">
                                                    End of notification history
                                                </div>
                                            )}
                                        </>
                                    )}
                                </Dropdown.Content>
                            </Dropdown>
                        </div>

                        {/* Module Selection Dropdown */}
                        <Dropdown>
                            <Dropdown.Trigger>
                                <button className="inline-flex min-h-[36px] sm:min-h-[42px] items-center gap-1 sm:gap-2 rounded-full border border-slate-200 bg-white/90 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none">
                                    
                                    {/* Hide text on mobile */}
                                    <span className="hidden sm:block">{currentModuleLabel}</span>
                                    
                                    {/* Show grid icon on mobile instead */}
                                    <svg className="h-4 w-4 sm:hidden text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                                    </svg>

                                    <svg className="h-3 w-3 sm:h-4 sm:w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </Dropdown.Trigger>

                            <Dropdown.Content>
                                {['admin', 'director of corporate services and operations', 'hr business partner', 'human resources business partner', 'hrbp', 'hr assistant', 'human resources assistant'].includes(userRole) && (
                                    <Dropdown.Link 
                                      href={
                                      ['hr business partner', 'human resources business partner', 'hrbp', 'hr assistant', 'human resources assistant'].includes(userRole) 
                                         ? route('admin.announcements.index'): route('admin.dashboard')}>
                                         Admin Module
                                     </Dropdown.Link>
                                )}
                                <Dropdown.Link href={route('hr.index')}>HR Module</Dropdown.Link>
                                
                                <Dropdown.Link href={canCreatePR ? route('prpo.purchase-requests.create') : route('prpo.status.index')}>
                                 PR/PO Module
                                </Dropdown.Link>
                                
                                {['admin', 'duty meal custodian', 'Director of Corporate Services and Operations', 'Housekeeping TL', 'Auditor TL', 'Audit Assistant'].includes(user?.role?.name) && (
                                    <Dropdown.Link href={route('admin.duty-meals.index')}>Duty Meal Module</Dropdown.Link>
                                )}
                            </Dropdown.Content>
                        </Dropdown>

                        {/* User Dropdown */}
                        <Dropdown>
                            <Dropdown.Trigger>
                                <button className="inline-flex min-h-[36px] sm:min-h-[42px] items-center gap-1 sm:gap-2 rounded-full border border-slate-200 bg-white/90 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none">
                                    
                                    {/* Hide text on mobile, truncate if it gets too long on desktop */}
                                    <span className="hidden sm:block max-w-[100px] lg:max-w-[150px] truncate">{user?.name}</span>
                                    
                                    {/* Show simple user icon on mobile instead */}
                                    <svg className="h-4 w-4 sm:hidden text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>

                                    <svg className="h-3 w-3 sm:h-4 sm:w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </Dropdown.Trigger>
                            
                            <Dropdown.Content>
                                <Dropdown.Link href={route('profile.edit')}>Profile</Dropdown.Link>
                                <Dropdown.Link href={route('logout')} method="post" as="button">Log Out</Dropdown.Link>
                            </Dropdown.Content>
                        </Dropdown>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto bg-gray-100 p-4 sm:p-6 lg:p-8">
                    {header && (
                        <div className={`mb-3 rounded-lg bg-white p-4 shadow-sm sm:mb-6 ${headerClassName}`.trim()}>
                            {header}
                        </div>
                    )}
                    {children}
                </main>
            </div>
        </div>
    );
}