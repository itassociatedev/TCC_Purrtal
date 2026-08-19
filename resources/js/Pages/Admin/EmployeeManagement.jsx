import settingsIcon from '@/Assets/settings.png';
import ConfirmModal from '@/Components/ConfirmModal';
import { getAdminLinks, canEditModule, canDeleteModule, canViewModule } from "@/Config/navigation";
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';

import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';

export default function EmployeeManagement({ auth, users = [], departments = [], positions = [], branches = [], roles = [] }) {

    const adminLinks = getAdminLinks(auth);
    const canManageEmployees = canEditModule(auth, 'employees');
    const canDeleteEmployees = canDeleteModule(auth, 'employees');
    const canViewEmployees = canViewModule(auth, 'employees');

    // 🟢 Check if the currently logged-in user is an Admin
    const currentUserRole = auth.user?.role?.name?.toLowerCase() || '';
    const isCurrentUserAdmin = currentUserRole === 'admin' || currentUserRole === 'super admin';

    // Helper to manually trigger the global toast
    const triggerToast = (message, type = 'success') => {
        window.dispatchEvent(new CustomEvent('flash-toast', { detail: { message, type } }));
    };

    // Helper to check if a role is an admin
    const isAdminRole = (roleId) => {
        if (!roleId) return false;
        const role = roles.find(r => r.id.toString() === roleId.toString());
        
        if (!role) return false;
        
        const roleName = role.name.toLowerCase();
        
        return (
            roleName === 'admin' || 
            roleName === 'director of corporate services and operations'
        );
    };

    // Global Confirm Modal State
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false, title: '', message: '', confirmText: '', confirmColor: '', onConfirm: () => {}
    });

    const closeConfirmModal = () => setConfirmDialog({ ...confirmDialog, isOpen: false });

    // ==========================================
    // FILTER STATE & LOGIC
    // ==========================================
    const [filterSearch, setFilterSearch] = useState('');
    const [filterDepartment, setFilterDepartment] = useState('');
    const [filterBranch, setFilterBranch] = useState('');
    const [filterPosition, setFilterPosition] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Sorting state
    const [sortField, setSortField] = useState('name');
    const [sortDirection, setSortDirection] = useState('asc');

    const toggleSort = (field) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSortValue = (employee, field) => {
        switch (field) {
            case 'name':
                return employee.name || '';
            case 'department':
                return employee.department?.name || '';
            case 'position':
                return employee.position?.name || '';
            case 'status':
                 return employee.status || 'Unknown';
            default:
                return '';
        }
    };

    // 🟢 BULLETPROOF UNIQUE IDENTIFIER (Safe against missing IDs)
    const getEmployeeKey = (emp) => {
        if (!emp) return Math.random().toString();
        if (emp.id) return emp.id.toString();
        return `fallback-${emp.email || emp.name || Math.random()}`;
    };

    // 1. Automatically extract unique Departments, Branches, Positions, and Statuses for filter dropdowns
    const uniqueDepartments = [...new Set(users.map(u => u.department?.name).filter(Boolean))].sort();
    const uniqueBranches = [...new Set(users.flatMap(u => u.branches?.map(b => b.name) || []).filter(Boolean))].sort();
    const uniquePositions = [...new Set(users.map(u => u.position?.name).filter(Boolean))].sort();
    const uniqueStatuses = [...new Set(users.map(u => u.status).filter(Boolean))].sort();

    // 2. The Live Filter & Sort Math
    const filteredUsers = [...users]
        .filter(employee => {
            const searchTerm = filterSearch.trim().toLowerCase();

            const matchesSearch = searchTerm === '' ||
                (employee.name || '').toLowerCase().includes(searchTerm) ||
                (employee.email || '').toLowerCase().includes(searchTerm) ||
                (employee.department?.name || '').toLowerCase().includes(searchTerm) ||
                (employee.position?.name || '').toLowerCase().includes(searchTerm) ||
                (employee.branches && employee.branches.some(b =>
                    (b.name || '').toLowerCase().includes(searchTerm)
                ));

            const matchesDept = filterDepartment === '' || employee.department?.name === filterDepartment;
            const matchesBranch = filterBranch === '' || (employee.branches && employee.branches.some(b => b.name === filterBranch));
            const matchesPosition = filterPosition === '' || employee.position?.name === filterPosition;
            const matchesStatus = filterStatus === '' || employee.status === filterStatus;

            return matchesSearch && matchesDept && matchesBranch && matchesPosition && matchesStatus;
        })
        .sort((a, b) => {
            const aValue = getSortValue(a, sortField).toLowerCase();
            const bValue = getSortValue(b, sortField).toLowerCase();

            const comparison = aValue.localeCompare(bValue, undefined, {
                numeric: true,
                sensitivity: 'base',
            });

            return sortDirection === 'asc' ? comparison : -comparison;
        });

    const renderHeaderSortButton = (field) => {
        const isActive = sortField === field;
        const upClass = isActive && sortDirection === 'asc' ? 'text-gray-900' : 'text-gray-300';
        const downClass = isActive && sortDirection === 'desc' ? 'text-gray-900' : 'text-gray-300';

        return (
            <button type="button" onClick={() => toggleSort(field)} className="ml-2 inline-flex items-center justify-center hover:opacity-80 transition">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                    <g className={upClass} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 17V7" />
                        <path d="M4 10l3-3 3 3" />
                    </g>
                    <g className={downClass} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 7v10" />
                        <path d="M14 14l3 3 3-3" />
                    </g>
                </svg>
            </button>
        );
    };

    // ==========================================
    // SELECTION & BULK ACTIONS STATE
    // ==========================================
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [bulkDropdownOpen, setBulkDropdownOpen] = useState(false);

    // BULK DEVICE LIMIT STATE
    const [isBulkLimitModalOpen, setBulkLimitModalOpen] = useState(false);
    
    const {
        data: bulkLimitData,
        setData: setBulkLimitData,
        patch: patchBulkLimit,
        processing: bulkLimitProcessing,
        reset: resetBulkLimit
    } = useForm({ limit: 2, ids: [] });

    // Close bulk dropdown when clicking outside
    useEffect(() => {
        const closeDropdown = () => setBulkDropdownOpen(false);
        document.addEventListener('click', closeDropdown);
        return () => document.removeEventListener('click', closeDropdown);
    }, []);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedUsers(filteredUsers.map(getEmployeeKey));
        } else {
            setSelectedUsers([]);
        }
    };

    const handleSelect = (userId) => {
        setSelectedUsers(prev => 
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    // 🟢 EXTRACT FULL OBJECTS FOR THE TABLES
    const selectedObjects = users.filter((u) => u && selectedUsers.includes(getEmployeeKey(u)));
    const unselectedFilteredUsers = filteredUsers.filter((u) => u && !selectedUsers.includes(getEmployeeKey(u)));

    // Generate Display Names for Modals
    let displayNames = '';
    if (selectedObjects.length > 0) {
        if (selectedObjects.length <= 5) {
            displayNames = selectedObjects.map(u => u.name).join(', ');
        } else {
            displayNames = selectedObjects.slice(0, 5).map(u => u.name).join(', ') + ` and ${selectedObjects.length - 5} others`;
        }
    }

    // ==========================================
    // ACTION HANDLERS (Must be defined before Rows)
    // ==========================================
    const confirmDeviceReset = (employee) => {
        setActiveDropdown(null);
        setConfirmDialog({
            isOpen: true,
            title: 'Reset Device Connection',
            message: `Are you sure you want to reset the device connection for ${employee.name}? They will be required to re-authenticate.`,
            confirmText: 'Reset Device',
            confirmColor: 'bg-yellow-600 hover:bg-yellow-500',
            onConfirm: () => {
                router.patch(route('admin.users.reset-device', [employee.id]), {}, {
                    preserveScroll: true,
                    onSuccess: () => closeConfirmModal(),
                });
            }
        });
    };

    const confirmDeleteUser = (employee) => {
        setActiveDropdown(null);
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Employee',
            message: `Are you absolutely sure you want to permanently delete ${employee.name}? This action cannot be undone.`,
            confirmText: 'Delete Employee',
            confirmColor: 'bg-red-600 hover:bg-red-500',
            onConfirm: () => {
                router.delete(route('admin.users.destroy', [employee.id]), {
                    preserveScroll: true,
                    onSuccess: () => closeConfirmModal(),
                });
            }
        });
    };

    const confirmToggleStatus = (employee) => {
        setActiveDropdown(null);
        const isDisabling = employee.status !== 'Disabled';
        
        setConfirmDialog({
            isOpen: true,
            title: isDisabling ? 'Disable Account' : 'Enable Account',
            message: isDisabling 
                ? `Are you sure you want to disable access for ${employee.name}? They will immediately be locked out of the system.`
                : `Are you sure you want to re-enable access for ${employee.name}?`,
            confirmText: isDisabling ? 'Disable Account' : 'Enable Account',
            confirmColor: isDisabling ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500',
            onConfirm: () => {
                router.patch(route('admin.users.toggle-status', [employee.id]), {}, {
                    preserveScroll: true,
                    onSuccess: () => closeConfirmModal(),
                });
            }
        });
    };

    const handleAccountAction = (employee) => {
        setActiveDropdown(null); 
        if (employee.status === 'Pending Setup') {
            router.post(route('employees.send-activation', [employee.id]), {}, {
                preserveScroll: true,
                onSuccess: () => triggerToast(`Activation link sent to ${employee.email}`, 'success'),
            });
        } else {
            router.post(route('employees.send-reset', [employee.id]), {}, {
                preserveScroll: true,
                onSuccess: () => triggerToast(`Reset link sent to ${employee.email}`, 'success'),
            });
        }
    };

    const confirmDeleteRole = (role) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete System Role',
            message: `Are you sure you want to permanently delete the ${role.name} role?\n\nThis may strip access from users currently holding this role.`,
            confirmText: 'Delete Role',
            confirmColor: 'bg-red-600 hover:bg-red-500',
            onConfirm: () => {
                router.delete(route('admin.roles.destroy', [role.id]), {
                    preserveScroll: true,
                    onSuccess: () => closeConfirmModal(),
                });
            }
        });
    };

    const confirmDeleteDepartment = (department) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Department',
            message: `Are you sure you want to permanently delete the ${department.name} department?\n\nThis may affect employees currently assigned to it.`,
            confirmText: 'Delete Department',
            confirmColor: 'bg-red-600 hover:bg-red-500',
            onConfirm: () => {
                router.delete(route('admin.departments.destroy', [department.id]), {
                    preserveScroll: true,
                    onSuccess: () => closeConfirmModal(),
                });
            }
        });
    };

    const confirmDeletePosition = (position) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Position',
            message: `Are you sure you want to permanently delete the ${position.name} position?\n\nThis may affect employees currently assigned to it.`,
            confirmText: 'Delete Position',
            confirmColor: 'bg-red-600 hover:bg-red-500',
            onConfirm: () => {
                router.delete(route('admin.positions.destroy', [position.id]), {
                    preserveScroll: true,
                    onSuccess: () => closeConfirmModal(),
                });
            }
        });
    };

    const confirmDeleteBranch = (branch) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Branch',
            message: `Are you sure you want to permanently delete the ${branch.name} branch?\n\nThis may affect employees currently assigned to it.`,
            confirmText: 'Delete Branch',
            confirmColor: 'bg-red-600 hover:bg-red-500',
            onConfirm: () => {
                router.delete(route('admin.branches.destroy', [branch.id]), {
                    preserveScroll: true,
                    onSuccess: () => closeConfirmModal(),
                });
            }
        });
    };

    // Bulk Actions handler
    const handleBulkAction = (action) => {
        setBulkDropdownOpen(false);
        
        let title = '';
        let messageText = '';
        let confirmText = '';
        let confirmColor = '';
        let routeName = '';
        let method = 'post';

        switch(action) {
            case 'change-limit':
                setBulkLimitData({ limit: 2, ids: selectedUsers });
                setBulkLimitModalOpen(true);
                return; 
            case 'password-reset':
                title = 'Send Password/Activation Links';
                messageText = `Are you sure you want to send account links to the following ${selectedObjects.length} employee(s): ${displayNames}?`;
                confirmText = 'Send Links';
                confirmColor = 'bg-blue-600 hover:bg-blue-500';
                routeName = 'admin.users.bulk-send-links';
                break;
            case 'device-reset':
                title = 'Bulk Device Reset';
                messageText = `Are you sure you want to reset the device connection for the following ${selectedObjects.length} employee(s): ${displayNames}? They will be required to re-authenticate.`;
                confirmText = 'Reset Devices';
                confirmColor = 'bg-yellow-600 hover:bg-yellow-500';
                routeName = 'admin.users.bulk-reset-device';
                method = 'patch';
                break;
            case 'toggle-status':
                const allAreDisabled = selectedObjects.every(u => u.status === 'Disabled');
                const allAreActive = selectedObjects.every(u => u.status !== 'Disabled');

                if (allAreDisabled) {
                    title = 'Bulk Enable Accounts';
                    messageText = `Are you sure you want to enable access for the following ${selectedObjects.length} employee(s): ${displayNames}?`;
                    confirmText = 'ENABLE ACCOUNTS';
                    confirmColor = 'bg-green-600 hover:bg-green-500';
                } else if (allAreActive) {
                    title = 'Bulk Disable Accounts';
                    messageText = `Are you sure you want to disable access for the following ${selectedObjects.length} employee(s): ${displayNames}?`;
                    confirmText = 'DISABLE ACCOUNTS';
                    confirmColor = 'bg-red-600 hover:bg-red-500';
                } else {
                    title = 'Bulk Toggle Status';
                    messageText = `Are you sure you want to toggle the status for the following ${selectedObjects.length} employee(s): ${displayNames}? (Active accounts will become Disabled, and Disabled accounts will become Active).`;
                    confirmText = 'TOGGLE STATUSES';
                    confirmColor = 'bg-orange-600 hover:bg-orange-500';
                }
                routeName = 'admin.users.bulk-toggle-status';
                method = 'patch';
                break;
            case 'delete':
                title = 'Bulk Delete Employees';
                messageText = `Are you absolutely sure you want to permanently delete the following ${selectedObjects.length} employee(s): ${displayNames}? This action cannot be undone.`;
                confirmText = 'Delete Employees';
                confirmColor = 'bg-red-600 hover:bg-red-500';
                routeName = 'admin.users.bulk-destroy';
                method = 'delete';
                break;

            case 'toggle-comment-ban':
                const allAreBanned = selectedObjects.every(u => u.is_comment_banned);
                const allAreAllowed = selectedObjects.every(u => !u.is_comment_banned);

                if (allAreBanned) {
                    title = 'Bulk Unban Comments';
                    messageText = `Are you sure you want to restore commenting privileges for the following ${selectedObjects.length} employee(s): ${displayNames}?`;
                    confirmText = 'UNBAN COMMENTS';
                    confirmColor = 'bg-green-600 hover:bg-green-500';
                } else if (allAreAllowed) {
                    title = 'Bulk Ban from Comments';
                    messageText = `Are you sure you want to restrict commenting for the following ${selectedObjects.length} employee(s): ${displayNames}?`;
                    confirmText = 'BAN COMMENTS';
                    confirmColor = 'bg-red-600 hover:bg-red-500';
                } else {
                    title = 'Bulk Toggle Comment Restrictions';
                    messageText = `Are you sure you want to toggle the comment ban status for the following ${selectedObjects.length} employee(s): ${displayNames}? (Restricted accounts will be unbanned, and active accounts will be banned).`;
                    confirmText = 'TOGGLE RESTRICTIONS';
                    confirmColor = 'bg-orange-600 hover:bg-orange-500';
                }
                routeName = 'admin.users.bulk-toggle-comment-ban';
                method = 'patch';
                break;

            default:
                return;
        }

        setConfirmDialog({
            isOpen: true,
            title,
            message: messageText, // MUST BE PURE STRING TO PREVENT REACT CRASH
            confirmText,
            confirmColor,
            onConfirm: () => {
                if (method === 'delete') {
                    router.delete(route(routeName), {
                        data: { ids: selectedUsers },
                        preserveScroll: true,
                        onSuccess: () => { closeConfirmModal(); setSelectedUsers([]); }
                    });
                } else {
                    router[method](route(routeName), { ids: selectedUsers }, {
                        preserveScroll: true,
                        onSuccess: () => { closeConfirmModal(); setSelectedUsers([]); }
                    });
                }
            }
        });
    };

    const submitBulkLimit = (e) => {
        e.preventDefault();
        patchBulkLimit(route('admin.users.bulk-update-device-limit'), {
            preserveScroll: true,
            onSuccess: () => {
                setBulkLimitModalOpen(false);
                setSelectedUsers([]);
                resetBulkLimit();
            }
        });
    };

    // ==========================================
    // EXTRACTED RENDER METHODS FOR THE TABLE ROWS
    // ==========================================
    const [activeDropdown, setActiveDropdown] = useState(null);

    const renderDesktopRow = (employee, isSelected) => {
        const uniqueKey = getEmployeeKey(employee);
        return (
            <tr 
                key={`desktop-${uniqueKey}`} 
                onClick={() => handleSelect(uniqueKey)}
                className={`border-b cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/80 hover:bg-indigo-100' : 'bg-white hover:bg-gray-50'}`}
            >
                <td className="px-6 py-4 whitespace-nowrap">
                    <input
                        type="checkbox"
                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 cursor-pointer"
                        checked={isSelected}
                        onChange={() => handleSelect(uniqueKey)}
                        onClick={(e) => e.stopPropagation()}
                    />
                </td>
                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                    {employee.name}
                    <div className="text-xs text-gray-500 mt-0.5">{employee.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    {employee.department?.name ? <span className="text-gray-900">{employee.department.name}</span> : <span className="text-gray-400 italic">Unassigned</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    {employee.position?.name ? <span className="text-gray-900 font-medium">{employee.position.name}</span> : <span className="text-gray-400 italic">Unassigned</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    {employee.branches && employee.branches.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {employee.branches.map((branch) => (
                                <span key={branch.id} className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                    {branch.name}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span className="text-gray-400 italic">N/A</span>
                    )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset ${
                        employee.status === 'Disabled' ? 'bg-gray-100 text-gray-600 ring-gray-500/20' : 
                        employee.status === 'Password Reset' ? 'bg-red-50 text-red-700 ring-red-600/20' : 
                        employee.status === 'Active' ? 'bg-green-50 text-green-700 ring-green-600/20' : 
                        employee.status === 'Pending Setup' ? 'bg-yellow-50 text-yellow-800 ring-yellow-600/20' :
                        'bg-gray-50 text-gray-800 ring-gray-600/20'
                    }`}>
                        {employee.status}
                    </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdown(activeDropdown === uniqueKey ? null : uniqueKey);
                        }}
                        className="inline-flex items-center justify-center rounded-md p-1.5 hover:bg-gray-200 focus:outline-none transition-colors"
                    >
                        <img src={settingsIcon} alt="Settings" className="h-5 w-5 opacity-70 hover:opacity-100" />
                    </button>

                    {activeDropdown === uniqueKey && (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-8 top-10 z-50 w-36 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
                        >
                            {canManageEmployees ? (
                                <button 
                                    className="block w-full px-4 py-2 text-left text-sm font-medium text-black hover:bg-gray-100 transition-colors"
                                    onClick={(e) => {
                                        e.preventDefault(); e.stopPropagation(); handleAccountAction(employee);
                                    }}
                                >
                                    {employee.status === 'Pending Setup' ? 'Activation Link' : 'Password Reset'}
                                </button>
                            ) : (
                                <button className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-300 cursor-not-allowed" disabled>
                                    {employee.status === 'Pending Setup' ? 'Activation Link' : 'Password Reset'}
                                </button>
                            )}
                            {canManageEmployees && (
                                <Link as="button" className="block w-full px-4 py-2 text-left text-sm font-medium text-black hover:bg-gray-100 transition-colors" onClick={(e) => {
                                    e.preventDefault(); e.stopPropagation(); openEditUserModal(employee);
                                }}>
                                    Edit
                                </Link>
                            )}
                            {canManageEmployees ? (
                                <Link as="button" className="block w-full px-4 py-2 text-left text-sm font-medium text-black hover:bg-gray-100 transition-colors" onClick={(e) => {
                                    e.preventDefault(); e.stopPropagation(); confirmDeviceReset(employee);
                                }}>
                                    Device Reset
                                </Link>
                            ) : (
                                <button className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-300 cursor-not-allowed" disabled>
                                    Device Reset
                                </button>
                            )}
                            {canManageEmployees ? (
                                <button 
                                    className="block w-full px-4 py-2 text-left text-sm font-medium text-black hover:bg-gray-100 transition-colors" 
                                    onClick={(e) => {
                                        e.preventDefault(); e.stopPropagation(); confirmToggleStatus(employee);
                                    }}
                                >
                                    {employee.status === 'Disabled' ? 'Enable Account' : 'Disable Account'}
                                </button>
                            ) : (
                                <button className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-300 cursor-not-allowed" disabled>
                                    {employee.status === 'Disabled' ? 'Enable Account' : 'Disable Account'}
                                </button>
                            )}

                            {canManageEmployees ? (
                                <button
                                    className={`block w-full px-4 py-2 text-left text-sm font-medium transition-colors ${employee.is_comment_banned ? 'text-green-600 hover:bg-green-50' : 'text-orange-600 hover:bg-orange-50'}`}
                                    onClick={(e) => {
                                        e.preventDefault(); 
                                        e.stopPropagation();
                                        if (confirm(`Are you sure you want to ${employee.is_comment_banned ? 'unban' : 'ban'} ${employee.name} from commenting?`)) {
                                            router.patch(route('admin.users.toggle-comment-ban', employee.id), {}, { preserveScroll: true });
                                            setActiveDropdown(null);
                                        }
                                    }}
                                >
                                    {employee.is_comment_banned ? 'Unban Comments' : 'Ban Comments'}
                                </button>
                            ) : (
                                <button className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-300 cursor-not-allowed" disabled>
                                    {employee.is_comment_banned ? 'Unban Comments' : 'Ban Comments'}
                                </button>
                            )}

                            <Link 
                                as="button" 
                                method="delete" 
                                className={`block w-full px-4 py-2 text-left text-sm font-medium transition-colors ${canDeleteEmployees ? 'text-black hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
                                disabled={!canDeleteEmployees}
                                onClick={(e) => {
                                    if (!canDeleteEmployees) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        return;
                                    }
                                    e.preventDefault(); e.stopPropagation(); confirmDeleteUser(employee);
                                }}
                                title={canDeleteEmployees ? 'Delete employee' : 'Full permission required to delete employees'}
                            >
                                Delete
                            </Link>
                        </div>
                    )}
                </td>
            </tr>
        );
    };

    const renderMobileRow = (employee, isSelected) => {
        const uniqueKey = getEmployeeKey(employee);
        return (
            <div 
                key={`mobile-${uniqueKey}`} 
                onClick={() => handleSelect(uniqueKey)}
                className={`p-4 cursor-pointer transition-colors border-b border-gray-100 ${isSelected ? 'bg-indigo-50/80' : 'bg-white'}`}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <input
                            type="checkbox"
                            className="mt-1 rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                            checked={isSelected}
                            onChange={() => handleSelect(uniqueKey)}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div>
                            <div className="font-medium text-gray-900 break-words">
                                {employee.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 break-all">
                                {employee.email}
                            </div>
                        </div>
                    </div>

                    <div className="relative shrink-0">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown(activeDropdown === uniqueKey ? null : uniqueKey);
                            }}
                            className="inline-flex items-center justify-center rounded-md p-1.5 hover:bg-gray-200 focus:outline-none transition-colors"
                        >
                            <img src={settingsIcon} alt="Settings" className="h-5 w-5 opacity-70 hover:opacity-100" />
                        </button>

                        {activeDropdown === uniqueKey && (
                            <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-10 z-50 w-56 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
                            >
                                {canManageEmployees ? (
                                    <button 
                                        className="block w-full px-4 py-2 text-left text-sm font-medium text-black hover:bg-gray-100 transition-colors"
                                        onClick={(e) => {
                                            e.preventDefault(); e.stopPropagation(); handleAccountAction(employee);
                                        }}
                                    >
                                        {employee.status === 'Pending Setup' ? 'Activation Link' : 'Password Reset'}
                                    </button>
                                ) : (
                                    <button className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-300 cursor-not-allowed" disabled>
                                        {employee.status === 'Pending Setup' ? 'Activation Link' : 'Password Reset'}
                                    </button>
                                )}
                                {canManageEmployees && (
                                    <Link as="button" className="block w-full px-4 py-2 text-left text-sm font-medium text-black hover:bg-gray-100 transition-colors" onClick={(e) => {
                                        e.preventDefault(); e.stopPropagation(); openEditUserModal(employee);
                                    }}>
                                        Edit
                                    </Link>
                                )}
                                {canManageEmployees ? (
                                    <Link as="button" className="block w-full px-4 py-2 text-left text-sm font-medium text-black hover:bg-gray-100 transition-colors" onClick={(e) => {
                                        e.preventDefault(); e.stopPropagation(); confirmDeviceReset(employee);
                                    }}>
                                        Device Reset
                                    </Link>
                                ) : (
                                    <button className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-300 cursor-not-allowed" disabled>
                                        Device Reset
                                    </button>
                                )}
                                {canManageEmployees ? (
                                    <button 
                                        className="block w-full px-4 py-2 text-left text-sm font-medium text-black hover:bg-gray-100 transition-colors" 
                                        onClick={(e) => {
                                            e.preventDefault(); e.stopPropagation(); confirmToggleStatus(employee);
                                        }}
                                    >
                                        {employee.status === 'Disabled' ? 'Enable Account' : 'Disable Account'}
                                    </button>
                                ) : (
                                    <button className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-300 cursor-not-allowed" disabled>
                                        {employee.status === 'Disabled' ? 'Enable Account' : 'Disable Account'}
                                    </button>
                                )}

                                {canManageEmployees ? (
                                    <button
                                        className={`block w-full px-4 py-2 text-left text-sm font-medium transition-colors ${employee.is_comment_banned ? 'text-green-600 hover:bg-green-50' : 'text-orange-600 hover:bg-orange-50'}`}
                                        onClick={(e) => {
                                            e.preventDefault(); 
                                            e.stopPropagation();
                                            if (confirm(`Are you sure you want to ${employee.is_comment_banned ? 'unban' : 'ban'} ${employee.name} from commenting?`)) {
                                                router.patch(route('admin.users.toggle-comment-ban', employee.id), {}, { preserveScroll: true });
                                                setActiveDropdown(null);
                                            }
                                        }}
                                    >
                                        {employee.is_comment_banned ? 'Unban Comments' : 'Ban Comments'}
                                    </button>
                                ) : (
                                    <button className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-300 cursor-not-allowed" disabled>
                                        {employee.is_comment_banned ? 'Unban Comments' : 'Ban Comments'}
                                    </button>
                                )}
                            
                                <Link 
                                    as="button" 
                                    method="delete" 
                                    className={`block w-full px-4 py-2 text-left text-sm font-medium transition-colors ${canDeleteEmployees ? 'text-black hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
                                    disabled={!canDeleteEmployees}
                                    onClick={(e) => {
                                        if (!canDeleteEmployees) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            return;
                                        }
                                        e.preventDefault(); e.stopPropagation(); confirmDeleteUser(employee);
                                    }}
                                    title={canDeleteEmployees ? 'Delete employee' : 'Full permission required to delete employees'}
                                >
                                    Delete
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-4 space-y-3">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Department</div>
                        <div className="mt-1 text-sm text-gray-900">
                            {employee.department?.name ? employee.department.name : <span className="text-gray-400 italic">Unassigned</span>}
                        </div>
                    </div>
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Position</div>
                        <div className="mt-1 text-sm text-gray-900">
                            {employee.position?.name ? employee.position.name : <span className="text-gray-400 italic">Unassigned</span>}
                        </div>
                    </div>
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Branch</div>
                        <div className="mt-1">
                            {employee.branches && employee.branches.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {employee.branches.map((branch) => (
                                        <span key={branch.id} className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                            {branch.name}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-sm text-gray-400 italic">N/A</span>
                            )}
                        </div>
                    </div>
                </div>
                <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mt-3">Status</div>
                    <div className="mt-1">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset ${
                            employee.status === 'Disabled' ? 'bg-gray-100 text-gray-600 ring-gray-500/20' : 
                            employee.status === 'Password Reset' ? 'bg-red-50 text-red-700 ring-red-600/20' : 
                            employee.status === 'Active' ? 'bg-green-50 text-green-700 ring-green-600/20' : 
                            employee.status === 'Pending Setup' ? 'bg-yellow-50 text-yellow-800 ring-yellow-600/20' :
                            'bg-gray-50 text-gray-800 ring-gray-600/20'
                        }`}>
                            {employee.status}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    // ==========================================
    // For Edit Departments
    // ==========================================
    const [isDepartmentModalOpen, setDepartmentModalOpen] = useState(false);

    const {
        data: deptData,
        setData: setDeptData,
        post: postDept,
        processing: deptProcessing,
        errors: deptErrors,
        reset: resetDept,
        clearErrors: clearDeptErrors
    } = useForm({ name: '' });

    const closeDepartmentModal = () => {
        setDepartmentModalOpen(false);
        clearDeptErrors();
        resetDept();
    };

    const submitDepartment = (e) => {
        e.preventDefault();
        postDept(route('admin.departments.store'), {
            preserveScroll: true,
            onSuccess: () => resetDept(),
        });
    };

    // ==========================================
    // For Edit Roles
    // ==========================================
    const [isRoleModalOpen, setRoleModalOpen] = useState(false);

    const {
        data: roleData,
        setData: setRoleData,
        post: postRole,
        processing: roleProcessing,
        errors: roleErrors,
        reset: resetRole,
        clearErrors: clearRoleErrors
    } = useForm({ name: '' });

    const closeRoleModal = () => {
        setRoleModalOpen(false);
        clearRoleErrors();
        resetRole();
    };

    const submitRole = (e) => {
        e.preventDefault();
        postRole(route('admin.roles.store'), {
            preserveScroll: true,
            onSuccess: () => resetRole(),
        });
    };

    // ==========================================
    // For Edit Positions
    // ==========================================
    const [isPositionModalOpen, setPositionModalOpen] = useState(false);

    const { 
        data: positionData, 
        setData: setPositionData, 
        post: postPosition, 
        processing: positionProcessing, 
        errors: positionErrors, 
        reset: resetPosition, 
        clearErrors: clearPositionErrors 
    } = useForm({
        department_id: '',
        position_name: '',
    });

    const closePositionModal = () => {
        setPositionModalOpen(false);
        clearPositionErrors();
        resetPosition();
    };

    const submitPosition = (e) => {
        e.preventDefault();
        postPosition(route('admin.positions.store'), {
            preserveScroll: true,
            onSuccess: () => {
                resetPosition('position_name');
            },
        });
    };

    const filteredManagePositions = positionData.department_id
        ? positions.filter(pos => pos.department_id === parseInt(positionData.department_id))
        : positions;

    // ==========================================
    // For Edit Branches
    // ==========================================
    const [isBranchModalOpen, setBranchModalOpen] = useState(false);

    const {
        data: branchData,
        setData: setBranchData,
        post: postBranch,
        processing: branchProcessing,
        errors: branchErrors,
        clearErrors: clearBranchErrors,
        reset: resetBranch
    } = useForm({
        name: '',
    });

    const closeBranchModal = () => {
        setBranchModalOpen(false);
        clearBranchErrors();
        resetBranch();
    };

    const submitBranch = (e) => {
        e.preventDefault();
        postBranch(route('admin.branches.store'), {
            preserveScroll: true,
            onSuccess: () => resetBranch(),
        });
    };

    // ==========================================
    // For Add Users
    // ==========================================
    const [isUserModalOpen, setUserModalOpen] = useState(false);

    const {
        data: userData,
        setData: setUserData,
        post: postUser,
        processing: userProcessing,
        errors: userErrors,
        clearErrors: clearUserErrors,
        reset: resetUser
    } = useForm({
        name: '',
        email: '',
        role_id: '',
        department_id: '',
        position_id: '',
        device_limit: 2,
        branch_ids: [],
    });

    const closeUserModal = () => {
        setUserModalOpen(false);
        clearUserErrors();
        resetUser();
    };

    const submitUser = (e) => {
        e.preventDefault();
        postUser(route('admin.users.store'), {
            preserveScroll: true,
            onSuccess: () => {
                closeUserModal();
                resetUser();
            },
        });
    };

    const handleBranchCheckbox = (e, branchId) => {
        if (e.target.checked) {
            setUserData('branch_ids', [...userData.branch_ids, branchId]);
        } else {
            setUserData('branch_ids', userData.branch_ids.filter(id => id !== branchId));
        }
    };

    const filteredPositionsForUser = positions.filter(
        pos => pos.department_id === parseInt(userData.department_id)
    );

    // ==========================================
    // For Edit Users
    // ==========================================
    const [isEditUserModalOpen, setEditUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const {
        data: editUserData,
        setData: setEditData,
        put: putUser,
        processing: editProcessing,
        errors: editErrors,
        clearErrors: clearEditErrors,
        reset: resetEditUser
    } = useForm({
        name: '',
        email: '',
        role_id: '',
        department_id: '',
        position_id: '',
        device_limit: 2,
        branch_ids: [],
    });

    const openEditUserModal = (user) => {
        setEditingUser(user);
        setEditData({
            name: user.name,
            email: user.email,
            password: '',
            role_id: user.role_id || '',
            department_id: user.department_id || '',
            position_id: user.position_id || '',
            device_limit: user.device_limit || 2,
            branch_ids: user.branches ? user.branches.map(b => b.id) : [],
        });
        setEditUserModalOpen(true);
    };

    const closeEditUserModal = () => {
        setEditUserModalOpen(false);
        setEditingUser(null);
        clearEditErrors();
        resetEditUser();
    };

    const submitEditUser = (e) => {
        e.preventDefault();
        putUser(route('admin.users.update', [editingUser.id]), {
            preserveScroll: true,
            onSuccess: () => {
                closeEditUserModal();
                resetEditUser();
            },
        });
    };

    const handleEditBranchCheckbox = (e, branchId) => {
        if (e.target.checked) {
            setEditData('branch_ids', [...editUserData.branch_ids, branchId]);
        } else {
            setEditData('branch_ids', editUserData.branch_ids.filter(id => id !== branchId));
        }
    };

    const filteredEditPositions = positions.filter(
        (pos) => pos.department_id === parseInt(editUserData.department_id)
    );

    const { processing: importProcessing, reset: resetImport } = useForm({
        import_file: null,
    });

    const handleFileUpload = (e) => {
        const file = e.target.files[0];

        if (file) {
            setConfirmDialog({
                isOpen: true,
                title: 'Confirm Batch Import',
                message: `Are you sure you want to import employees from "${file.name}"? Make sure you used the official template to prevent errors.`,
                confirmText: 'Import Employees',
                confirmColor: 'bg-green-600 hover:bg-green-700',
                onConfirm: () => {
                    closeConfirmModal();

                    router.post(route('admin.employees.import'), {
                        import_file: file
                    }, {
                        preserveScroll: true,
                        forceFormData: true,
                        onSuccess: () => {
                            resetImport();
                            e.target.value = null;
                        },
                        onError: () => {
                            e.target.value = null;
                        }
                    });
                }
            });
        }
    };

    return (
        <SidebarLayout
            activeModule="Admin"
            sidebarLinks={adminLinks}
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Employee Management
                </h2>
            }
        >
            <Head title="Employee Management" />

            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col md:h-[calc(100vh-240px)] md:overflow-hidden">

                <div className="flex-none mb-4 space-y-4">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <button disabled={!canManageEmployees} className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-widest shadow-sm transition flex-shrink-0 ${canManageEmployees ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`} onClick={() => canManageEmployees && setUserModalOpen(true)} title={!canManageEmployees ? 'Edit permission required' : ''}>
                                + Add Users
                            </button>
                            <button disabled={!canManageEmployees} className={`rounded-md border px-4 py-2 text-xs font-semibold uppercase tracking-widest shadow-sm transition flex-shrink-0 ${canManageEmployees ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50' : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'}`} onClick={() => canManageEmployees && setPositionModalOpen(true)} title={!canManageEmployees ? 'Edit permission required' : ''}>
                                Edit Positions
                            </button>
                            <button disabled={!canManageEmployees} className={`rounded-md border px-4 py-2 text-xs font-semibold uppercase tracking-widest shadow-sm transition flex-shrink-0 ${canManageEmployees ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50' : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'}`} onClick={() => canManageEmployees && setBranchModalOpen(true)} title={!canManageEmployees ? 'Edit permission required' : ''}>
                                Edit Branch
                            </button>
                            <button disabled={!canManageEmployees} className={`rounded-md border px-4 py-2 text-xs font-semibold uppercase tracking-widest shadow-sm transition flex-shrink-0 ${canManageEmployees ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50' : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'}`} onClick={() => canManageEmployees && setDepartmentModalOpen(true)} title={!canManageEmployees ? 'Edit permission required' : ''}>
                                Edit Departments
                            </button>
                            <button disabled={!canManageEmployees} className={`rounded-md border px-4 py-2 text-xs font-semibold uppercase tracking-widest shadow-sm transition flex-shrink-0 ${canManageEmployees ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50' : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'}`} onClick={() => canManageEmployees && setRoleModalOpen(true)} title={!canManageEmployees ? 'Edit permission required' : ''}>
                                Edit Roles
                            </button>

                            {/* BULK ACTIONS DROPDOWN */}
                            {selectedUsers.length > 0 && canViewEmployees && (
                                <div className="relative inline-block flex-shrink-0 ml-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setBulkDropdownOpen(!bulkDropdownOpen);
                                        }}
                                        className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white shadow-sm hover:bg-indigo-50 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                    >
                                        Bulk Actions ({selectedUsers.length})
                                        <svg className="-mr-1 ml-2 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                        </svg>
                                    </button>

                                    {bulkDropdownOpen && (
                                        <div 
                                            onClick={(e) => e.stopPropagation()}
                                            className="absolute left-0 z-50 mt-2 w-56 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                                        >
                                            <div className="py-1">
                                                {/* PROTECTED BULK CHANGE LIMIT OPTION */}
                                                {isCurrentUserAdmin && (
                                                    <button
                                                        type="button"
                                                        onClick={() => canManageEmployees && handleBulkAction('change-limit')}
                                                        className={`block w-full px-4 py-2 text-left text-sm ${canManageEmployees ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
                                                        disabled={!canManageEmployees}
                                                    >
                                                        Change Device Limit
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => canManageEmployees && handleBulkAction('password-reset')}
                                                    className={`block w-full px-4 py-2 text-left text-sm ${canManageEmployees ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
                                                    disabled={!canManageEmployees}
                                                >
                                                    Activation Links / Send Reset
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => canManageEmployees && handleBulkAction('device-reset')}
                                                    className={`block w-full px-4 py-2 text-left text-sm ${canManageEmployees ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
                                                    disabled={!canManageEmployees}
                                                >
                                                    Device Reset
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => canManageEmployees && handleBulkAction('toggle-status')}
                                                    className={`block w-full px-4 py-2 text-left text-sm ${canManageEmployees ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
                                                    disabled={!canManageEmployees}
                                                >
                                                    Enable / Disable
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => canManageEmployees && handleBulkAction('toggle-comment-ban')}
                                                    className={`block w-full px-4 py-2 text-left text-sm ${canManageEmployees ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
                                                    disabled={!canManageEmployees}
                                                >
                                                    Ban / Unban Comments
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => canDeleteEmployees && handleBulkAction('delete')}
                                                    className={`block w-full px-4 py-2 text-left text-sm font-bold ${canDeleteEmployees ? 'text-red-600 hover:bg-red-50' : 'text-red-300 cursor-not-allowed'}`}
                                                    disabled={!canDeleteEmployees}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:justify-end">
                            <a
                                href={canManageEmployees ? route('admin.employees.export', {
                                    search: filterSearch,
                                    department: filterDepartment,
                                    branch: filterBranch,
                                    position: filterPosition,
                                    status: filterStatus
                                }) : '#'}
                                onClick={(e) => {
                                    if (!canManageEmployees) e.preventDefault();
                                    else triggerToast('Preparing export. Download will start shortly...', 'success');
                                }}
                                className={`inline-flex items-center rounded-md border px-4 py-2 text-xs font-bold uppercase tracking-widest shadow-sm transition flex-shrink-0 ${
                                    canManageEmployees 
                                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' 
                                        : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                                title={!canManageEmployees ? 'Edit permission required' : ''}
                            >
                                📥 Export
                            </a>

                            <a
                                href={canManageEmployees ? route('admin.employees.template') : '#'}
                                onClick={(e) => {
                                    if (!canManageEmployees) e.preventDefault();
                                    else triggerToast('Downloading Excel template...', 'success');
                                }}
                                className={`inline-flex items-center rounded-md border px-4 py-2 text-xs font-semibold uppercase tracking-widest shadow-sm transition flex-shrink-0 ${
                                    canManageEmployees
                                        ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                        : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                                title={!canManageEmployees ? 'Edit permission required' : ''}
                            >
                                📄 Template
                            </a>

                            <div className="relative inline-block flex-shrink-0">
                                <input
                                    type="file"
                                    id="excel-upload-emp"
                                    className="hidden"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileUpload}
                                    disabled={!canManageEmployees}
                                />
                                <button
                                    onClick={() => canManageEmployees && document.getElementById('excel-upload-emp').click()}
                                    disabled={importProcessing || !canManageEmployees}
                                    className={`inline-flex items-center rounded-md border px-4 py-2 text-xs font-bold uppercase tracking-widest shadow-sm transition ${
                                        canManageEmployees
                                            ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                                            : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }`}
                                    title={!canManageEmployees ? 'Edit permission required' : ''}
                                >
                                    {importProcessing ? 'Importing...' : '📁 Batch Import'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex-1 min-w-[200px] relative">
                            <input
                                type="text"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pr-8"
                                placeholder="Search by name, email, department, position, or branch..."
                                value={filterSearch}
                                onChange={(e) => setFilterSearch(e.target.value)}
                            />
                            {filterSearch && (
                                <button
                                    type="button"
                                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 font-bold"
                                    onClick={() => setFilterSearch('')}
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        <select
                            className="block w-full sm:w-auto rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            value={filterDepartment}
                            onChange={(e) => setFilterDepartment(e.target.value)}
                        >
                            <option value="">All Departments</option>
                            {uniqueDepartments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>

                        <select
                            className="block w-full sm:w-auto rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            value={filterPosition}
                            onChange={(e) => setFilterPosition(e.target.value)}
                        >
                            <option value="">All Positions</option>
                            {uniquePositions.map(pos => (
                                <option key={pos} value={pos}>{pos}</option>
                            ))}
                        </select>

                        <select
                            className="block w-full sm:w-auto rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            value={filterBranch}
                            onChange={(e) => setFilterBranch(e.target.value)}
                        >
                            <option value="">All Branches</option>
                            {uniqueBranches.map(branch => (
                                <option key={branch} value={branch}>{branch}</option>
                            ))}
                        </select>

                        <select
                            className="block w-full sm:w-auto rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            {uniqueStatuses.map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 min-h-0 flex flex-col md:overflow-hidden relative">
                    
                    {/* 🟢 DESKTOP TABLE */}
                    <div className="hidden md:block overflow-x-auto overflow-y-auto flex-1 relative">
                        <table className="min-w-full divide-y divide-gray-200 text-left text-sm text-gray-500 relative">
                            <thead className="bg-gray-50 sticky top-0 z-20 border-b border-gray-200 shadow-sm text-xs uppercase text-gray-700">
                                <tr>
                                    <th scope="col" className="px-6 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 cursor-pointer"
                                            checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th scope="col" className="px-6 py-3 bg-gray-50 font-bold tracking-wider">
                                        <div className="flex items-center">
                                            <span>Name</span>
                                            {renderHeaderSortButton('name')}
                                        </div>
                                    </th>
                                    <th scope="col" className="px-6 py-3 bg-gray-50 font-bold tracking-wider">
                                        <div className="flex items-center">
                                            <span>Department</span>
                                            {renderHeaderSortButton('department')}
                                        </div>
                                    </th>
                                    <th scope="col" className="px-6 py-3 bg-gray-50 font-bold tracking-wider">
                                        <div className="flex items-center">
                                            <span>Position</span>
                                            {renderHeaderSortButton('position')}
                                        </div>
                                    </th>
                                    <th scope="col" className="px-6 py-3 bg-gray-50 font-bold tracking-wider">Branch</th>
                                    
                                    <th scope="col" className="px-6 py-3 bg-gray-50 font-bold tracking-wider">
                                        <div className="flex items-center">
                                            <span>Status</span>
                                            {renderHeaderSortButton('status')}
                                        </div>
                                    </th>
                                    <th scope="col" className="px-6 py-3 bg-gray-50 font-bold tracking-wider text-center w-20">Action</th>
                                </tr>
                            </thead>

                            <tbody className="bg-white divide-y divide-gray-200">
                                
                                {/* 🟢 GROUP 1: SELECTED USERS PINNED TO THE TOP OF THE TABLE */}
                                {selectedObjects.length > 0 && (
                                    <>
                                        <tr className="bg-indigo-100 border-b border-indigo-200">
                                            <td colSpan="7" className="px-6 py-2 text-xs font-bold text-indigo-800 uppercase tracking-wider shadow-sm">
                                                Selected For Bulk Actions ({selectedObjects.length})
                                            </td>
                                        </tr>
                                        {selectedObjects.map(employee => renderDesktopRow(employee, true))}
                                        
                                        {unselectedFilteredUsers.length > 0 && (
                                            <tr className="bg-gray-100 border-b border-gray-200">
                                                <td colSpan="7" className="px-6 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider shadow-sm">
                                                    Other Filtered Employees
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                )}

                                {/* 🟢 GROUP 2: NORMAL UNSELECTED USERS */}
                                {unselectedFilteredUsers.map(employee => renderDesktopRow(employee, false))}

                                {/* NO RESULTS */}
                                {selectedObjects.length === 0 && unselectedFilteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-gray-500 font-medium">
                                            No employees found.
                                        </td>
                                    </tr>
                                )}

                            </tbody>
                        </table>
                    </div>

                    {/* 🟢 MOBILE VIEW */}
                    <div className="md:hidden">
                        {filteredUsers.length > 0 && (
                            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 cursor-pointer mr-3"
                                    checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length}
                                    onChange={handleSelectAll}
                                />
                                <span className="text-sm font-medium text-gray-700 truncate w-full pr-2">
                                    {selectedUsers.length > 0 ? `${selectedUsers.length} Selected` : 'Select All Filtered'}
                                </span>
                            </div>
                        )}

                        {selectedObjects.length === 0 && unselectedFilteredUsers.length === 0 ? (
                            <div className="px-4 py-12 text-center text-gray-500 font-medium">
                                No employees found.
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {/* 🟢 GROUP 1: SELECTED USERS PINNED TO TOP (MOBILE) */}
                                {selectedObjects.length > 0 && (
                                    <>
                                        <div className="bg-indigo-100 px-4 py-2 border-b border-indigo-200 text-xs font-bold text-indigo-800 uppercase tracking-wider">
                                            Selected for Bulk Actions ({selectedObjects.length})
                                        </div>
                                        {selectedObjects.map(employee => renderMobileRow(employee, true))}
                                        
                                        {unselectedFilteredUsers.length > 0 && (
                                            <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                Other Filtered Employees
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* 🟢 GROUP 2: NORMAL UNSELECTED USERS (MOBILE) */}
                                {unselectedFilteredUsers.map(employee => renderMobileRow(employee, false))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal show={isPositionModalOpen} onClose={closePositionModal} maxWidth="2xl">
                <div className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Edit Positions</h2>

                    <form onSubmit={submitPosition} className="mb-6 flex flex-col md:flex-row items-start md:items-end gap-3 rounded-md bg-gray-50 p-4 border border-gray-100">
                        <div className="flex-grow w-full md:w-auto">
                            <InputLabel htmlFor="department_id" value="Department" />
                            <select
                                id="department_id"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                value={positionData.department_id}
                                onChange={(e) => setPositionData('department_id', e.target.value)}
                                required
                            >
                                <option value="" disabled>Select Dept...</option>
                                {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>
                                        {dept.name}
                                    </option>
                                ))}
                            </select>
                            <InputError message={positionErrors.department_id} className="mt-2" />
                        </div>

                        <div className="flex-grow w-full md:w-auto">
                            <InputLabel htmlFor="position_name" value="New Position Name" />
                            <TextInput
                                id="position_name"
                                className="mt-1 block w-full"
                                value={positionData.position_name}
                                onChange={(e) => setPositionData('position_name', e.target.value)}
                                required
                                placeholder="e.g. Veterinarian"
                            />
                            <InputError message={positionErrors.position_name} className="mt-2" />
                        </div>
                        
                        <PrimaryButton className="mt-4 md:mt-0" disabled={positionProcessing || !canManageEmployees} title={!canManageEmployees ? 'Edit permission required' : ''}>Add</PrimaryButton>
                    </form>

                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        {positionData.department_id 
                            ? `Existing Positions (${departments.find(d => d.id === parseInt(positionData.department_id))?.name || 'Selected Dept'})` 
                            : 'All Existing Positions'}
                    </h3>
                    <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200">
                        <ul className="divide-y divide-gray-200">
                            {filteredManagePositions.map((pos) => {
                                const deptName = departments.find(d => d.id === pos.department_id)?.name || 'Unknown Dept';
                                return (
                                    <li key={pos.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                                        <div>
                                            <span className="text-sm font-medium text-gray-800 block">{pos.name}</span>
                                            {/* Only show the department name below the position if they are viewing "All Existing Positions" */}
                                            {!positionData.department_id && (
                                                <span className="text-xs text-gray-500">{deptName}</span>
                                            )}
                                        </div>
                                        <button onClick={() => confirmDeletePosition(pos)} className="text-xs font-medium text-red-600 hover:text-red-900">
                                            Delete
                                        </button>
                                    </li>
                                );
                            })}
                            {filteredManagePositions.length === 0 && (
                                <li className="p-4 text-sm text-gray-500 text-center">
                                    {positionData.department_id ? 'No positions found for this department.' : 'No positions found.'}
                                </li>
                            )}
                        </ul>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <SecondaryButton onClick={closePositionModal}>Close</SecondaryButton>
                    </div>
                </div>
            </Modal>

            <Modal show={isBranchModalOpen} onClose={closeBranchModal}>
                <div className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Manage Branches</h2>

                    <form onSubmit={submitBranch} className="mb-6 flex items-end gap-3 rounded-md bg-gray-50 p-4 border border-gray-100">
                        <div className="flex-grow">
                            <InputLabel htmlFor="new_branch_name" value="New Branch Name" />
                            <TextInput id="new_branch_name" className="mt-1 block w-full" value={branchData.name} onChange={(e) => setBranchData('name', e.target.value)} required placeholder="e.g. Makati, Greenhills" />
                            <InputError message={branchErrors.name} className="mt-2" />
                        </div>
                        <PrimaryButton disabled={branchProcessing || !canManageEmployees} title={!canManageEmployees ? 'Edit permission required' : ''}>Add</PrimaryButton>
                    </form>

                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Existing Branches</h3>
                    <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200">
                        <ul className="divide-y divide-gray-200">
                            {branches.map((branch) => (
                                <li key={branch.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                                    <span className="text-sm text-gray-800">{branch.name}</span>
                                    <button onClick={() => confirmDeleteBranch(branch)} className="text-xs font-medium text-red-600 hover:text-red-900">
                                        Delete
                                    </button>
                                </li>
                            ))}
                            {branches.length === 0 && (
                                <li className="p-4 text-sm text-gray-500 text-center">No branches found.</li>
                            )}
                        </ul>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <SecondaryButton onClick={closeBranchModal}>Close</SecondaryButton>
                    </div>
                </div>
            </Modal>

            <Modal show={isUserModalOpen} onClose={closeUserModal} maxWidth="2xl">
                <form onSubmit={submitUser} className="p-6">
                    <h2 className="mb-6 text-lg font-medium text-gray-900">Add New Employee</h2>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div>
                            <div>
                                <InputLabel htmlFor="name" value="Full Name" />
                                <TextInput id="name" className="mt-1 block w-full" value={userData.name} onChange={(e) => setUserData('name', e.target.value)} required />
                                <InputError message={userErrors.name} className="mt-2" />
                            </div>

                            <div className="mt-4">
                                <InputLabel htmlFor="email" value="Email Address" />
                                <TextInput id="email" type="email" className="mt-1 block w-full" value={userData.email} onChange={(e) => setUserData('email', e.target.value)} required />
                                <InputError message={userErrors.email} className="mt-2" />
                            </div>

                            <div className="mt-4">
                                <InputLabel htmlFor="role_id" value="System Role" />
                                <select 
                                    id="role_id" 
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" 
                                    value={userData.role_id} 
                                    onChange={(e) => setUserData('role_id', e.target.value)} 
                                    required
                                >
                                    <option value="" disabled>Select Role</option>
                                    {roles.map((role) => (
                                        <option key={role.id} value={role.id} className="capitalize">{role.name}</option>
                                    ))}
                                </select>
                                <InputError message={userErrors.role_id} className="mt-2" />
                            </div>

                            <div className="mt-4">
                                <InputLabel htmlFor="device_limit" value="Device Login Limit" />
                                <TextInput 
                                    id="device_limit" 
                                    type="number" 
                                    min="1" 
                                    className={`mt-1 block w-full ${!isCurrentUserAdmin ? 'bg-gray-100 text-gray-500' : ''}`} 
                                    value={userData.device_limit} 
                                    onChange={(e) => setUserData('device_limit', e.target.value)} 
                                    required 
                                    disabled={!isCurrentUserAdmin}
                                />
                                {!isCurrentUserAdmin && (
                                    <p className="mt-1 text-xs text-orange-500">Only Admins can adjust device limits.</p>
                                )}
                                <InputError message={userErrors.device_limit} className="mt-2" />
                            </div>
                        </div>

                        <div>
                            <div>
                                <InputLabel htmlFor="user_department" value="Department" />
                                <select id="user_department" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={userData.department_id} onChange={(e) => setUserData('department_id', e.target.value)} required>
                                    <option value="" disabled>Select Department</option>
                                    {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                                </select>
                                <InputError message={userErrors.department_id} className="mt-2" />
                            </div>

                            <div className="mt-4">
                                <InputLabel htmlFor="user_position" value="Position" />
                                <select id="user_position" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={userData.position_id} onChange={(e) => setUserData('position_id', e.target.value)} required disabled={!userData.department_id}>
                                    <option value="" disabled>Select Position</option>
                                    {filteredPositionsForUser.map((pos) => <option key={pos.id} value={pos.id}>{pos.name}</option>)}
                                </select>
                                <InputError message={userErrors.position_id} className="mt-2" />
                            </div>

                            <div className="mt-4">
                                <InputLabel value="Assign Branches" />
                                <div className="mt-2 max-h-32 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-3">
                                    {branches.map((branch) => (
                                        <label key={branch.id} className="flex items-center">
                                            <input type="checkbox" className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500" value={branch.id} checked={userData.branch_ids.includes(branch.id)} onChange={(e) => handleBranchCheckbox(e, branch.id)} />
                                            <span className="ml-2 text-sm text-gray-600">{branch.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <InputError message={userErrors.branch_ids} className="mt-2" />
                                <p className="mt-1 text-xs text-gray-500">Selecting multiple branches automatically sets the employee as rotating.</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <SecondaryButton type="button" onClick={closeUserModal}>Cancel</SecondaryButton>
                        <PrimaryButton className="ms-3" disabled={userProcessing || !canManageEmployees}>
                            Create Employee
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            {/* EDIT USER MODAL */}
            <Modal show={isEditUserModalOpen} onClose={closeEditUserModal} maxWidth="2xl">
                <form onSubmit={submitEditUser} className="p-6">
                    <h2 className="mb-6 text-lg font-medium text-gray-900">Edit Employee</h2>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div>
                            <div>
                                <InputLabel htmlFor="edit_name" value="Full Name" />
                                <TextInput id="edit_name" className="mt-1 block w-full" value={editUserData.name} onChange={(e) => setEditData('name', e.target.value)} required />
                                <InputError message={editErrors.name} className="mt-2" />
                            </div>

                            <div className="mt-4">
                                <InputLabel htmlFor="edit_email" value="Email Address" />
                                <TextInput id="edit_email" type="email" className="mt-1 block w-full" value={editUserData.email} onChange={(e) => setEditData('email', e.target.value)} required />
                                <InputError message={editErrors.email} className="mt-2" />
                            </div>

                            <div className="mt-4">
                                <InputLabel htmlFor="edit_role_id" value="System Role" />
                                <select 
                                    id="edit_role_id" 
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" 
                                    value={editUserData.role_id || ''} 
                                    onChange={(e) => setEditData('role_id', e.target.value)} 
                                    required
                                >
                                    <option value="" disabled>Select Role</option>
                                    {roles.map((role) => <option key={role.id} value={role.id} className="capitalize">{role.name}</option>)}
                                </select>
                                <InputError message={editErrors.role_id} className="mt-2" />
                            </div>

                            <div className="mt-4">
                                <InputLabel htmlFor="edit_device_limit" value="Device Login Limit" />
                                <TextInput 
                                    id="edit_device_limit" 
                                    type="number" 
                                    min="1" 
                                    className={`mt-1 block w-full ${!isCurrentUserAdmin ? 'bg-gray-100 text-gray-500' : ''}`} 
                                    value={editUserData.device_limit} 
                                    onChange={(e) => setEditData('device_limit', e.target.value)} 
                                    required 
                                    disabled={!isCurrentUserAdmin}
                                />
                                {!isCurrentUserAdmin && (
                                    <p className="mt-1 text-xs text-orange-500">Only Admins can adjust device limits.</p>
                                )}
                                <InputError message={editErrors.device_limit} className="mt-2" />
                            </div>
                        </div>

                        <div>
                            <div>
                                <InputLabel htmlFor="edit_department" value="Department" />
                                <select id="edit_department" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" value={editUserData.department_id} onChange={(e) => setEditData('department_id', e.target.value)} required>
                                    <option value="" disabled>Select Department</option>
                                    {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                                </select>
                                <InputError message={editErrors.department_id} className="mt-2" />
                            </div>

                            <div className="mt-4">
                                <InputLabel htmlFor="edit_position" value="Position" />
                                <select 
                                    id="edit_position" 
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" 
                                    value={editUserData.position_id} 
                                    onChange={(e) => setEditData('position_id', e.target.value)} 
                                    required 
                                    disabled={!editUserData.department_id}
                                >
                                    <option value="" disabled>Select Position</option>
                                    {filteredEditPositions.map((pos) => <option key={pos.id} value={pos.id}>{pos.name}</option>)}
                                </select>
                                <InputError message={editErrors.position_id} className="mt-2" />
                            </div>

                            <div className="mt-4">
                                <InputLabel value="Assign Branches" />
                                <div className="mt-2 max-h-32 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-3">
                                    {branches.map((branch) => (
                                        <label key={`edit-branch-${branch.id}`} className="flex items-center">
                                            <input type="checkbox" className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500" value={branch.id} checked={editUserData.branch_ids.includes(branch.id)} onChange={(e) => handleEditBranchCheckbox(e, branch.id)} />
                                            <span className="ml-2 text-sm text-gray-600">{branch.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <InputError message={editErrors.branch_ids} className="mt-2" />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <SecondaryButton type="button" onClick={closeEditUserModal}>Cancel</SecondaryButton>
                        <PrimaryButton className="ms-3" disabled={editProcessing || !canManageEmployees}>
                            Update Employee
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            <Modal show={isDepartmentModalOpen} onClose={closeDepartmentModal}>
                <div className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Manage Departments</h2>

                    <form onSubmit={submitDepartment} className="mb-6 flex items-end gap-3 rounded-md bg-gray-50 p-4 border border-gray-100">
                        <div className="flex-grow">
                            <InputLabel htmlFor="dept_name" value="New Department Name" />
                            <TextInput id="dept_name" className="mt-1 block w-full" value={deptData.name} onChange={(e) => setDeptData('name', e.target.value)} required placeholder="e.g. Grooming, Surgery" />
                            <InputError message={deptErrors.name} className="mt-2" />
                        </div>
                        <PrimaryButton disabled={deptProcessing || !canManageEmployees} title={!canManageEmployees ? 'Edit permission required' : ''}>Add</PrimaryButton>
                    </form>

                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Existing Departments</h3>
                    <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200">
                        <ul className="divide-y divide-gray-200">
                            {departments.map((dept) => (
                                <li key={dept.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                                    <span className="text-sm text-gray-800">{dept.name}</span>
                                    <button type="button" onClick={() => confirmDeleteDepartment(dept)} className="text-xs font-medium text-red-600 hover:text-red-900">
                                        Delete
                                    </button>
                                </li>
                            ))}
                            {departments.length === 0 && (
                                <li className="p-4 text-sm text-gray-500 text-center">No departments found.</li>
                            )}
                        </ul>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <SecondaryButton type="button" onClick={closeDepartmentModal}>Close</SecondaryButton>
                    </div>
                </div>
            </Modal>

            <Modal show={isRoleModalOpen} onClose={closeRoleModal}>
                <div className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Manage Roles</h2>

                    <form onSubmit={submitRole} className="mb-6 flex items-end gap-3 rounded-md bg-gray-50 p-4 border border-gray-100">
                        <div className="flex-grow">
                            <InputLabel htmlFor="role_name" value="New Role Name" />
                            <TextInput id="role_name" className="mt-1 block w-full" value={roleData.name} onChange={(e) => setRoleData('name', e.target.value)} required placeholder="e.g. Admin, Staff" />
                            <InputError message={roleErrors.name} className="mt-2" />
                        </div>
                        <PrimaryButton disabled={roleProcessing || !canManageEmployees} title={!canManageEmployees ? 'Edit permission required' : ''}>Add</PrimaryButton>
                    </form>

                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Existing System Roles</h3>
                    <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200">
                        <ul className="divide-y divide-gray-200">
                            {roles.map((role) => (
                                <li key={role.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                                    <span className="text-sm text-gray-800 capitalize">{role.name}</span>
                                    <button type="button" onClick={() => confirmDeleteRole(role)} className="text-xs font-medium text-red-600 hover:text-red-900">
                                        Delete
                                    </button>
                                </li>
                            ))}
                            {roles.length === 0 && (
                                <li className="p-4 text-sm text-gray-500 text-center">No roles found.</li>
                            )}
                        </ul>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <SecondaryButton type="button" onClick={closeRoleModal}>Close</SecondaryButton>
                    </div>
                </div>
            </Modal>

            {/* BULK CHANGE DEVICE LIMIT MODAL */}
            <Modal show={isBulkLimitModalOpen} onClose={() => setBulkLimitModalOpen(false)} maxWidth="md">
                <form onSubmit={submitBulkLimit} className="p-6">
                    <h2 className="mb-4 text-lg font-medium text-gray-900">Bulk Change Device Limit</h2>
                    <p className="mb-4 text-sm text-gray-600">
                        Set a new device limit for the following {selectedObjects.length} employee(s): {displayNames}
                    </p>

                    <div>
                        <InputLabel htmlFor="bulk_limit" value="Device Login Limit" />
                        <TextInput
                            id="bulk_limit"
                            type="number"
                            min="1"
                            className="mt-1 block w-full"
                            value={bulkLimitData.limit}
                            onChange={(e) => setBulkLimitData('limit', e.target.value)}
                            required
                        />
                    </div>

                    <div className="mt-6 flex justify-end">
                        <SecondaryButton type="button" onClick={() => setBulkLimitModalOpen(false)}>Cancel</SecondaryButton>
                        <PrimaryButton className="ms-3" disabled={bulkLimitProcessing}>
                            Save Changes
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                show={confirmDialog.isOpen}
                onClose={closeConfirmModal}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText={confirmDialog.confirmText}
                confirmColor={confirmDialog.confirmColor}
                onConfirm={confirmDialog.onConfirm}
            />
        </SidebarLayout>
    );
}
