// Dashboard Links
export const getDashboardLinks = () => [
    {
        label: 'Overview',
        href: route('dashboard'), // Overview gets the main dashboard route now
        active: route().current('dashboard'),
    },
    {
        label: 'Announcements',
        href: route('dashboard.announcements'), // Announcements gets its own new route
        active: route().current('dashboard.announcements'),
    },
    {
        label: 'About Us',
        href: route('dashboard.mission-vision'),
        active: route().current('dashboard.mission-vision'),
    },
    {
        label: 'Organizational Directory', 
        href: route('dashboard.org-chart'), 
        active: route().current('dashboard.org-chart')
    },
];

const normalizePermissionKey = (permissionKey) => String(permissionKey || '').toLowerCase().trim();

const normalizeAclPermissionLevel = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized.includes('full')) return 'full';
    if (normalized.includes('edit') || normalized.includes('write')) return 'edit';
    if (normalized.includes('view')) return 'view';
    return 'no_access';
};

export const isUserAdmin = (auth) => {
    if (!auth?.user?.role) return false;
    const roleName = String(auth.user.role.name || '').toLowerCase().trim();
    return roleName === 'admin';
};

export const hasPermission = (auth, permissionKey) => {
    const normalizedKey = normalizePermissionKey(permissionKey);
    if (!normalizedKey || !auth?.user) return false;

    if (isUserAdmin(auth)) return true;

    const aclPermissions = auth.user.acl_permissions;
    if (aclPermissions && typeof aclPermissions === 'object' && Object.prototype.hasOwnProperty.call(aclPermissions, normalizedKey)) {
        return normalizeAclPermissionLevel(aclPermissions[normalizedKey]) !== 'no_access';
    }

    const userPermissions = Array.isArray(auth.user.permissions)
        ? auth.user.permissions.map((permission) => String(permission || '').toLowerCase().trim())
        : [];

    return userPermissions.includes(normalizedKey);
};

export const getAclPermissionLevel = (auth, permissionKey) => {
    if (!auth?.user?.acl_permissions) {
        return null;
    }

    const normalizedKey = String(permissionKey).trim().toLowerCase();
    const level = auth.user.acl_permissions[normalizedKey];

    return level ? String(level).trim().toLowerCase() : null;
};

// ===================================================================
// 🔐 CLEAR PERMISSION HIERARCHY
// ===================================================================
// Full = Create / Edit / Delete / Admin
// Edit = Create, Approve, Reject (NOT Delete)
// View = Request and View only (Read-only)
// None = No access

/**
 * Can user VIEW data for this module?
 * Returns true for: 'full', 'edit', 'view'
 */
const HR_OVERVIEW_CHILD_MODULES = [
    'documents',
    'form_2316_approvals',
    'manpower_requests_form',
    'approval_board_hr',
    'feedback_form',
];

const PERMISSION_ORDER = ['no_access', 'view', 'edit', 'full'];

const normalizePermissionLevel = (level) => {
    const normalized = String(level || '').trim().toLowerCase();
    return PERMISSION_ORDER.includes(normalized) ? normalized : 'no_access';
};

const getEffectiveAclPermissionLevel = (auth, permissionKey) => {
    const normalizedKey = normalizePermissionKey(permissionKey);
    const aclPermissions = auth?.user?.acl_permissions;
    const hasAcl = aclPermissions && typeof aclPermissions === 'object';

    if (!hasAcl) {
        return null;
    }

    const directPermission = getAclPermissionLevel(auth, normalizedKey);
    const directLevel = directPermission ? normalizePermissionLevel(directPermission) : null;

    if (!HR_OVERVIEW_CHILD_MODULES.includes(normalizedKey)) {
        return directLevel;
    }

    const overviewPermission = getAclPermissionLevel(auth, 'hr_overview');
    const overviewLevel = overviewPermission ? normalizePermissionLevel(overviewPermission) : null;

    if (!directLevel && !overviewLevel) {
        return null;
    }

    const directIndex = PERMISSION_ORDER.indexOf(directLevel || 'no_access');
    const overviewIndex = PERMISSION_ORDER.indexOf(overviewLevel || 'no_access');

    return PERMISSION_ORDER[Math.max(directIndex, overviewIndex)];
};

export const canViewModule = (auth, permissionKey) => {
    const level = getEffectiveAclPermissionLevel(auth, permissionKey);
    if (level !== null) {
        return ['full', 'edit', 'view'].includes(level);
    }
    return hasPermission(auth, permissionKey);
};

