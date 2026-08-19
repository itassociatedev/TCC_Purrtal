<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminACL extends Model
{
    protected $table = 'admin_acl';

    protected $fillable = [
        'role_id',
        'module',
        'permission_level', // 'full', 'view', 'edit', 'no_access'
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the role associated with this ACL entry.
     */
    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    /**
     * Permission level options with clear hierarchy.
     * 
     * 🔐 PERMISSION HIERARCHY:
     * 
     * 'full' = Create / Edit / Delete / Admin
     *   - Can create/request items
     *   - Can edit existing items
     *   - Can delete items
     *   - Can perform admin functions
     *   - Can approve/reject requests
     * 
     * 'edit' = Create / Approve / Reject (NO Delete)
     *   - Can create/request items
     *   - Can approve requests
     *   - Can reject requests
     *   - CANNOT edit existing items
     *   - CANNOT delete items
     *   - CANNOT perform admin functions
     * 
     * 'view' = Request and View Only
     *   - Can view/read data
     *   - Can submit requests
     *   - CANNOT create/edit
     *   - CANNOT approve/reject
     *   - CANNOT delete
     * 
     * 'no_access' = No access
     *   - No access to module at all
     */
    public static function permissionLevels()
    {
        return [
            'full' => 'Full (Create / Edit / Delete / Admin)',
            'edit' => 'Edit (Create / Approve / Reject)',
            'view' => 'View (Request and View Only)',
            'no_access' => 'No Access',
        ];
    }

    /**
     * Get all modules.
     */
    public static function modules()
    {
        return [
            'admin_overview' => 'Admin Overview',
            'employees' => 'Employee Management',
            'company_content' => 'Company Content Management',
            'resource_links' => 'Resource Links',
            'announcements' => 'Announcements & Notices',
            'documents' => 'Document Requests',
            'system_logs' => 'System Logs & Security',
            'org_chart' => 'Organizational Directory',
            'hr_overview' => 'HR Overview',
            'duty_meal' => 'Duty Meal Management',
            'duty_meal_setup_roster' => 'Set Up Roster',
            'duty_meal_archive' => 'Duty Meal Archive',
            'access_control' => 'Access Control',
            'form_2316_approvals' => 'Form 2316 Approvals',
            'manpower_requests_form' => 'Manpower Request Form',
            'approval_board_hr' => 'Approval Board',
            'feedback_form' => 'Feedback Form',
            'products' => 'Products Masterlist',
            'purchase_requests' => 'Purchase Requests',
            'approval_board' => 'Approval Board',
            'purchase_orders' => 'Purchase Orders',
            // 🟢 ADDED: Attendance Modules
            'attendance_overview' => 'Attendance Overview',
            'attendance_setup' => 'Setup Schedule',
            'attendance_schedule_view' => 'Schedule View',
            'attendance_calendar' => 'Calendar',
        ];
    }

    /**
     * Get modules grouped by top-level section.
     */
    public static function groupedModules()
    {
        return [
            'Admin Module' => [
                'admin_overview' => 'Admin Overview',
                'attendance_settings' => 'Attendance Settings',
                'announcements' => 'Announcements & Notices',
                'employees' => 'Employee Management',
                'company_content' => 'Company Content Management',
                'org_chart' => 'Organizational Directory',
                'resource_links' => 'Resource Links',
                'system_logs' => 'System Logs & Security',
                'access_control' => 'Access Control',
            ],
            'HR Module' => [
                'hr_overview' => 'HR Overview',
                'documents' => 'Document Requests',
                'form_2316_approvals' => 'Form 2316 Approvals',
                'manpower_requests_form' => 'Manpower Request Form',
                'approval_board_hr' => 'Approval Board',
                'feedback_form' => 'Feedback Form',
            ],
            'Duty Meal Module' => [
                'duty_meal' => 'Duty Meal Management',
                'duty_meal_setup_roster' => 'Set Up Roster',
                'duty_meal_archive' => 'Duty Meal Archive',
            ],
            // 🟢 ADDED: Attendance Group
            'Attendance Module' => [
                'attendance_overview' => 'Attendance Overview',
                'attendance_setup' => 'Setup Schedule',
                'attendance_schedule_view' => 'Schedule View',
                'attendance_calendar' => 'Calendar',
            ],
            'PR/PO Module' => [
                'products' => 'Products Masterlist',
                'purchase_requests' => 'Purchase Requests',
                'approval_board' => 'Approval Board',
                'purchase_orders' => 'Purchase Orders',
            ],
        ];
    }
}