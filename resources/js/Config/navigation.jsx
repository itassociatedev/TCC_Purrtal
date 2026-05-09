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

// Admin Module Links
export const getAdminLinks = (auth) => {
    const userRole = auth?.user?.role?.name?.toLowerCase().trim() || '';
    
    // Define the roles
    const isAdminOrDCSO = userRole === 'admin' || userRole === 'director of corporate services and operations';
    const isHRBP = userRole === 'hr business partner' || userRole === 'human resources business partner' || userRole === 'hrbp';
    const isHRAssistant = userRole === 'hr assistant' || userRole === 'human resources assistant'; // <-- Added HR Assistant check

    // We define these links as variables since they are shared between roles
    const announcementsLink = {
        label: 'Announcements & Notices',
        href: route('admin.announcements.index'),
        active: route().current('admin.announcements.*'),
    };

    const orgChartLink = { 
        label: 'Organizational Directory', 
        href: route('admin.org-chart.index'), 
        active: route().current('admin.org-chart.index') 
    };

    // 1. IF HRBP: Return ONLY the announcements link
    if (isHRBP && !isAdminOrDCSO) {
        return [
            announcementsLink,
            orgChartLink
        ];
    }

    // 2. IF HR ASSISTANT: Return Announcements and Org Chart
    if (isHRAssistant && !isAdminOrDCSO) {
        return [
            announcementsLink,
            orgChartLink
        ];
    }

    // 3. IF ADMIN or DCSO: Return ALL the links
    if (isAdminOrDCSO) {
        return [
            {
                label: 'Admin Overview',
                href: route('admin.dashboard'),
                active: route().current('admin.dashboard'),
            },
            announcementsLink, 
            {
                label: 'Employee Management',
                href: route('admin.employees'),
                active: route().current('admin.employees'),
            },
            {
                label: 'Company Content Management',
                href: route('admin.company-content.index'),
                active: route().current('admin.company-content.*'),
            },
            orgChartLink,
            // 🟢 NEW: RESOURCE LINKS POSITIONED HERE 🟢
            {
                label: 'Resource Links',
                href: route('admin.resource-links.index'),
                active: route().current('admin.resource-links.*'),
            },
            {
                label: 'System Logs & Security',
                href: route('admin.logs.index'),
                active: route().current('admin.logs.*'),
            },
        ];
    }

    // 4. Fallback: Return empty array for anyone else trying to access this function
    return [];
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
    // Extract the role safely from the auth object
    const userRole = auth?.user?.role?.name?.toLowerCase().trim() || '';
    const isAuditor = userRole.includes('audit');

    const links = [
         {
            label: 'Duty Meal Overview',
            href: route('admin.duty-meals.index'),
            active: route().current('admin.duty-meals.index'),
        }
    ];
    
    // Only inject the "Set Up Roster" link if they are NOT an auditor
    if (!isAuditor) {
        links.push({
            label: 'Set Up Roster',
            href: route('admin.duty-meals.create'),
            active: route().current('admin.duty-meals.create'),
        });
    }
   
    links.push({
        label: 'Duty Meal Archive',
        href: route('admin.duty-meals.archive'),
        active:  route().current('admin.duty-meals.archive'),
    });

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
    
    const userRole = (auth?.user?.role?.name || '').toLowerCase();
    const userPosition = (auth?.user?.position?.name || '').toLowerCase();
    
    // DEFENSIVE STRIPPING: Force string, lowercase it, and trim hidden spaces
    const normalizedRole = String(UserRole).toLowerCase().trim();

    // FIX 1: Add 'hrbp' to the isHRAdmin check so they can see HR Admin Overview
    const isHRAdmin = normalizedRole === 'admin' || normalizedRole === 'hr' || normalizedRole === 'hrbp' || userPosition === 'human resources';
    
    // STRICT CHECK: ONLY General Accounting allowed!
    const isAccounting = normalizedRole === 'general accounting';

    // 1. Base links
    const links = [
        {   
            label: 'Document Requests', 
            href: route('hr.index'), 
            active: route().current('hr.index') 
        },
        // --- General Accounting Link for Form 2316 ---
        ...(isAccounting || normalizedRole === 'admin' ? [
            { 
                label: 'Form 2316 Approvals', 
                href: route('hr.accounting.index'), 
                active: route().current('hr.accounting.index') 
            }
        ] : []),
        // --- HR Admin Overview ---
        ...(isHRAdmin ? [
            { 
                label: 'HR Admin Overview', 
                href: route('hr.admin.index'), 
                active: route().current('hr.admin.index') 
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
    
    // FIX 2: Create Link is visible to Everyone EXCEPT regular HR
    if (isAdmin || isHRBP || isRequesterOnly || isApprover) {
        links.push({
            label: 'Manpower Request Form',
            href: route('hr.manpower-requests.create'),
            active: route().current('hr.manpower-requests.create'),
        });
    }

    // Dashboard Link: Visible to Everyone (HR gets "Approval Board", TLs get "My Requests")
    if (isAdmin || isHR || isHRBP || isRequesterOnly || isApprover) {
        links.push({
            label: (isRequesterOnly && !isAdmin) ? 'My Requests' : 'Approval Board',
            href: route('hr.manpower-requests.index'),
            active: route().current('hr.manpower-requests.index'),
        });
    }

    // 5. Final link (Visible to everyone)
    links.push({ 
        label: 'Feedback Form', 
        href: route('hr.feedback.create'), 
        active: route().current('hr.feedback.create') 
    });
    
    return links;
};

export const getHRAdminLinks = (auth) => {
    return [
        { 
            label: 'HR Module Overview', 
            href: route('hr.index'),
            active: route().current('hr.index') 
        },
        { label: 'Pending Document Requests',
            href: route('hr.admin.index'),
            active: route().current('hr.admin.index') 
        },
        { label: 'Feedback Form Submissions', 
            href: route('hr.feedback.index'),
            active: route().current('hr.feedback.index')
        }
    ];
};

export const getPRPOLinks = (auth) => {
    // Safely grab the role and make it lowercase
    const userRole = auth?.user?.role?.name?.toLowerCase().trim() || '';
    
    // Define exact role clusters
    const isAdminOrDCSO = userRole === 'admin' || userRole.includes('director');
    const isProcurement = userRole.includes('procurement');
    const isInventory = userRole.includes('inventory');
    const isOM = userRole.includes('operations manager') || userRole.includes('operations');

    const links = [];

    // 2. PR/PO Request (Admin, DCSO, Procurement, Inventory)
    if (isAdminOrDCSO || isProcurement || isInventory || isOM) {
        links.push({ 
            label: 'PR Form', 
            href: route('prpo.purchase-requests.create'), 
            active: route().current('prpo.purchase-requests.*') 
        });
    }

    // 3. Approval Board (Admin, DCSO, Procurement, Inventory)
    if (isAdminOrDCSO || isProcurement || isInventory || isOM) {
        links.push({ 
            label: 'Approval Board', 
            href: route('prpo.approval-board'), 
            active: route().current('prpo.approval-board') || route().current('prpo.purchase-requests.update-status') 
        });
    }

    // 4. PO Generation 
    if (isAdminOrDCSO || isProcurement || isOM || isInventory) {
        links.push({ 
            label: 'PO Generation', 
            href: route('prpo.purchase-orders.index'), 
            active: route().current('prpo.purchase-orders.*') 
        });
    }

     // 1. Products Masterlist (ONLY Admin & DCSO)
    if (isAdminOrDCSO || isInventory) {
        links.push({ 
            label: 'Products Masterlist', 
            href: route('prpo.products.index'), 
            active: route().current('prpo.products.*') 
        });
    }

    if (!isAdminOrDCSO && !isProcurement && !isInventory && !isOM) {
        links.push({ 
            label: 'PR/PO Status', 
            href: route('prpo.status.index'), 
            active: route().current('prpo.status.*')
        });
    }

    return links;
};