/**
 * Can a module card or module box be shown in the UI?
 * Returns true for the effective ACL view levels or any direct permission flag.
 */
export const canViewModuleCard = (auth, permissionKey) => {
    if (!auth?.user || !permissionKey) return false;
    return canViewModule(auth, permissionKey) || hasPermission(auth, permissionKey);
};

/**
 * Can user CREATE/REQUEST in this module?
 * Returns true for: 'full', 'edit' (NOT 'view')
 */
export const canCreateModule = (auth, permissionKey) => {
    const level = getEffectiveAclPermissionLevel(auth, permissionKey);
    if (level !== null) {
        return ['full', 'edit'].includes(level);
    }
    return hasPermission(auth, permissionKey);
};

/**
 * Can user EDIT data in this module?
 * Returns true for: 'full', 'edit'
 */
export const canEditModule = (auth, permissionKey) => {
    const level = getEffectiveAclPermissionLevel(auth, permissionKey);
    if (level !== null) {
        return ['full', 'edit'].includes(level);
    }
    return hasPermission(auth, permissionKey);
};

/**
 * Can user APPROVE requests in this module?
 * Returns true for: 'full', 'edit'
 */
export const canApproveModule = (auth, permissionKey) => {
    const level = getEffectiveAclPermissionLevel(auth, permissionKey);
    if (level !== null) {
        return ['full', 'edit'].includes(level);
    }
    return hasPermission(auth, permissionKey);
};

/**
 * Can user REJECT requests in this module?
 * Returns true for: 'full', 'edit'
 */
export const canRejectModule = (auth, permissionKey) => {
    const level = getEffectiveAclPermissionLevel(auth, permissionKey);
    if (level !== null) {
        return ['full', 'edit'].includes(level);
    }
    return hasPermission(auth, permissionKey);
};

/**
 * Can user DELETE data in this module?
 * Returns true for: 'full' only
 */
export const canDeleteModule = (auth, permissionKey) => {
    const level = getEffectiveAclPermissionLevel(auth, permissionKey);
    if (level !== null) {
        return level === 'full';
    }
    return false;
};

/**
 * Can user perform ADMIN functions in this module?
 * Returns true for: 'full' only
 */
export const canAdminModule = (auth, permissionKey) => {
    const level = getEffectiveAclPermissionLevel(auth, permissionKey);
    if (level !== null) {
        return level === 'full';
    }
    return false;
};

// ===================================================================
// 🔐 ACL PERMISSION OVERRIDE HELPERS (View Mode Bypass)
// ===================================================================

/**
 * Check if user has elevated permissions that allow bypassing view-mode restrictions
 * Applies to: Admin, Director roles, and users with explicit 'full' permission level
 */
export const canUserBypassViewMode = (auth, requiredModule = null) => {
    if (!auth?.user) return false;
    
    // 1. Admin always bypasses view mode
    if (isUserAdmin(auth)) return true;
    
    // 2. Director/elevated roles bypass view mode
    const roleName = String(auth.user.role?.name || '').toLowerCase().trim();
    if (roleName.includes('director') || roleName.includes('operations')) return true;
    
    // 3. Check if user has explicit 'full' permission for the required module
    if (requiredModule) {
        const level = getAclPermissionLevel(auth, requiredModule);
        if (level === 'full') return true;
    }
    
    return false;
};

/**
 * Check if user has elevated permission level (full or edit) for a module
 * This is used to determine if approval/edit actions should be available
 */
export const hasElevatedPermission = (auth, permissionKey) => {
    if (!auth?.user) return false;
    
    // Admin always has elevated permission
    if (isUserAdmin(auth)) return true;
    
    // Check explicit ACL permission level
    const level = getAclPermissionLevel(auth, permissionKey);
    return ['full', 'edit'].includes(level);
};

/**
 * Check if user should be restricted by view-mode (read-only roles only)
 * Returns false if user has elevated permissions (permission override)
 */
export const shouldRestrictByViewMode = (auth, requiredModule = null) => {
    // If user can bypass view mode, don't restrict them
    if (canUserBypassViewMode(auth, requiredModule)) return false;
    
    // Otherwise, apply view-mode restrictions
    return true;
};

