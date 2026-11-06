<?php

return [
    // Exact role names only: unrelated administrators do not inherit IT privileges.
    'leader_roles' => ['IT TL', 'IT Team Leader', 'IT Supervisor'],
    'member_roles' => ['IT Member', 'IT Staff'],
    // Branch selection exceptions do not grant IT ticket-management permissions.
    // IT department staff may report any affected location, regardless of job role.
    'all_branch_departments' => ['Information Technology'],
    'all_branch_roles' => ['Executive Vice President', 'Executive Assistant', 'IT', 'IT Admin'],
    // This single list supplies both the React dropdown and Laravel validation.
    'categories' => ['Hardware', 'Software', 'Network', 'Account & Access', 'Other'],
];
