import ApplicationLogo from '@/Components/ApplicationLogo';
import Dropdown from '@/Components/Dropdown';
import FlashMessage from '@/Components/FlashMessage';
import { Link, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { hasHRModuleAccess, moduleHasAccess, hasPermission, canViewModuleCard, getFirstAttendanceRoute } from '@/Config/navigation';

export default function SidebarLayout({
    header,
    children,
    sidebarLinks = [],
    activeModule = 'Dashboard',
    headerClassName = '',
    onTriggerAddModal = null, 
}) {

    const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
    };

    const { auth } = usePage().props;

    const safeSidebarLinks = Array.isArray(sidebarLinks) ? sidebarLinks : [];
    const safeNotifications = Array.isArray(auth?.notifications) ? auth.notifications : [];

    const userRole = String(auth?.user?.role?.name || auth?.user?.role || '').toLowerCase().trim();
    const userPosition = String(auth?.user?.position?.name || auth?.user?.position || '').toLowerCase().trim();
    const userDepartment = String(auth?.user?.department?.name || auth?.user?.department || '').toLowerCase().trim();
    const roleAndPosition = `${userRole} ${userPosition} ${userDepartment}`;

    const allowedPRRoles = ['procurement assist', 'procurement tl', 'director of corporate services and operations', 'admin', 'operations manager', 'inventory assist', 'inventory tl'];
    const canCreatePR = allowedPRRoles.includes(userRole);
    
    const isSuperAdmin = ['admin', 'super admin', 'director of corporate services and operations'].includes(userRole);
    const isAudit = roleAndPosition.includes('audit') || roleAndPosition.includes('accountability') || roleAndPosition.includes('view only');
    
    // 🟢 NEW: Unified condition to toggle Accountability/Assets module visibility globally
    const hasAccountabilities = auth?.has_department_assets || (auth?.user?.assets && auth.user.assets.length > 0) || isSuperAdmin || isAudit;

    const hasAnyAdminPermission = () => [
        'admin_overview',
        'announcements',
        'employees',
        'company_content',
        'org_chart',
        'resource_links',
        'system_logs',
        'access_control',
    ].some((permission) => hasPermission(auth, permission));

    const getFirstAdminRoute = () => {
        if (hasPermission(auth, 'admin_overview')) {
            return route('admin.dashboard');
        }
        if (hasPermission(auth, 'announcements')) {
            return route('admin.announcements.index');
        }
        if (hasPermission(auth, 'employees')) {
            return route('admin.employees');
        }
        if (hasPermission(auth, 'company_content')) {
            return route('admin.company-content.index');
        }
        if (hasPermission(auth, 'org_chart')) {
            return route('admin.org-chart.index');
        }
        if (hasPermission(auth, 'resource_links')) {
            return route('admin.resource-links.index');
        }
        if (hasPermission(auth, 'system_logs')) {
            return route('admin.logs.index');
        }
        if (hasPermission(auth, 'access_control')) {
            return route('admin.access-control.index');
        }

        return route('admin.dashboard');
    };

    const prpoPermissions = [
        'products',
        'purchase_requests',
        'approval_board',
        'purchase_orders',
        'prpo_status',
    ];

    const hasAnyPrpoPermission = () => prpoPermissions.some((permission) => hasPermission(auth, permission));
    const getFirstPrpoRoute = () => {
        if (hasPermission(auth, 'purchase_requests')) {
            return route('prpo.purchase-requests.create');
        }
        if (hasPermission(auth, 'products')) {
            return route('prpo.products.index');
        }
        if (hasPermission(auth, 'approval_board')) {
            return route('prpo.approval-board');
        }
        if (hasPermission(auth, 'purchase_orders')) {
            return route('prpo.purchase-orders.index');
        }
        return route('prpo.status.index');
    };

    const [localNotifications, setLocalNotifications] = useState(safeNotifications);
    const [localUnreadCount, setLocalUnreadCount] = useState(auth?.unreadNotificationsCount || 0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const totalNotificationsCount = auth?.totalNotificationsCount || 0;
    const hasMore = totalNotificationsCount > localNotifications.length;

    const loadMoreNotifications = async (e) => {
        e.preventDefault(); e.stopPropagation();
        if (isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        try {
            const response = await axios.get(route('notifications.load-more'), {
                params: { offset: localNotifications.length }
            });

            const newNotifications = response.data.notifications || [];

            // Append the older notifications to our existing list
            setLocalNotifications(prev => [...prev, ...newNotifications]);
        } catch (error) {
            console.error("Failed to load older notifications", error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    useEffect(() => {
        if (localNotifications.length <= safeNotifications.length) setLocalNotifications(safeNotifications);
        setLocalUnreadCount(auth?.unreadNotificationsCount || 0);
    }, [auth?.notifications, auth?.unreadNotificationsCount]);

    const markAsRead = (notificationId, url) => {
        const notification = localNotifications.find(n => n.id === notificationId);
        if (notification && !notification.read_at) {
            setLocalNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n));
            setLocalUnreadCount(prev => Math.max(0, prev - 1));
            axios.post(route('notifications.read', notificationId));
        }
        if (url) router.visit(url);
    };

    const user = auth?.user;
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // 🟢 CHECK: Identify which Quick Links the user has access to
    const showDocumentQuickLink = canViewModuleCard(auth, 'documents');
    const showCalendarQuickLink = canViewModuleCard(auth, 'attendance_calendar');
    const showPersonalMealsQuickLink = canViewModuleCard(auth, 'duty_meal_personal');

    const hasAnyQuickLinks = showDocumentQuickLink || showCalendarQuickLink || showPersonalMealsQuickLink;

    // 🟢 NEW: Check if the user is currently on the Dashboard
    const isDashboard = route().current('dashboard');

    // 🟢 FIX: Define broad Duty Meal access explicitly
    const canAccessDutyMealModule = [
        'duty_meal', 'duty_meal_setup_roster', 'duty_meal_archive', 'duty_meal_personal'
    ].some(perm => hasPermission(auth, perm) || canViewModuleCard(auth, perm));

    // 🟢 FIXED: Dynamically route the user to the FIRST Duty Meal module they have access to!
    const getFirstDutyMealRoute = () => {
        if (hasPermission(auth, 'duty_meal') || canViewModuleCard(auth, 'duty_meal')) return route('admin.duty-meals.index');
        if (hasPermission(auth, 'duty_meal_setup_roster') || canViewModuleCard(auth, 'duty_meal_setup_roster')) return route('admin.duty-meals.create');
        if (hasPermission(auth, 'duty_meal_archive') || canViewModuleCard(auth, 'duty_meal_archive')) return route('admin.duty-meals.archive');

        return route('staff.duty-meals.index');
    };

    const routeToDutyMeal = getFirstDutyMealRoute();

    const currentModuleLabel =
        activeModule === 'Admin'
            ? 'Admin Module'
                        : activeModule === 'Assets'
                            ? (isSuperAdmin ? 'Accountability Module' : 'My Accountability')
                        : activeModule === 'Asset Masterlist'
                            ? 'Asset Masterlist'
            : activeModule === 'Attendance'
              ? 'Attendance Module'
            : ['HR', 'HR MENU', 'HR ADMIN'].includes(activeModule)
              ? 'HR Module'
              : activeModule === 'Duty Meals'
                ? 'Duty Meal Module'
                : activeModule === 'Document Repository'
                  ? 'Select Module'
                  : activeModule === 'PR/PO Module'
                    ? 'PR/PO Module'
                    : 'Select Module';

    // Determines if we are on the main overview/dashboard to conditionally render Quick Links and Resources
    const isMainDashboard = ['General', 'Dashboard'].includes(activeModule);

    const priorityLinkLabel = activeModule === 'HR' || activeModule === 'HR MENU' ? 'HR Admin Overview' : activeModule === 'HR ADMIN' ? 'HR Module Overview' : null;
    const priorityLink = priorityLinkLabel ? safeSidebarLinks.find((link) => link?.label === priorityLinkLabel) : null;
    const regularSidebarLinks = priorityLink ? safeSidebarLinks.filter((link) => link?.label !== priorityLinkLabel) : safeSidebarLinks;

    const customDocumentCategoryIcon = (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 12h10M7 17h6" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 3h8l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" /></svg>);
    const priorityDefaultIcon = (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>);

    // Expanded Icon Dictionary to cover all module menu items
    const iconSvg = {
        // Main & Dashboard
        Overview: (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" /></svg>),
        Dashboard: (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" /></svg>),
        Announcements: (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 8a3 3 0 00-6 0v7a3 3 0 006 0V8z" /><path strokeLinecap="round" strokeLinejoin="round" d="M4 8h1m14 0h1" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 17h6" /></svg>),
        'About Us': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09l2.846.813-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" /></svg>),
        'Organizational Directory': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>),
        
        // Quick Links & Resources
        'Duty Meals': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 5l7 7-7 7" /></svg>),
        'Document Overview': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 2h8l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4h8" /></svg>),
        'Internal Links': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>),
        'External Links': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" /></svg>),

        // Admin Module
        'Admin Overview': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" /></svg>),
        'Announcements & Notices': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>),
        'Employee Management': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>),
        'Company Content Management': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>),
        'Resource Links': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>),
        'System Logs & Security': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>),

        // HR Module
        'HR Admin Overview': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>),
        'Document Requests': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>),
        'Form 2316 Approvals': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75" /></svg>),
        'Manpower Request Form': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>),
        'Approval Board': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375" /></svg>),
        'Feedback Form': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" /></svg>),

        // PR/PO Module
        'PR Form': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>),
        'PO Generation': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>),
        'Products Masterlist': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>),

        // Duty Meal Module
        'Duty Meal Overview': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25 21 12m0 0-3.75 3.75M21 12H3" /></svg>),
        'Set Up Roster': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>),
        'Duty Meal Archive': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>),

        // Accountability (Bulletproof links)
        'Asset Management': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>),
        'My Accountability': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>),
        'Asset Masterlist': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>),
        'Asset Overview': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" /></svg>),
        'Add Asset': (<svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>),
    };

    const renderSidebarIcon = (link) => {
        if (!link) return <div className="h-4 w-4 rounded bg-gray-200" />;
        if (link.icon === 'document-category') return customDocumentCategoryIcon;
        const IconComponent = typeof link.icon === 'function' ? link.icon : null;
        if (IconComponent) return <IconComponent className="h-4 w-4 text-black" />;
        return iconSvg[link.label] || <div className="h-4 w-4 rounded bg-gray-200" />;
    };

    /*
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
        'My Duty Meals': (
        <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
        'Access Control': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 10-8 0v4a2 2 0 00-2 2v5a2 2 0 002 2h8a2 2 0 002-2v-5a2 2 0 00-2-2zm-6 0V7a2 2 0 114 0v4H10z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h.01" />
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
        'PR/PO Status': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
        ),
        'Attendance Overview': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
        'Setup Schedule': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
        'Calendar': (
            <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        ),
    };

    const renderSidebarIcon = (link) => {
        if (link.icon === 'document-category') {
            return customDocumentCategoryIcon;
        }

        if (link.icon === 'key') return null;
    */

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
            {isMobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}

            <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out sm:translate-x-0 sm:static sm:inset-0 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex h-20 items-center justify-center border-b border-gray-100 px-6">
                    <Link href={route('dashboard')} className="-ml-6 inline-flex items-center gap-0">
                        <ApplicationLogo className="block h-14 w-auto fill-current text-gray-800 sm:h-16" />
                        <span className="-ml-0.5 whitespace-nowrap text-lg font-semibold text-gray-800 sm:text-xl">The Cat Clinic</span>
                    </Link>
                </div>

                <div className="overflow-y-auto px-4 py-6 text-sm font-medium">
                    {!['General', 'Profile'].includes(activeModule) && (
                        <div className="mb-4">
                            <Link href={route('dashboard')} className="flex items-center gap-2 rounded-lg px-4 py-2 text-black hover:bg-gray-100 hover:text-black transition ease-in-out duration-150">
                                {iconSvg.Overview} Dashboard
                            </Link>
                        </div>
                    )}

                    {priorityLink && (
                        <div className="mb-4">
                            <Link href={priorityLink.href} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 ${priorityLink.active ? 'bg-gray-100 font-bold text-gray-900' : ''}`}>
                                {renderSidebarIcon(priorityLink) || priorityDefaultIcon}
                                <span>{priorityLink.label}</span>
                            </Link>
                        </div>
                    )}

                    {/* 🟢 NEW QUICK LINKS RESTORED TO SIDEBAR (MOVED TO TOP & EMOJIS REMOVED) */}
                    {isDashboard && (hasAnyQuickLinks || hasAccountabilities) && (
                        <div className="mb-6">
                            <div className="mb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Quick Links
                            </div>
                            <ul className="space-y-2">
                                {showDocumentQuickLink && (
                                    <li>
                                        <Link
                                            href={route('admin.documents.index')}
                                            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition ${
                                                route().current('admin.documents.index') ? 'bg-emerald-50 font-bold text-emerald-700' : ''
                                            }`}
                                        >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                            </svg>
                                            <span>Document Repository</span>
                                        </Link>
                                    </li>
                                )}
                                {showCalendarQuickLink && (
                                    <li>
                                        <Link
                                            href={route('attendance.calendar')}
                                            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition ${
                                                route().current('attendance.calendar') ? 'bg-indigo-50 font-bold text-indigo-700' : ''
                                            }`}
                                        >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span>My Calendar</span>
                                        </Link>
                                    </li>
                                )}
                                {showPersonalMealsQuickLink && (
                                    <li>
                                        <Link
                                            href={route('staff.duty-meals.index')}
                                            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-rose-50 hover:text-rose-700 transition ${
                                                route().current('staff.duty-meals.index') ? 'bg-rose-50 font-bold text-rose-700' : ''
                                            }`}
                                        >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span>My Duty Meals</span>
                                        </Link>
                                    </li>
                                )}
                                {/* 🟢 CONDITIONALLY HIDE ACCOUNTABILITY LINK IF 0 DEPT ASSETS */}
                                {hasAccountabilities && (
                                    <li>
                                        <Link
                                            href={isSuperAdmin ? route('admin.assets.index') : (isAudit ? route('admin.asset-masterlist') : route('staff.assets.index'))}
                                            className="flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition"
                                        >
                                            {iconSvg['Asset Management']}
                                            <span>{isSuperAdmin ? 'Asset Management' : (isAudit ? 'Asset Masterlist' : 'My Accountability')}</span>
                                        </Link>
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}

                    {regularSidebarLinks.length > 0 && (
                        <>
                            <div className="mb-4 text-xs font-bold text-gray-400 uppercase tracking-wider mt-4">General Menu</div>
                            <ul className="space-y-2">
                                {regularSidebarLinks.map((link, index) => {
                                    if (!link) return null;
                                    return (
                                    <li key={index}>
                                        {link.isAction ? (
                                            <button type="button" onClick={(e) => { e.preventDefault(); if (link.label === 'Add Asset' && onTriggerAddModal) onTriggerAddModal(); }} className={`w-full flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition ease-in-out duration-150`}>
                                                {renderSidebarIcon(link)} <span>{link.label}</span>
                                            </button>
                                        ) : (
                                            <Link href={link.href} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 ${link.active ? 'bg-gray-100 font-bold text-gray-900' : ''}`}>
                                                {renderSidebarIcon(link)} <span>{link.label}</span>
                                            </Link>
                                        )}
                                    </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}

                    {/* ONLY RENDER RESOURCES IF ON MAIN DASHBOARD */}
                    {isMainDashboard && (
                        <div className="mb-4 mt-8">
                            <div className="mb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Resources</div>
                            <ul className="space-y-2">
                                <li>
                                    <a href="/resources/internal-links" className="flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900">
                                        {iconSvg['Internal Links']} Internal Links
                                    </a>
                                </li>
                                <li>
                                    <a href="/resources/external-links" className="flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900">
                                        {iconSvg['External Links']} External Links
                                    </a>
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
                    <button onClick={() => setIsMobileSidebarOpen(true)} className="sm:hidden text-gray-500 hover:text-gray-700">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
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
                                                        className={`block w-full text-left px-4 py-3 pb-6 transition relative ${notification.read_at ? 'bg-white hover:bg-slate-50' : 'bg-indigo-50/60 hover:bg-indigo-50'}`}
                                                    >
                                                        <p className={`text-sm pr-12 ${notification.read_at ? 'font-medium text-slate-600' : 'font-bold text-slate-900'}`}>
                                                            {notification.data.message}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-1 pr-12">
                                                            {notification.data.user_email || notification.data.details}
                                                        </p>
                                                        <span className="absolute bottom-2 right-3 text-[10px] font-semibold text-slate-400">
                                                            {formatTimeAgo(notification.created_at)}
                                                        </span>
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
                                    {hasAnyAdminPermission() && (
                                        <Dropdown.Link href={getFirstAdminRoute()}>
                                            Admin Module
                                        </Dropdown.Link>
                                    )}

                                    {/* HR Module: show only when user has HR-related permissions or is Admin */}
                                    { hasHRModuleAccess(auth) && (
                                        <Dropdown.Link href={route('hr.index')}>HR Module</Dropdown.Link>
                                    ) }

                                    { moduleHasAccess(usePage().props.auth, 'prpo_') && (
                                        <Dropdown.Link href={getFirstPrpoRoute()}>
                                            PR/PO Module
                                        </Dropdown.Link>
                                    )}

                                    {/* 🟢 FIXED: Properly routes users dynamically to the first Duty Meal module they have access to */}
                                    { canAccessDutyMealModule && routeToDutyMeal && (
                                        <Dropdown.Link href={routeToDutyMeal}>
                                            Duty Meal Module
                                        </Dropdown.Link>
                                    )}

                                    {moduleHasAccess(auth, 'attendance') && (
                                        <Dropdown.Link href={getFirstAttendanceRoute(auth)}>
                                            Attendance Module
                                        </Dropdown.Link>
                                    )}

                                    {/* 🟢 CONDITIONALLY HIDE ACCOUNTABILITY LINK IF 0 DEPT ASSETS */}
                                    {hasAccountabilities && (
                                        <Dropdown.Link href={isSuperAdmin ? route('admin.assets.index') : (isAudit ? route('admin.asset-masterlist') : route('staff.assets.index'))}>
                                            {isSuperAdmin ? 'Accountability Module' : (isAudit ? 'Asset Masterlist' : 'My Accountability')}
                                        </Dropdown.Link>
                                    )}

                            </Dropdown.Content>
                        </Dropdown>

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
                    {header && <div className={`mb-6 rounded-lg bg-white p-4 shadow-sm ${headerClassName}`}>{header}</div>}
                    {children}
                </main>
            </div>
        </div>
    );
}
