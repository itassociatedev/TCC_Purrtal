import React, { useState, useEffect } from 'react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head, router, usePage } from '@inertiajs/react';
import { getAdminLinks, canEditModule } from '@/Config/navigation';
import ConfirmModal from '@/Components/ConfirmModal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';

/**
 * Normalize permission values to standard lowercase format
 * Handles UI strings and database strings interchangeably:
 * "FULL" / "Full" / "Full Access" → "full"
 * "WRITE" / "EDIT" / "Edit" → "edit"
 * "VIEW" / "View" → "view"
 * "NONE" / "No Access" / "no_access" → "no_access"
 */
const normalizePermissionValue = (value) => {
    if (!value) return 'no_access';
    const normalized = value.toString().trim().toUpperCase();
    if (normalized.includes('FULL')) return 'full';
    if (normalized.includes('WRITE') || normalized.includes('EDIT')) return 'edit';
    if (normalized.includes('VIEW')) return 'view';
    return 'no_access';
};

/**
 * Check if a module should be visible based on normalized permission logic
 * Ensures both UI display labels and database values are handled consistently
 */
const shouldModuleBeVisible = (permissionLevel) => {
    const normalized = normalizePermissionValue(permissionLevel);
    return normalized !== 'no_access';
};

const PermissionBadge = ({ level, onClick, disabled }) => {
    // Normalize level to handle any permission value format
    const normalizedLevel = normalizePermissionValue(level);
    
    const colors = {
        full: 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-300',
        edit: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-300',
        view: 'bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-300',
        no_access: 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-300',
    };

    const labels = {
        full: 'Full',
        edit: 'Edit',
        view: 'View',
        no_access: 'No Access',
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex h-9 w-28 items-center justify-center whitespace-nowrap rounded text-sm font-medium transition ${
                colors[normalizedLevel]
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            {labels[normalizedLevel]}
        </button>
    );
};

const PermissionSelector = ({ currentLevel, onChange, disabled }) => {
    // Normalize currentLevel to handle any permission value format
    const normalizedCurrentLevel = normalizePermissionValue(currentLevel);
    const [isOpen, setIsOpen] = useState(false);
    const levels = ['full', 'edit', 'view', 'no_access'];

    const toggleOpen = () => {
        if (disabled) {
            return;
        }
        setIsOpen((prev) => !prev);
    };

    return (
        <div className="relative inline-block w-full">
            <PermissionBadge
                level={normalizedCurrentLevel}
                onClick={toggleOpen}
                disabled={disabled}
            />
            {isOpen && !disabled && (
                <div className="absolute top-full mt-1 bg-white border border-gray-300 rounded shadow-lg z-10 w-24">
                    {levels.map((level) => (
                        <button
                            key={level}
                            onClick={() => {
                                onChange(level);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 hover:bg-gray-100 text-sm ${
                                normalizedCurrentLevel === level ? 'bg-blue-50 font-semibold' : ''
                            }`}
                        >
                            {level === 'full'
                                ? 'Full'
                                : level === 'edit'
                                ? 'Edit'
                                : level === 'view'
                                ? 'View'
                                : 'No Access'}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const ADMIN_MODULE_KEY = 'admin_overview';
const getPermissionKey = (roleId, module) => `${roleId}||${module}`;

const isAdminRoleName = (roleName) => normalizeText(roleName) === 'admin';
const isDcsORoleName = (roleName) => [
    'director of corporate sales and operations',
    'director of corporate services and operations',
    'dcso'
].includes(normalizeText(roleName));

const isAdminOrDcsORoleName = (roleName) => isAdminRoleName(roleName) || isDcsORoleName(roleName);

const flattenAclMatrix = (matrix) => {
    return Object.entries(matrix).reduce((acc, [roleId, roleData]) => {
        const roleIsAdminOrDCSO = isAdminOrDcsORoleName(roleData.role_name);
        Object.entries(roleData.permissions || {}).forEach(([module, level]) => {
            // Normalize all permission values to ensure consistency across the component
            // This prevents string mismatches like "FULL" vs "full" or "WRITE" vs "edit"
            const normalizedLevel = roleIsAdminOrDCSO ? 'full' : normalizePermissionValue(level);
            acc[getPermissionKey(roleId, module)] = normalizedLevel;
        });
        return acc;
    }, {});
};

const roleAbbreviationMap = {
    'director of corporate sales and operations': 'DCSO',
    'director of corporate services and operations': 'DCSO',
};

const POSITION_ROLE_MAP = {
    DCSO: [
        'Director of Corporate Sales and Operations',
        'Director of Corporate Services and Operations',
    ],
};

const normalizeText = (text) => text?.toString().trim().toLowerCase() || '';

const abbreviationForRole = (roleName) => {
    if (!roleName) {
        return '';
    }

    const lookupKey = normalizeText(roleName);
    return roleAbbreviationMap[lookupKey] ?? roleName;
};

const aclDefaultPermissions = {
  Admin: {
    'Admin Overview': 'FULL',
    'Announcements & Notices': 'FULL',
    'Employee Management': 'FULL',
    'Company Content Management': 'FULL',
    'Organizational Directory': 'FULL',
    'Resource Links': 'FULL',
    'System Logs & Security': 'FULL',
    'Document Requests': 'FULL',
    'Form 2316 Approval': 'FULL',
    'Manpower Request Form': 'FULL',
    'Approval Board': 'FULL',
    'Feedback Form': 'FULL',
    'PR Form': 'FULL',
    'PR Approval Board': 'FULL',
    'PO Generation': 'FULL',
    'Products Masterlist': 'FULL',
    'Duty Meal Overview': 'FULL',
    'Set Up Roster': 'FULL',
    'Duty meal Archive': 'FULL',
  },
  DCSO: {
    'Admin Overview': 'FULL',
    'Announcements & Notices': 'FULL',
    'Employee Management': 'FULL',
    'Company Content Management': 'FULL',
    'Organizational Directory': 'FULL',
    'Resource Links': 'FULL',
    'System Logs & Security': 'FULL',
    'Document Requests': 'FULL',
    'Form 2316 Approval': 'FULL',
    'Manpower Request Form': 'FULL',
    'Approval Board': 'FULL',
    'Feedback Form': 'FULL',
    'PR Form': 'FULL',
    'PR Approval Board': 'FULL (Track only and notif based on WF)',
    'PO Generation': 'FULL (Track only and notif based on WF)',
    'Products Masterlist': 'FULL',
    'Duty Meal Overview': 'FULL',
    'Set Up Roster': 'FULL',
    'Duty meal Archive': 'FULL',
  },
  HRBP: {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'FULL',
    'Employee Management': 'NONE',
    'Company Content Management': 'FULL',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'FULL',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'FULL',
    'Approval Board': 'FULL',
    'Feedback Form': 'FULL',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW(CC)',
    'PO Generation': 'NONE',
    'Products Masterlist': 'NONE',
    'Duty Meal Overview': 'NONE',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'NONE',
  },
  HR: {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'FULL',
    'Employee Management': 'NONE',
    'Company Content Management': 'FULL',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'FULL',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'FULL',
    'Approval Board': 'FULL',
    'Feedback Form': 'FULL',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW(CC)',
    'PO Generation': 'NONE',
    'Products Masterlist': 'NONE',
    'Duty Meal Overview': 'NONE',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'NONE',
  },
  'HR Assistant': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'FULL',
    'Employee Management': 'NONE',
    'Company Content Management': 'FULL',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'FULL',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'FULL',
    'Approval Board': 'FULL',
    'Feedback Form': 'FULL',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW(CC)',
    'PO Generation': 'NONE',
    'Products Masterlist': 'NONE',
    'Duty Meal Overview': 'NONE',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'NONE',
  },
  'Operations Manager': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'WRITE',
    'Approval Board': 'VIEW',
    'Feedback Form': 'WRITE',
    'PR Form': 'NONE',
    'PR Approval Board': 'FULL',
    'PO Generation': 'NONE',
    'Products Masterlist': 'NONE',
    'Duty Meal Overview': 'NONE',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'NONE',
  },
  'Chief Vet': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'WRITE',
    'Approval Board': 'VIEW',
    'Feedback Form': 'WRITE',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW(CC)',
    'PO Generation': 'NONE',
    'Products Masterlist': 'NONE',
    'Duty Meal Overview': 'NONE',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'NONE',
  },
  'Vet Tech TL': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'WRITE',
    'Approval Board': 'VIEW',
    'Feedback Form': 'WRITE',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW(CC)',
    'PO Generation': 'NONE',
    'Products Masterlist': 'NONE',
    'Duty Meal Overview': 'NONE',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'NONE',
  },
  'Clinic Assistant TL': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'WRITE',
    'Approval Board': 'VIEW',
    'Feedback Form': 'WRITE',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW(CC)',
    'PO Generation': 'NONE',
    'Products Masterlist': 'NONE',
    'Duty Meal Overview': 'NONE',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'NONE',
  },
  'Cashier TL': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'WRITE',
    'Approval Board': 'VIEW',
    'Feedback Form': 'WRITE',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW(CC)',
    'PO Generation': 'NONE',
    'Products Masterlist': 'NONE',
    'Duty Meal Overview': 'NONE',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'NONE',
  },
  'Inventory TL': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'WRITE',
    'Approval Board': 'VIEW',
    'Feedback Form': 'WRITE',
    'PR Form': 'FULL',
    'PR Approval Board': 'FULL',
    'PO Generation': 'VIEW',
    'Products Masterlist': 'VIEW',
    'Duty Meal Overview': 'NONE',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'NONE',
  },
  'Inventory Assistant': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'NONE',
    'Approval Board': 'NONE',
    'Feedback Form': 'WRITE',
    'PR Form': 'WRITE',
    'PR Approval Board': 'VIEW',
    'PO Generation': 'VIEW',
    'Products Masterlist': 'VIEW',
    'Duty Meal Overview': 'NONE',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'NONE',
  },
  'Housekeeping TL': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'WRITE',
    'Approval Board': 'VIEW',
    'Feedback Form': 'WRITE',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW(CC)',
    'PO Generation': 'NONE',
    'Products Masterlist': 'NONE',
    'Duty Meal Overview': 'FULL',
    'Set Up Roster': 'FULL',
    'Duty meal Archive': 'FULL',
  },
  'Marketing Manager': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'WRITE',
    'Approval Board': 'VIEW',
    'Feedback Form': 'WRITE',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW(CC)',
    'PO Generation': 'NONE',
    'Products Masterlist': 'NONE',
    'Duty Meal Overview': 'NONE',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'NONE',
  },
  'Procurement TL': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'WRITE',
    'Approval Board': 'VIEW',
    'Feedback Form': 'WRITE',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW',
    'PO Generation': 'FULL',
    'Products Masterlist': 'FULL',
    'Duty Meal Overview': 'NONE',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'NONE',
  },
  'Procurement Assistant': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'NONE',
    'Approval Board': 'NONE',
    'Feedback Form': 'WRITE',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW',
    'PO Generation': 'FULL',
    'Products Masterlist': 'FULL',
    'Duty Meal Overview': 'VIEW',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'VIEW',
  },
  'Auditor TL': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'WRITE',
    'Approval Board': 'VIEW',
    'Feedback Form': 'WRITE',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW',
    'PO Generation': 'VIEW',
    'Products Masterlist': 'VIEW',
    'Duty Meal Overview': 'VIEW',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'VIEW',
  },
  'Audit Assist': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'NONENONE',
    'Approval Board': 'NONENONE',
    'Feedback Form': 'WRITE',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW',
    'PO Generation': 'VIEW',
    'Products Masterlist': 'NONE',
    'Duty Meal Overview': 'NONE',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'NONE',
  },
  'General Accounting': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'FULL',
    'Manpower Request Form': 'WRITE',
    'Approval Board': 'VIEW',
    'Feedback Form': 'WRITE',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW(CC)',
    'PO Generation': 'NONE',
    'Products Masterlist': 'NONE',
    'Duty Meal Overview': 'NONE',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'NONE',
  },
  'IT TL': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'NONENONE',
    'Approval Board': 'NONENONE',
    'Feedback Form': 'WRITE',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW(CC)',
    'PO Generation': 'NONE',
    'Products Masterlist': 'NONE',
    'Duty Meal Overview': 'FULL',
    'Set Up Roster': 'FULL',
    'Duty meal Archive': 'FULL',
  },
  'Duty Meal Custodian': {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'WRITE',
    'Approval Board': 'VIEW',
    'Feedback Form': 'WRITE',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW(CC)',
    'PO Generation': 'NONE',
    'Products Masterlist': 'NONE',
    'Duty Meal Overview': 'NONE',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'NONE',
  },
  Employee: {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'NONENONE',
    'Approval Board': 'NONENONE',
    'Feedback Form': 'WRITE',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW(CC)',
    'PO Generation': 'NONE',
    'Products Masterlist': 'NONE',
    'Duty Meal Overview': 'FULL',
    'Set Up Roster': 'FULL',
    'Duty meal Archive': 'FULL',
  },
  Intern: {
    'Admin Overview': 'NONE',
    'Announcements & Notices': 'NONE',
    'Employee Management': 'NONE',
    'Company Content Management': 'NONE',
    'Organizational Directory': 'NONE',
    'Resource Links': 'NONE',
    'System Logs & Security': 'NONE',
    'Document Requests': 'WRITE',
    'Form 2316 Approval': 'NONE',
    'Manpower Request Form': 'NONENONE',
    'Approval Board': 'NONENONE',
    'Feedback Form': 'WRITE',
    'PR Form': 'NONE',
    'PR Approval Board': 'VIEW(CC)',
    'PO Generation': 'NONE',
    'Products Masterlist': 'NONE',
    'Duty Meal Overview': 'NONE',
    'Set Up Roster': 'NONE',
    'Duty meal Archive': 'NONE',
  },
};

const DEFAULT_ACL_SETTINGS = aclDefaultPermissions;
const DEFAULT_MATRIX = aclDefaultPermissions;

const normalizeDefaultPermission = (permission) => {
  return normalizePermissionValue(permission);
};

const PERMISSION_RULES = {
    full: ['Create', 'Edit', 'Delete', 'Admin capabilities'],
    edit: ['Create', 'Approve', 'Reject'],
    view: ['Request', 'View only'],
    no_access: [],
};

const getPermissionRuleLabel = (level) => {
    const rules = PERMISSION_RULES[level] || [];
    return rules.length ? rules.join(' / ') : 'No access';
};

const MODULE_NAME_KEY_OVERRIDES = {
  'form 2316 approval': 'form_2316_approvals',
  'form 2316 approvals': 'form_2316_approvals',
  'pr approval board': 'approval_board',
  'approval board': 'approval_board_hr',
  'po generation': 'purchase_orders',
  'purchase orders': 'purchase_orders',
  'pr form': 'purchase_requests',
  'purchase requests': 'purchase_requests',
  'pr/po status': 'prpo_status',
  'duty meal archive': 'duty_meal_archive',
  'duty meal management': 'duty_meal',
  'duty meal overview': 'duty_meal',
  'set up roster': 'duty_meal_setup_roster',
  'supplier management': 'suppliers',
};

const POSITION_ORDER = [
    'Admin',
    'DCSO',
    'HRBP',
    'HR',
    'HR Assistant',
    'Operations Manager',
    'Chief Vet',
    'Vet Tech TL',
    'Clinic Assistant TL',
    'Cashier TL',
    'Inventory TL',
    'Inventory Assistant',
    'Housekeeping TL',
    'Marketing Manager',
    'Procurement TL',
    'Procurement Assistant',
    'Auditor TL',
    'Audit Assist',
    'General Accounting',
    'IT TL',
    'Duty Meal Custodian',
    'Employee',
    'Intern',
];

const getPositionSortOrder = (roleName) => {
    if (!roleName) return Number.MAX_SAFE_INTEGER;

    // Use the abbreviation (display name) to match against POSITION_ORDER
    const abbrev = abbreviationForRole(roleName);
    const normalizedAbbrev = normalizeText(abbrev);
    const positionIndex = POSITION_ORDER.findIndex((position) => normalizeText(position) === normalizedAbbrev);

    return positionIndex === -1 ? Number.MAX_SAFE_INTEGER : positionIndex;
};

const sortRolesByPositionOrder = (roles = []) => {
    return [...roles].sort((a, b) => {
        const orderA = getPositionSortOrder(a?.name);
        const orderB = getPositionSortOrder(b?.name);

        if (orderA !== orderB) {
            return orderA - orderB;
        }

        return normalizeText(a?.name || '').localeCompare(normalizeText(b?.name || ''));
    });
};

const roleMatchesQuery = (roleName, query) => {
    if (!roleName || !query) {
        return true;
    }

    const normalizedRole = normalizeText(roleName);
    const normalizedAbbrev = normalizeText(roleAbbreviationMap[normalizedRole] || '');
    const nq = normalizeText(query);
    const queryWords = nq.split(/\s+/).filter(Boolean);
    const roleWords = normalizedRole.split(/\s+/).filter(Boolean);

    const exactRoleMatch = normalizedRole === nq;
    const exactAbbrevMatch = normalizedAbbrev && normalizedAbbrev === nq;
    const allWordsMatchRole = queryWords.every((word) => roleWords.includes(word));
    const allWordsMatchAbbrev = normalizedAbbrev && queryWords.every((word) => normalizedAbbrev.includes(word));

    return exactRoleMatch || exactAbbrevMatch || allWordsMatchRole || allWordsMatchAbbrev;
};

const parsePermissionKey = (key) => {
    const [roleId, module] = key.split('||');
    return { roleId, module };
};

/**
 * MultiSelectPositionDropdown Component
 * Allows users to select multiple positions using checkboxes in a dropdown
 */
const MultiSelectPositionDropdown = ({
    allPositions,
    selectedPositions,
    onSelectionChange,
    disabled,
    label = 'Positions',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = React.useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const handleSelectAll = (checked) => {
        if (checked) {
            onSelectionChange(allPositions);
        } else {
            onSelectionChange([]);
        }
    };

    const handleTogglePosition = (position) => {
        if (selectedPositions.includes(position)) {
            onSelectionChange(selectedPositions.filter((p) => p !== position));
        } else {
            onSelectionChange([...selectedPositions, position]);
        }
    };

    const allSelected = selectedPositions.length === allPositions.length && allPositions.length > 0;
    const someSelected = selectedPositions.length > 0 && !allSelected;

    return (
        <div className="relative inline-block w-full" ref={dropdownRef}>
            {/* Dropdown Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full px-4 py-2 text-left text-sm font-medium rounded-md border border-gray-300 shadow-sm bg-white flex items-center justify-between transition ${
                    disabled
                        ? 'opacity-50 cursor-not-allowed bg-gray-50'
                        : 'hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                }`}
            >
                <span className="truncate">
                    {selectedPositions.length === 0
                        ? `Select ${label.toLowerCase()}...`
                        : `${selectedPositions.length} ${label.toLowerCase()} selected`}
                </span>
                <span className={`transform transition ${isOpen ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </button>

            {/* Dropdown Menu */}
            {isOpen && !disabled && (
                <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-gray-300 rounded-md shadow-lg">
                    {/* Select All Option */}
                    <div className="border-b border-gray-200 p-2">
                        <label className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                ref={(el) => {
                                    if (el) {
                                        el.indeterminate = someSelected;
                                    }
                                }}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                            />
                            <span className="text-sm font-semibold text-gray-900">
                                {allSelected ? 'Deselect All' : 'Select All'}
                            </span>
                        </label>
                    </div>

                    {/* Position Options */}
                    <div className="max-h-72 overflow-y-auto">
                        {allPositions.map((position) => (
                            <label
                                key={position}
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedPositions.includes(position)}
                                    onChange={() => handleTogglePosition(position)}
                                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                />
                                <span className="text-sm text-gray-700 flex-1 truncate">{position}</span>
                            </label>
                        ))}
                    </div>

                    {/* Footer with Action Buttons */}
                    <div className="border-t border-gray-200 p-3 flex gap-2">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="flex-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition"
                        >
                            Done
                        </button>
                        {selectedPositions.length > 0 && (
                            <button
                                onClick={() => {
                                    onSelectionChange([]);
                                    setIsOpen(false);
                                }}
                                className="flex-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function AccessControl({ roles, modules, groupedModules, aclMatrix, permissionLevels }) {
    const { flash, auth } = usePage().props;
    const adminLinks = getAdminLinks(auth);
    const [permissions, setPermissions] = useState(() => flattenAclMatrix(aclMatrix));
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [expandedSections, setExpandedSections] = useState([]);
    const [tabSearchQueries, setTabSearchQueries] = useState(() =>
        Object.keys(groupedModules || {}).reduce((acc, sectionTitle) => {
            acc[sectionTitle] = '';
            return acc;
        }, {})
    );
    const [selectedResetPosition, setSelectedResetPosition] = useState(
        Object.keys(DEFAULT_ACL_SETTINGS)[0] || ''
    );
    const [selectedResetPositions, setSelectedResetPositions] = useState([]);
    const [confirmResetOpen, setConfirmResetOpen] = useState(false);
    const [confirmBulkSelectedOpen, setConfirmBulkSelectedOpen] = useState(false);
    const [confirmBulkAllOpen, setConfirmBulkAllOpen] = useState(false);

    const canEditAccessControl = canEditModule(auth, 'access_control');

    const updateTabSearch = (sectionTitle, value) => {
        setTabSearchQueries((prev) => ({
            ...prev,
            [sectionTitle]: value,
        }));
    };

    const getModuleKeyByDisplayName = (displayName) => {
        const normalizedTarget = normalizeText(displayName);
        if (MODULE_NAME_KEY_OVERRIDES[normalizedTarget]) {
            return MODULE_NAME_KEY_OVERRIDES[normalizedTarget];
        }

        for (const sectionModules of Object.values(groupedModules || {})) {
            for (const [moduleKey, moduleName] of Object.entries(sectionModules)) {
                if (normalizeText(moduleName) === normalizedTarget) {
                    return moduleKey;
                }
            }
        }

        // Fallback: try substring matches (loose matching)
        for (const sectionModules of Object.values(groupedModules || {})) {
            for (const [moduleKey, moduleName] of Object.entries(sectionModules)) {
                const nm = normalizeText(moduleName);
                if (nm.includes(normalizedTarget) || normalizedTarget.includes(nm)) {
                    return moduleKey;
                }
            }
        }

        return null;
    };

    const roleMatchesPosition = (role, positionName) => {
        if (!role || !positionName) return false;
        const rn = normalizeText(role.name);
        const pn = normalizeText(positionName);
        const abbrev = normalizeText(abbreviationForRole(role.name));

        return rn === pn || abbrev === pn || pn.includes(abbrev) || abbrev.includes(pn);
    };

    const getAccessControlPermissionForRole = (roleName) => {
        return isAdminOrDcsORoleName(roleName) ? 'full' : 'no_access';
    };

    const handleResetToDefault = (positionName) => {
        const defaults = DEFAULT_MATRIX[positionName] || DEFAULT_ACL_SETTINGS[positionName];
        if (!positionName || !defaults) {
            return { permissionsArray: [], missingModules: [] };
        }

        const permissionsArray = [];
        const missingModules = [];

        roles.forEach((role) => {
            if (!roleMatchesPosition(role, positionName)) {
                return;
            }

            let hasAccessControl = false;

            Object.entries(defaults).forEach(([displayModuleName, defaultValue]) => {
                const moduleKey = getModuleKeyByDisplayName(displayModuleName);
                if (!moduleKey) {
                    missingModules.push(displayModuleName);
                    return;
                }

                if (moduleKey === 'access_control') {
                    hasAccessControl = true;
                }

                const newLevel = moduleKey === 'access_control'
                    ? getAccessControlPermissionForRole(role.name)
                    : normalizeDefaultPermission(defaultValue);

                permissionsArray.push({
                    role_id: role.id,
                    module: moduleKey,
                    permission_level: newLevel,
                });
            });

            if (!hasAccessControl) {
                permissionsArray.push({
                    role_id: role.id,
                    module: 'access_control',
                    permission_level: getAccessControlPermissionForRole(role.name),
                });
            }
        });

        return { permissionsArray, missingModules };
    };

    const handleResetClick = () => {
        if (!canEditAccessControl || !selectedResetPosition) {
            return;
        }
        setConfirmResetOpen(true);
    };

    const confirmResetClick = () => {
        setConfirmResetOpen(false);

        const { permissionsArray, missingModules } = handleResetToDefault(selectedResetPosition);
        if (!permissionsArray.length) {
            const messageText = missingModules.length
                ? `Unable to apply default reset because the following modules were not recognized: ${missingModules.join(', ')}`
                : `No matching role found for ${selectedResetPosition}.`;
            setMessage({ type: 'error', text: messageText });
            setTimeout(() => setMessage(null), 3500);
            return;
        }

        router.post(route('admin.access-control.bulk-update'), {
            permissions: permissionsArray,
        });
    };

    const handleBulkResetAll = () => {
        if (!canEditAccessControl) {
            return;
        }
        setConfirmBulkAllOpen(true);
    };

    const confirmBulkResetAll = () => {
        setConfirmBulkAllOpen(false);

        const allPositions = Object.keys(DEFAULT_ACL_SETTINGS);
        setLoading(true);

        // Collect permissions for ALL positions
        let allPermissionsArray = [];
        let allMissingModules = [];

        allPositions.forEach((positionName) => {
            const { permissionsArray, missingModules } = handleResetToDefault(positionName);
            allPermissionsArray = allPermissionsArray.concat(permissionsArray);
            allMissingModules = allMissingModules.concat(missingModules);
        });

        if (!allPermissionsArray.length) {
            const messageText = allMissingModules.length
                ? `Unable to apply bulk reset because the following modules were not recognized: ${allMissingModules.join(', ')}`
                : 'No matching roles found for bulk reset.';
            setMessage({ type: 'error', text: messageText });
            setLoading(false);
            setTimeout(() => setMessage(null), 3500);
            return;
        }

        // Send all permissions to the server
        router.post(route('admin.access-control.bulk-update'), {
            permissions: allPermissionsArray,
        }, {
            onSuccess: () => {
                setMessage({
                    type: 'success',
                    text: `All ${allPositions.length} positions successfully reverted to default master settings.`
                });
                setTimeout(() => setMessage(null), 4000);
                router.reload();
            },
            onFinish: () => setLoading(false),
        });
    };

    const handleBulkResetSelected = () => {
        if (!canEditAccessControl || selectedResetPositions.length === 0) {
            return;
        }
        setConfirmBulkSelectedOpen(true);
    };

    const confirmBulkResetSelected = () => {
        setConfirmBulkSelectedOpen(false);

        if (selectedResetPositions.length === 0) {
            return;
        }

        const positionCount = selectedResetPositions.length;
        setLoading(true);

        // Collect permissions for SELECTED positions only
        let selectedPermissionsArray = [];
        let selectedMissingModules = [];

        selectedResetPositions.forEach((positionName) => {
            const { permissionsArray, missingModules } = handleResetToDefault(positionName);
            selectedPermissionsArray = selectedPermissionsArray.concat(permissionsArray);
            selectedMissingModules = selectedMissingModules.concat(missingModules);
        });

        if (!selectedPermissionsArray.length) {
            const messageText = selectedMissingModules.length
                ? `Unable to apply reset because the following modules were not recognized: ${selectedMissingModules.join(', ')}`
                : 'No matching roles found for selected positions.';
            setMessage({ type: 'error', text: messageText });
            setLoading(false);
            setTimeout(() => setMessage(null), 3500);
            return;
        }

        // Send selected permissions to the server
        router.post(route('admin.access-control.bulk-update'), {
            permissions: selectedPermissionsArray,
        }, {
            onSuccess: () => {
                setMessage({
                    type: 'success',
                    text: `${positionCount} position${positionCount === 1 ? '' : 's'} successfully reverted to default master settings.`
                });
                setSelectedResetPositions([]);
                setTimeout(() => setMessage(null), 4000);
                router.reload();
            },
            onFinish: () => setLoading(false),
        });
    };

    useEffect(() => {
        if (flash?.success) {
            setMessage({ type: 'success', text: flash.success });
            setTimeout(() => setMessage(null), 3000);
        }
    }, [flash]);

    useEffect(() => {
        setPermissions(flattenAclMatrix(aclMatrix));
    }, [aclMatrix]);

    const toggleSection = (sectionTitle) => {
        setExpandedSections((prev) =>
            prev.includes(sectionTitle)
                ? prev.filter((section) => section !== sectionTitle)
                : [...prev, sectionTitle]
        );
    };

    const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

    const handlePermissionChange = (roleId, module, newLevel, roleName) => {
        if (isAdminRoleName(roleName)) {
            return;
        }

        const permissionKey = getPermissionKey(roleId, module);
        const normalizedLevel = normalizePermissionValue(newLevel);

        // Create a fresh deep object copy to ensure React detects the state change
        // This is critical for modules like "Admin Overview" and "Form 2316 Approval"
        // that depend on permission value normalization
        setPermissions((prev) => {
            const updated = { ...prev };
            updated[permissionKey] = normalizedLevel;
            return updated;
        });
    };

    const handleSaveAll = async () => {
        setLoading(true);
        const permissionsArray = Object.entries(permissions).reduce((acc, [key, level]) => {
            const { roleId, module } = parsePermissionKey(key);
            const role = roles.find((r) => String(r.id) === roleId);
            if (isAdminRoleName(role?.name)) {
                return acc;
            }
            // Ensure permission level is normalized before sending to server
            const normalizedLevel = normalizePermissionValue(level);
            acc.push({
                role_id: parseInt(roleId, 10),
                module,
                permission_level: normalizedLevel,
            });
            return acc;
        }, []);

        router.post(route('admin.access-control.bulk-update'), {
            permissions: permissionsArray,
        }, {
            onSuccess: () => {
                router.reload();
            },
            onFinish: () => setLoading(false),
        });
    };

    const openConfirmSave = () => {
        if (!canEditAccessControl) {
            return;
        }
        setConfirmSaveOpen(true);
    };
    const closeConfirmSave = () => setConfirmSaveOpen(false);
    const confirmSave = () => {
        closeConfirmSave();
        if (!canEditAccessControl) {
            return;
        }
        handleSaveAll();
    };

    const handleReset = (roleId) => {
        if (!canEditAccessControl) {
            return;
        }

        if (confirm('Are you sure you want to reset all permissions for this role to No Access?')) {
            router.post(route('admin.access-control.reset'), {
                role_id: roleId,
            }, {
                onSuccess: () => {
                    router.reload();
                },
            });
        }
    };

    return (
        <SidebarLayout activeModule="Admin" sidebarLinks={adminLinks} user={auth.user}>
            <Head title="Access Control" />

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Success Message */}
                {message && message.type === 'success' && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                        ✓ {message.text}
                    </div>
                )}

                {/* Header */}
                <div className="mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Access Control Management</h1>
                        <p className="text-gray-600 mt-2">
                            Manage role-based permissions for each admin module
                        </p>
                    </div>
                </div>

                {/* Quick Actions removed (replaced later) */}

                {/* Legend */}
                <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h2 className="font-semibold text-gray-900 mb-3">Permission Levels</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="rounded-lg bg-white p-4 border border-gray-200">
                            <div className="w-full h-3 mb-3 bg-green-100 rounded"></div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-1">FULL</h3>
                            <p className="text-sm text-gray-600">Create / Edit / Delete / Admin capabilities</p>
                        </div>
                        <div className="rounded-lg bg-white p-4 border border-gray-200">
                            <div className="w-full h-3 mb-3 bg-yellow-100 rounded"></div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-1">EDIT</h3>
                            <p className="text-sm text-gray-600">Create / Approve / Reject</p>
                        </div>
                        <div className="rounded-lg bg-white p-4 border border-gray-200">
                            <div className="w-full h-3 mb-3 bg-orange-100 rounded"></div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-1">VIEW</h3>
                            <p className="text-sm text-gray-600">Request / View only</p>
                        </div>
                        <div className="rounded-lg bg-white p-4 border border-gray-200">
                            <div className="w-full h-3 mb-3 bg-red-100 rounded"></div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-1">NONE</h3>
                            <p className="text-sm text-gray-600">No access</p>
                        </div>
                    </div>
                </div>

                {/* ACL Grouped Sections */}
                {Object.keys(groupedModules || {}).length === 0 ? (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-900">
                        No ACL modules are available.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(groupedModules).map(([sectionTitle, sectionModules]) => {
                            const expanded = expandedSections.includes(sectionTitle);
                            const normalizedTabQuery = normalizeText(tabSearchQueries[sectionTitle] || '');
                            const sectionFilteredRoles = sortRolesByPositionOrder(
                                normalizedTabQuery
                                    ? roles.filter((role) => roleMatchesQuery(role.name, normalizedTabQuery))
                                    : roles
                            );

                            return (
                            <div key={sectionTitle} className="bg-white rounded-lg border border-gray-200 shadow-sm">
                                <button
                                                    type="button"
                                                    onClick={() => toggleSection(sectionTitle)}
                                                    className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 hover:bg-gray-100 focus:outline-none"
                                                >
                                                    <div className="flex-1 text-left">
                                                        <h3 className="text-lg font-semibold text-gray-900">{sectionTitle}</h3>
                                                        <p className="text-sm text-gray-600">
                                                            Manage permissions for the {sectionTitle.toLowerCase()}.
                                                        </p>
                                                    </div>
                                                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-gray-300 text-gray-700">
                                                        {expanded ? '−' : '+'}
                                                    </span>
                                                </button>

                                {/* Always-visible per-tab search */}
                                <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                                    <label htmlFor={`acl-search-${sectionTitle}`} className="block text-sm font-medium text-gray-700 mb-2">
                                        Search position in this tab
                                    </label>
                                    <input
                                        id={`acl-search-${sectionTitle}`}
                                        type="text"
                                        value={tabSearchQueries[sectionTitle] || ''}
                                        onChange={(event) => updateTabSearch(sectionTitle, event.target.value)}
                                        placeholder="Search position..."
                                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    />
                                </div>

                                {expanded && (
                                    <div className="space-y-4">
                                        {sectionFilteredRoles.length === 0 ? (
                                            <div className="p-6 text-sm text-gray-600">
                                                No positions match your search in this module.
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className="bg-gray-100 border-b border-gray-200">
                                                            <th className="sticky left-0 z-10 bg-white px-6 py-4 text-left text-sm font-semibold text-gray-900 w-48">
                                                                MODULE
                                                            </th>
                                                            {sectionFilteredRoles.map((role) => {
                                                                const roleLabel = abbreviationForRole(role.name);
                                                                return (
                                                                    <th
                                                                        key={role.id}
                                                                        className="px-4 py-4 text-center text-sm font-semibold text-gray-900 min-w-32"
                                                                        title={role.name}
                                                                    >
                                                                        <div className="whitespace-nowrap text-xs uppercase tracking-wide">
                                                                            {roleLabel}
                                                                        </div>
                                                                    </th>
                                                                );
                                                            })}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {Object.entries(sectionModules).map(([moduleKey, moduleName], idx) => (
                                                            <tr
                                                                key={moduleKey}
                                                                className={`border-b border-gray-200 ${
                                                                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                                                } hover:bg-blue-50 transition`}
                                                            >
                                                                <td className="sticky left-0 z-10 bg-white px-6 py-4 text-sm font-medium text-gray-900">
                                                                    {moduleName}
                                                                </td>
                                                                {sectionFilteredRoles.map((role) => {
                                                                    const permissionKey = getPermissionKey(role.id, moduleKey);
                                                                    const roleIsAdminOrDCSO = isAdminOrDcsORoleName(role.name);
                                                                    return (
                                                                        <td
                                                                            key={permissionKey}
                                                                            className="px-4 py-4 text-center"
                                                                        >
                                                                            <PermissionSelector
                                                                                currentLevel={
                                                                                    roleIsAdminOrDCSO
                                                                                        ? 'full'
                                                                                        : permissions[permissionKey] || 'no_access'
                                                                                }
                                                                                onChange={(level) =>
                                                                                    handlePermissionChange(role.id, moduleKey, level, role.name)
                                                                                }
                                                                                disabled={!canEditAccessControl || roleIsAdminOrDCSO}
                                                                            />
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="mt-8 flex flex-col gap-4">
                    {!canEditAccessControl && (
                        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
                            You are currently in view-only mode for Access Control. Editing, saving, and resetting are disabled.
                        </div>
                    )}
                    <div className="flex gap-4 justify-end">
                        <SecondaryButton href={route('admin.dashboard')} method="get">
                            Cancel
                        </SecondaryButton>
                        <PrimaryButton onClick={openConfirmSave} disabled={loading || !canEditAccessControl}>
                            {loading ? 'Saving...' : 'Save All Changes'}
                        </PrimaryButton>
                    </div>
                </div>

                <ConfirmModal
                    show={confirmSaveOpen}
                    onClose={closeConfirmSave}
                    onConfirm={confirmSave}
                    title="Confirm Save"
                    message="Are you sure you want to save all changes to the access control list?"
                    confirmText="Save Changes"
                    confirmColor="bg-blue-600 hover:bg-blue-500 focus:bg-blue-500 active:bg-blue-700"
                />

                {/* Reset Single Position Confirmation Modal */}
                <ConfirmModal
                    show={confirmResetOpen}
                    onClose={() => setConfirmResetOpen(false)}
                    onConfirm={confirmResetClick}
                    title="Confirm Reset Position"
                    message={`Are you sure you want to reset "${selectedResetPosition}" to default settings? This will overwrite all current permissions for this position.`}
                    confirmText="Reset to Default"
                    confirmColor="bg-orange-600 hover:bg-orange-500 focus:bg-orange-500 active:bg-orange-700"
                />

                {/* Reset Selected Positions Confirmation Modal */}
                <ConfirmModal
                    show={confirmBulkSelectedOpen}
                    onClose={() => setConfirmBulkSelectedOpen(false)}
                    onConfirm={confirmBulkResetSelected}
                    title="Confirm Reset Multiple Positions"
                    message={`Are you sure you want to reset ${selectedResetPositions.length} selected position${selectedResetPositions.length === 1 ? '' : 's'} to their default settings? This will overwrite all current permissions for these positions.`}
                    confirmText={`Reset ${selectedResetPositions.length} Positions`}
                    confirmColor="bg-orange-600 hover:bg-orange-500 focus:bg-orange-500 active:bg-orange-700"
                />

                {/* Reset All Positions Confirmation Modal */}
                <ConfirmModal
                    show={confirmBulkAllOpen}
                    onClose={() => setConfirmBulkAllOpen(false)}
                    onConfirm={confirmBulkResetAll}
                    title="Confirm Reset All Positions"
                    message={`Are you sure you want to reset all ${Object.keys(DEFAULT_ACL_SETTINGS).length} positions to their default settings? This will overwrite ALL current permissions for every position in the system.`}
                    confirmText="Reset All Positions"
                    confirmColor="bg-red-600 hover:bg-red-500 focus:bg-red-500 active:bg-red-700"
                />

                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-3">Quick Actions</h3>
                    
                    {/* Section 1: Reset Selected Positions (New Multi-Select Dropdown) */}
                    <div className="mb-6 pb-6 border-b border-blue-200">
                        <h4 className="text-sm font-medium text-blue-800 mb-3">
                            Reset Multiple Positions via Dropdown
                        </h4>
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                            <div className="w-full sm:w-80">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select Positions
                                </label>
                                <MultiSelectPositionDropdown
                                    allPositions={Object.keys(DEFAULT_ACL_SETTINGS)}
                                    selectedPositions={selectedResetPositions}
                                    onSelectionChange={setSelectedResetPositions}
                                    disabled={!canEditAccessControl}
                                    label="Positions"
                                />
                            </div>

                            <div className="flex gap-2 items-end">
                                <PrimaryButton
                                    onClick={handleBulkResetSelected}
                                    disabled={selectedResetPositions.length === 0 || !canEditAccessControl || loading}
                                    className="bg-orange-600 hover:bg-orange-500 focus:bg-orange-500 active:bg-orange-700"
                                >
                                    Reset {selectedResetPositions.length > 0 ? `${selectedResetPositions.length} Selected` : 'Selected'}
                                </PrimaryButton>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Reset All Positions */}
                    <div>
                        <h4 className="text-sm font-medium text-blue-800 mb-3">Reset All Positions</h4>
                        <PrimaryButton
                            onClick={handleBulkResetAll}
                            disabled={!canEditAccessControl || loading}
                            className="bg-purple-600 hover:bg-purple-500 focus:bg-purple-500 active:bg-purple-700"
                        >
                            Reset All {Object.keys(DEFAULT_ACL_SETTINGS).length} Positions
                        </PrimaryButton>
                    </div>
                </div>
            </div>
        </SidebarLayout>
    );
}