// Count how many permissions the current user has that match a prefix
// Define groups mapping to the backend AdminACL module keys
const MODULE_GROUPS = {
    hr: [
        'hr_overview',
        'documents',
        'form_2316_approvals',
        'manpower_requests_form',
        'approval_board_hr',
        'feedback_form',
    ],
    prpo: [
        'products',
        'purchase_requests',
        'approval_board',
        'purchase_orders',
    ],
    duty_meal: [
        'duty_meal',
        'duty_meal_setup_roster',
        'duty_meal_archive',
    ],
    dmc: [
        'duty_meal',
        'duty_meal_setup_roster',
        'duty_meal_archive',
    ],
    duty_meals: [
        'duty_meal',
        'duty_meal_setup_roster',
        'duty_meal_archive',
    ],
    meals: [
        'duty_meal',
        'duty_meal_setup_roster',
        'duty_meal_archive',
    ],
    admin: [
        'admin_overview',
        'announcements',
        'employees',
        'company_content',
        'org_chart',
        'resource_links',
        'system_logs',
        'access_control',
    ],
    attendance: [
        'attendance_overview',
        'attendance_setup',
        'attendance_schedule_view',
        'attendance_calendar'
    ]
};

export const getModulePermissionCount = (auth, prefixOrGroup) => {
    if (!auth || !auth.user) return 0;
    const role = auth.user?.role?.name?.toLowerCase?.() || '';
    if (role === 'admin') return Infinity; // Admin bypass

    const perms = Array.isArray(auth.user.permissions)
        ? auth.user.permissions.map((p) => String(p || '').toLowerCase().trim())
        : [];

    const aclPermissionKeys = auth.user.acl_permissions
        ? Object.keys(auth.user.acl_permissions).map((p) => String(p || '').toLowerCase().trim())
        : [];

    const mergedPermissions = Array.from(new Set([...perms, ...aclPermissionKeys]));

    // Normalize input: allow 'hr_' or 'hr' or 'hr-' etc.
    const groupKey = String(prefixOrGroup || '').toLowerCase().replace(/[_-]+$/,'').replace(/[_-]+/g, '_');

    if (MODULE_GROUPS[groupKey]) {
        return MODULE_GROUPS[groupKey].filter((k) => hasPermission(auth, k)).length;
    }

    // Fallback: treat the input as a prefix to match module keys
    return mergedPermissions.filter((p) => p.startsWith(groupKey) && hasPermission(auth, p)).length;
};

export const moduleHasAccess = (auth, prefixOrGroup) => {
    if (!auth || !auth.user) return false;
    const role = auth.user?.role?.name?.toLowerCase?.() || '';
    if (role === 'admin') return true;
    return getModulePermissionCount(auth, prefixOrGroup) > 0;
};

export const hasHRModuleAccess = (auth) => {
    if (!auth || !auth.user) return false;

    return [
        'hr_overview',
        'documents',
        'form_2316_approvals',
        'approval_board_hr',
        'feedback_form',
        'manpower_requests_form',
    ].some((module) => canViewModule(auth, module) || canCreateModule(auth, module));
};

