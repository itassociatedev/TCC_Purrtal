<?php

/**
 * Admin Module Access Control List (ACL)
 * 
 * Defines which roles have access to which admin modules.
 * Each admin module can be accessed by specific roles.
 */

return [
    /**
     * Admin modules and their allowed roles
     * Format: 'module' => ['role1', 'role2', ...]
     */
    'modules' => [
        'admin_overview' => [
            'admin',
            'director of corporate services and operations',
            'hrbp',
        ],
        'employees' => [
            'admin',
            'director of corporate services and operations',
            'hrbp',
        ],
        'duty_meal' => [
            'admin',
            'director of corporate services and operations',
            'duty meal custodian',
            'hrbp',
            'hr assistant',
        ],
        'duty_meal_setup_roster' => [
            'admin',
            'director of corporate services and operations',
            'duty meal custodian',
            'hrbp',
            'hr assistant',
        ],
        'duty_meal_archive' => [
            'admin',
            'director of corporate services and operations',
            'duty meal custodian',
            'hrbp',
            'hr assistant',
        ],
        'documents' => [
            'admin',
            'director of corporate services and operations',
            'hrbp',
        ],
        'announcements' => [
            'admin',
            'director of corporate services and operations',
            'hrbp',
        ],
        'org_chart' => [
            'admin',
            'director of corporate services and operations',
            'hrbp',
        ],
        'company_content' => [
            'admin',
            'director of corporate services and operations',
            'hrbp',
        ],
        'resource_links' => [
            'admin',
            'director of corporate services and operations',
            'hrbp',
        ],
        'system_logs' => [
            'admin',
        ],
        'access_control' => [
            'admin',
            'director of corporate services and operations',
            'director of corporate sales and operations',
        ],
        'form_2316_approvals' => [
            'admin',
            'hrbp',
            'general accounting',
        ],
        'manpower_requests_form' => [
            'admin',
            'hrbp',
            'operations manager',
            'procurement tl',
            'inventory tl',
            'director of corporate services and operations',
        ],
        'approval_board_hr' => [
            'admin',
            'hrbp',
            'operations manager',
            'procurement tl',
            'inventory tl',
            'director of corporate services and operations',
        ],
        'feedback_form' => [
            'admin',
            'hrbp',
            'hr assistant',
            'general accounting',
        ],
        'products' => [
            'admin',
            'director of corporate services and operations',
            'procurement tl',
            'inventory tl',
            'operations manager',
            'hrbp',
        ],
        'suppliers' => [
            'admin',
            'director of corporate services and operations',
            'procurement tl',
            'inventory tl',
            'operations manager',
            'hrbp',
        ],
        'purchase_requests' => [
            'admin',
            'director of corporate services and operations',
            'procurement tl',
            'inventory tl',
            'operations manager',
            'hrbp',
        ],
        'approval_board' => [
            'admin',
            'director of corporate services and operations',
            'procurement tl',
            'inventory tl',
            'operations manager',
            'hrbp',
        ],
        'purchase_orders' => [
            'admin',
            'director of corporate services and operations',
            'procurement tl',
            'inventory tl',
            'operations manager',
            'hrbp',
        ],
        'prpo_status' => [
            'admin',
            'director of corporate services and operations',
            'procurement tl',
            'inventory tl',
            'operations manager',
            'hrbp',
        ],
        
        // 🟢 FIXED: Attendance Modules officially registered in the Backend Config
        'attendance_overview' => [
            'admin',
            'director of corporate services and operations',
            'hrbp',
            'hr',
        ],
        'attendance_setup' => [
            'admin',
            'director of corporate services and operations',
            'hrbp',
            'hr',
        ],
        'attendance_schedule_view' => [
            'admin',
            'director of corporate services and operations',
            'hrbp',
            'hr',
        ],
        'attendance_calendar' => [
            'admin',
            'director of corporate services and operations',
            'hrbp',
            'hr',
        ],
        'attendance_settings' => [
            'admin',
            'director of corporate services and operations',
        ],
    ],

    /**
     * Default role that always has access (superadmin)
     */
    'superadmin_role' => 'admin',

    /**
     * Whether to use case-insensitive role matching
     */
    'case_insensitive' => true,

    /**
     * Fallback message when access is denied
     */
    'unauthorized_message' => 'You do not have permission to access this admin module.',
];