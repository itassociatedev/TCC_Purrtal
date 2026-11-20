<?php

return [
    // EVP has leaderboard-only access in addition to its ordinary position workflow.
    'leaderboard_viewer_roles' => ['Executive Vice President'],
    // TicketAccess classifies IT Team Leader as supervisor and all other IT positions as members.
    // Branch selection exceptions do not grant IT ticket-management permissions.
    // IT department staff may report any affected location, regardless of job role.
    'all_branch_departments' => ['Information Technology'],
    'all_branch_roles' => ['Executive Vice President', 'Executive Assistant', 'IT', 'IT Admin'],
    // This single list supplies both the React dropdown and Laravel validation.
    'categories' => ['Hardware', 'Software', 'Network', 'Account & Access', 'Other'],
];