const getFirstAdminModuleRoute = (auth) => {
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

// Admin Module Links
export const getAdminLinks = (auth) => {
    const links = [];

    const announcementsLink = {
        label: 'Announcements & Notices',
        href: route('admin.announcements.index'),
        active: route().current('admin.announcements.*'),
    };

    const orgChartLink = {
        label: 'Organizational Directory',
        href: route('admin.org-chart.index'),
        active: route().current('admin.org-chart.index'),
    };

    if (hasPermission(auth, 'admin_overview')) {
        links.push({
            label: 'Admin Overview',
            href: route('admin.dashboard'),
            active: route().current('admin.dashboard'),
        });
    }

    // 🟢 FIXED: Changed from 'admin_overview' to 'attendance_settings'
    if (hasPermission(auth, 'attendance_settings')) {
        links.push({
            label: 'Attendance Settings',
            href: route('admin.attendance-settings.index'),
            active: route().current('admin.attendance-settings.*'),
            icon: () => (
                <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        });
    }

    if (hasPermission(auth, 'announcements')) {
        links.push(announcementsLink);
    }

    if (hasPermission(auth, 'employees')) {
        links.push({
            label: 'Employee Management',
            href: route('admin.employees'),
            active: route().current('admin.employees'),
        });
    }

    if (hasPermission(auth, 'company_content')) {
        links.push({
            label: 'Company Content Management',
            href: route('admin.company-content.index'),
            active: route().current('admin.company-content.*'),
        });
    }

    if (hasPermission(auth, 'org_chart')) {
        links.push(orgChartLink);
    }

    if (hasPermission(auth, 'resource_links')) {
        links.push({
            label: 'Resource Links',
            href: route('admin.resource-links.index'),
            active: route().current('admin.resource-links.*'),
        });
    }

    if (hasPermission(auth, 'access_control')) {
        links.push({
            label: 'Access Control',
            href: route('admin.access-control.index'),
            active: route().current('admin.access-control.*'),
            icon: 'key',
        });
    }

    if (hasPermission(auth, 'system_logs')) {
        links.push({
            label: 'System Logs & Security',
            href: route('admin.logs.index'),
            active: route().current('admin.logs.*'),
        });
    }

    return links;
};

// Document Repository Links
export const getDocumentSidebarLinks = (categories = [], activeCategory = 'Overview') => {
    return [
        {
            label: 'Document Overview',
            href: route('admin.documents.index'),
            active: activeCategory === 'Overview'
        },

        ...categories.map(cat => ({
            label: cat.name,
            href: route('admin.documents.index', { category: cat.name }),
            active: activeCategory === cat.name,
            icon: 'document-category',
        }))
    ];
};

// Duty Meal Module Links
export const getDutyMealLinks = (auth) => {
    // Hide Duty Meal module if user has no duty meal submodule permissions at all
    const hasDutyMealAccess = [
        'duty_meal_setup_roster',
        'duty_meal_archive',
    ].some((module) => hasPermission(auth, module));

    if (!hasDutyMealAccess) return [];

    // 🔐 DYNAMIC ACL CHECKS: Show the roster link for view-level access as well as edit/create access.
    const canSetupRoster = canViewModule(auth, 'duty_meal_setup_roster');
    const canAccessArchive = canViewModule(auth, 'duty_meal_archive');
    const canViewOverview = canViewModule(auth, 'duty_meal');
    const links = [];

    if (canViewOverview) {
        links.push({
            label: 'Duty Meal Overview',
            href: route('admin.duty-meals.index'),
            active: route().current('admin.duty-meals.index'),
        });
    }

    // Only inject the "Set Up Roster" link if they have create/edit permission for roster setup
    if (canSetupRoster) {
        links.push({
            label: 'Set Up Roster',
            href: route('admin.duty-meals.create'),
            active: route().current('admin.duty-meals.create'),
        });
    }
   
    // Only show archive if they have permission
    if (canAccessArchive) {
        links.push({
            label: 'Duty Meal Archive',
            href: route('admin.duty-meals.archive'),
            active:  route().current('admin.duty-meals.archive'),
        });
    }

    return links;
};

export const getStaffDutyMealLinks = () => [
    {
        label: 'Duty Meals',
        href: route('staff.duty-meals.index'),
        active: route().current('staff.duty-meals.index'),
    },
];

export const getHRLinks = (UserRole = 'Employee', auth) => {
    if (!hasHRModuleAccess(auth)) return [];
    
    const userRole = (auth?.user?.role?.name || '').toLowerCase();
    const userPosition = (auth?.user?.position?.name || '').toLowerCase();
    
    // DEFENSIVE STRIPPING: Force string, lowercase it, and trim hidden spaces
    const normalizedRole = String(UserRole).toLowerCase().trim();

    const canViewHROverview = canViewModule(auth, 'hr_overview');
    const canViewDocumentRequests = canViewModule(auth, 'documents');
    const canViewForm2316Approvals = canViewModule(auth, 'form_2316_approvals');
    const canViewFeedbackForm = canViewModule(auth, 'feedback_form');
    
    // 🔐 DYNAMIC ACL CHECKS: Use ACL permission levels instead of raw permission keys
    const canCreateManpowerRequest = canCreateModule(auth, 'manpower_requests_form');
    const canViewManpowerRequestForm = canViewModule(auth, 'manpower_requests_form');
    const canViewApprovalBoard = canViewModule(auth, 'approval_board_hr');

    // 1. Base links
    const links = [
        ...(canViewDocumentRequests ? [
            {
                label: 'Document Requests',
                href: route('hr.index'),
                active: route().current('hr.index'),
            }
        ] : []),
        ...(canViewForm2316Approvals ? [
            {
                label: 'Form 2316 Approvals',
                href: route('hr.accounting.index'),
                active: route().current('hr.accounting.index'),
            }
        ] : []),
        ...(canViewHROverview ? [
            {
                label: 'HR Admin Overview',
                href: route('hr.admin.index'),
                active: route().current('hr.admin.index'),
            }
        ] : []),
    ];

    // 3. THE FIXED MATH
    const isAdmin = normalizedRole === 'admin';
    const isHR = normalizedRole === 'hr';
    const isHRBP = normalizedRole === 'hrbp';
    
    // FIX 1: Use .includes() on the string so it catches "vet tech tl", "it tl", etc.
    const isRequesterOnly = normalizedRole.includes('tl') || normalizedRole === 'marketing manager';
    
    const isApprover = [
        'director of corporate services and operations', 
        'chief vet', 
        'operations manager', 
    ].includes(normalizedRole);

    // 4. Push the links based on the math
    
    // 🔐 FIXED: Now uses dynamic ACL permission check instead of hardcoded role names
    // Create Link is visible if user has view access to the manpower request form
    if (canViewManpowerRequestForm) {
        links.push({
            label: 'Manpower Request Form',
            href: route('hr.manpower-requests.create'),
            active: route().current('hr.manpower-requests.create'),
        });
    }

    // 🔐 FIXED: Now uses dynamic ACL permission check instead of hardcoded role names
    // Approval Board visible if user has 'approval_board_hr' permission
    if (canViewApprovalBoard) {
        links.push({
            label: (isRequesterOnly && !isAdmin) ? 'My Requests' : 'Approval Board',
            href: route('hr.manpower-requests.index'),
            active: route().current('hr.manpower-requests.index'),
        });
    }

    if (canViewFeedbackForm) {
        links.push({
            label: 'Feedback Form',
            href: route('hr.feedback.create'),
            active: route().current('hr.feedback.create'),
        });
    }

    return links;
};

export const getHRAdminLinks = (auth) => {
    const canViewHROverview = canViewModule(auth, 'hr_overview');
    const canViewDocumentRequests = canViewModule(auth, 'documents') || canApproveModule(auth, 'form_2316_approvals') || canViewHROverview;
    const canViewFeedbackForm = canViewModule(auth, 'feedback_form') || canViewHROverview;

    const links = [];

    if (canViewHROverview) {
        links.push({
            label: 'HR Module Overview',
            href: route('hr.index'),
            active: route().current('hr.index'),
        });
    }

    if (canViewDocumentRequests) {
        links.push({
            label: 'Pending Document Requests',
            href: route('hr.admin.index'),
            active: route().current('hr.admin.index'),
        });
    }

    if (canViewFeedbackForm) {
        links.push({
            label: 'Feedback Form Submissions',
            href: route('hr.feedback.index'),
            active: route().current('hr.feedback.index'),
        });
    }

    return links;
};

export const getPRPOLinks = (auth) => {
    // Safely grab the role and make it lowercase
    const userRole = auth?.user?.role?.name?.toLowerCase().trim() || '';

    // Hide PR/PO module if user has no prpo permissions
    if (!moduleHasAccess(auth, 'prpo')) return [];
    
    // 🔐 DYNAMIC ACL CHECKS: Use permission array instead of hardcoded roles
    const canCreatePR = hasPermission(auth, 'purchase_requests');
    const canViewApprovalBoard = hasPermission(auth, 'approval_board');
    const canViewPO = hasPermission(auth, 'purchase_orders');
    const canManageProducts = hasPermission(auth, 'products');

    const links = [];

    // 2. PR/PO Request - visible if user has purchase_requests permission
    if (canCreatePR) {
        links.push({ 
            label: 'PR Form', 
            href: route('prpo.purchase-requests.create'), 
            active: route().current('prpo.purchase-requests.*') 
        });
    }

    // 3. Approval Board - visible if user has approval_board permission
    if (canViewApprovalBoard) {
        links.push({ 
            label: 'Approval Board', 
            href: route('prpo.approval-board'), 
            active: route().current('prpo.approval-board') || route().current('prpo.purchase-requests.update-status') 
        });
    }

    // 4. PO Generation - visible if user has purchase_orders permission
    if (canViewPO) {
        links.push({ 
            label: 'PO Generation', 
            href: route('prpo.purchase-orders.index'), 
            active: route().current('prpo.purchase-orders.*') 
        });
    }

    // 1. Products Masterlist - visible if user has products permission
    if (canManageProducts) {
        links.push({ 
            label: 'Products Masterlist', 
            href: route('prpo.products.index'), 
            active: route().current('prpo.products.*') 
        });
    }

    return links;
};

// 🟢 FIXED: Changed schedule_view to canViewModule so standard staff can route to it
export const getFirstAttendanceRoute = (auth) => {
    if (canViewModule(auth, 'attendance_overview')) return route('attendance.overview');
    if (canViewModule(auth, 'attendance_calendar')) return route('attendance.calendar');
    if (canViewModule(auth, 'attendance_schedule_view')) return route('attendance.schedule-view');
    if (canEditModule(auth, 'attendance_setup')) return route('attendance.setup-schedule');
    return route('attendance.calendar'); // Fallback
};