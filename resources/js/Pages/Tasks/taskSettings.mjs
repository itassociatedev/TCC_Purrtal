import { applyOrganizationStructure } from './organizationStructure.mjs';
import { defaultRoleHolders } from './assignmentDirectory.mjs';
import { defaultReportTemplates, editReportTemplates } from './reportTemplates.mjs';
import { branches, departments, employees, operationsManagers, legacyDepartmentLeaders } from './taskDirectory.mjs';
import { systemChecks } from './openingRounds.mjs';

export const baseRoles = ['Employee', 'Team Leader', 'Operations Manager', 'Chief Vet', 'EVP'];
// Corporate Services shares the EVP workflow across all departments and branches.
export const corporateServicesRole = { name: 'Corporate Services', baseRole: 'EVP', departments: ['Operations & Finance', 'Internal Audit', 'HR', 'Sales & Marketing'] };
export function defaultSettings() {
    const config = structuredClone({
        branches, departments, itDepartment: 'IT', cashierDepartment: 'Cashier',
        roles: [...baseRoles.map(name => ({ name, baseRole: name })), corporateServicesRole],
        corporateServicesVersion: 1, internRoleVersion: 2,
        dailyReports: defaultReportTemplates({}),
        employees: employees.map(employee => ({ ...employee, role: 'Employee', employeeType: 'Regular', availableBranches: [...branches] })),
        operationsManagers, teamLeaders: legacyDepartmentLeaders, priorities: ['High', 'Medium', 'Low'], checks: systemChecks,
    });
    return applyOrganizationStructure({ ...config, roleHolders: defaultRoleHolders(config) });
}
export function loadSettings(raw) {
    const defaults = defaultSettings();
    // Ignore incomplete old configuration rather than breaking the task workspace on startup.
    if (!raw || !['branches', 'departments', 'roles', 'employees', 'operationsManagers', 'teamLeaders', 'priorities', 'checks'].every(key => Array.isArray(raw[key]) && raw[key].length)) return defaults;
    // Upgrade existing browser settings once, preserving custom roles and later administrator edits.
    const roles = raw.corporateServicesVersion ? raw.roles : [...raw.roles.filter(role => role.name !== corporateServicesRole.name), structuredClone(corporateServicesRole)];
    // Convert the previous standalone Intern role into an Employee subtype without changing task identities.
    const employeeRole = roles.find(role => role.name !== 'Intern' && role.baseRole === 'Employee')?.name || 'Employee';
    const upgradedRoles = roles.filter(role => role.name !== 'Intern').map(({ weeklyReport, ...role }) => role);
    if (!upgradedRoles.some(role => role.baseRole === 'Employee')) upgradedRoles.unshift({ name: employeeRole, baseRole: 'Employee' });
    const employees = raw.employees.map(person => ({ ...person, role: person.role === 'Intern' ? employeeRole : person.role, employeeType: person.role === 'Intern' || raw.roles.find(role => role.name === person.role)?.weeklyReport ? 'Intern' : person.employeeType || 'Regular' }));
    return applyOrganizationStructure({ ...defaults, ...raw, organizationStructureVersion: raw.organizationStructureVersion || 0, internRoleVersion: 2, roles: upgradedRoles, employees, roleHolders: raw.roleHolders || defaultRoleHolders({ ...defaults, ...raw, roles: upgradedRoles, employees }), corporateServicesVersion: 1, dailyReports: raw.dailyReports || defaultReportTemplates(raw) });
}
export const canWorkAt = (employee, branch) => (employee?.availableBranches || [employee?.branch]).includes(branch);
export function eligibleEmployees(config, { role, branch, department, employee }) {
    return config.employees.filter(person => role === 'Employee' ? person.name === employee
        : ['Operations Manager', 'Chief Vet'].includes(role) ? canWorkAt(person, branch)
        : role === 'Team Leader' ? person.department === department : true);
}

// Centralized edits validate references and return new objects, so failed edits cannot partially mutate state.
export function changeSetting(config, tasks, { entity, action, original, value }) {
    if (entity === 'dailyReports') return editReportTemplates(config, tasks, { action, original, value });
    const next = structuredClone(config);
    let updatedTasks = structuredClone(tasks);
    if (!Object.hasOwn(next, entity) || !Array.isArray(next[entity])) throw new Error('Unknown setting.');
    const simple = ['departments', 'branches', 'priorities'].includes(entity);
    const checklist = entity === 'checks';
    const leadership = ['operationsManagers', 'teamLeaders'].includes(entity);
    const identity = row => simple ? row : checklist ? row[0] : entity === 'operationsManagers' ? row.branch : row.name;
    const index = next[entity].findIndex(row => identity(row) === original);
    if (action !== 'add' && index < 0) throw new Error('This entry no longer exists.');
    const label = simple ? String(value?.name || '').trim() : checklist ? String(value?.label || '').trim() : String(value?.name || '').trim();
    if (action !== 'remove' && !label) throw new Error('Enter a name.');
    if (action !== 'remove' && next[entity].some((row, i) => i !== index && String(simple ? row : checklist ? row[1] : row.name).toLowerCase() === label.toLowerCase())) throw new Error('That name is already in use.');
    if (entity === 'operationsManagers' && action !== 'edit') throw new Error('Add or remove the corresponding branch or department to change leadership coverage.');
    if (action === 'remove') {
        if (entity === 'teamLeaders' && tasks.some(task => task.assignee === next[entity][index].name || task.coordinator === next[entity][index].name || task.coordinators?.includes(next[entity][index].name))) throw new Error('Reassign this leader’s tasks before removing the position.');
        if (next[entity].length <= 1) throw new Error('Keep at least one entry.');
        if (entity === 'departments' && next.dailyReports?.some(report => report.department === original)) throw new Error('Reassign or remove this department’s daily report templates first.');
        if (entity === 'departments' && original === next.itDepartment) throw new Error('This department is used by Opening Rounds.');
        if (entity === 'departments' && (next.employees.some(person => person.department === original) || tasks.some(task => task.department === original))) throw new Error('Reassign employees and tasks before removing this department.');
        if (entity === 'branches' && (next.employees.some(person => person.branch === original || canWorkAt(person, original)) || tasks.some(task => task.branch === original))) throw new Error('Remove employee branch assignments and reassign tasks before removing this branch.');
        if (entity === 'roles' && [...next.employees, ...(next.roleHolders || [])].some(person => person.role === original)) throw new Error('Assign another role to these employees first.');
        if (['employees', 'roleHolders'].includes(entity)) {
            // Untouched automatically assigned daily instances can be removed with a new employee record.
            const untouched = task => task.recurrence === 'daily' && task.status === 'Not Started' && !task.submission && !task.rounds && !task.narrative && !task.operations && !task.customReport && !task.weeklyReport && !task.history?.length;
            if (tasks.some(task => task.assignee === original && !untouched(task))) throw new Error('Reassign this employee’s tasks before removing them.');
            updatedTasks = updatedTasks.filter(task => task.assignee !== original);
        }
        if (entity === 'priorities' && tasks.some(task => task.priority === original)) throw new Error('Change the priority of tasks using this entry first.');
        next[entity].splice(index, 1);
        if (entity === 'branches') next.operationsManagers = next.operationsManagers.filter(manager => manager.branch !== original);
        if (entity === 'departments') next.teamLeaders = next.teamLeaders.filter(leader => leader.department !== original);
    } else {
        let record = label;
        if (entity === 'roles') {
            if (!baseRoles.includes(value.baseRole)) throw new Error('Choose a supported role workflow.');
            if (action === 'edit' && value.baseRole !== 'Employee' && next.employees.some(person => person.role === original)) throw new Error('A role used by employees must keep the Employee workflow. Reassign those employees first.');
            record = { ...next[entity][index], name: label, baseRole: value.baseRole };
        }
        if (['employees', 'roleHolders'].includes(entity)) {
            const otherPeople = ['employees', 'roleHolders', 'teamLeaders', 'operationsManagers'].flatMap(key => (next[key] || []).filter((_, i) => key !== entity || i !== index));
            if (otherPeople.some(person => person.name.toLowerCase() === label.toLowerCase())) throw new Error('That person name is already in the assignment directory.');
            const availableBranches = [...new Set([value.branch, ...(value.availableBranches || [])])];
            if (!next.departments.includes(value.department) || !next.branches.includes(value.branch) || availableBranches.some(branch => !next.branches.includes(branch)) || !next.roles.some(role => role.name === value.role)) throw new Error('Choose valid department, branch, and role values.');
            if (entity === 'roleHolders' && !next.roles.some(role => role.name === value.role && !['Employee', 'Team Leader', 'Operations Manager'].includes(role.baseRole))) throw new Error('Use Employees or the leadership tabs for Employee, TL, and OM records.');
            if (entity === 'employees' && next.roles.find(role => role.name === value.role)?.baseRole !== 'Employee') throw new Error('Assign OMs and Team Leaders through their leadership tabs; employee records use an Employee workflow role.');
            if (action === 'edit' && Object.values(next[entity][index].branchSchedule || {}).some(branch => branch !== 'Off' && !availableBranches.includes(branch))) throw new Error('Update scheduled branch assignments before removing an allowed branch.');
            if (action === 'edit' && tasks.some(task => task.assignee === original && !availableBranches.includes(task.branch))) throw new Error('This employee still has tasks at a branch you removed. Reassign those tasks first.');
            record = { ...(action === 'edit' ? next[entity][index] : {}), name: label, department: value.department, branch: value.branch, role: value.role, employeeType: ['Intern', 'Supervisor'].includes(value.employeeType) ? value.employeeType : 'Regular', position: String(value.position || 'Team member').trim(), availableBranches };
        }
        if (leadership) record = { ...next[entity][index], name: label };
        if (entity === 'teamLeaders') {
            if (!next.departments.includes(value.department) || !next.roles.some(role => role.name === value.role && role.baseRole === 'Team Leader') || !value.position?.trim()) throw new Error('Choose a valid department, leadership role, and position title.');
            if (next.teamLeaders.some((person, i) => i !== index && person.department === value.department && person.position === value.position.trim() && (person.branch || next.branches[0]) === (value.branch || next.branches[0]))) throw new Error('This leadership position already has an assigned person.');
            if (['employees', 'roleHolders', 'operationsManagers'].some(key => next[key]?.some(person => person.name.toLowerCase() === label.toLowerCase()))) throw new Error('That person name is already in the assignment directory.');
            record = { ...record, department: value.department, role: value.role, position: value.position.trim(), branch: value.branch || record.branch || next.branches[0] };
            const oldName = next.teamLeaders[index]?.name;
            if (oldName) updatedTasks = updatedTasks.map(task => ({ ...task,
                ...(task.assignee === oldName ? { assignee: label, assigneeRole: value.role } : {}),
                coordinator: task.coordinator === oldName ? label : task.coordinator,
                coordinators: task.coordinators?.map(name => name === oldName ? label : name),
                requestedBy: task.requestedBy === oldName ? label : task.requestedBy,
            }));
        }
        if (checklist) record = [action === 'edit' ? original : `system-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label];
        if (action === 'add') next[entity].push(record); else next[entity][index] = record;
        const nextJohn = () => {
            const names = new Set([...next.employees, ...next.operationsManagers, ...next.teamLeaders, ...(next.roleHolders || [])].map(person => person.name));
            let number = 1; while (names.has(`John Doe ${number}`)) number++;
            return `John Doe ${number}`;
        };
        // New departments have no department leader until one is configured explicitly.
        if (action === 'add' && entity === 'branches') next.operationsManagers.push({ name: nextJohn(), branch: label, position: 'Operations Manager' });
        if (action === 'edit') {
            const replace = name => name === original ? label : name;
            if (entity === 'branches') {
                next.employees = next.employees.map(person => ({ ...person, branch: replace(person.branch), availableBranches: person.availableBranches.map(replace), branchSchedule: Object.fromEntries(Object.entries(person.branchSchedule || {}).map(([date, branch]) => [date, replace(branch)])) }));
                next.operationsManagers = next.operationsManagers.map(person => ({ ...person, branch: replace(person.branch) }));
                next.roleHolders = next.roleHolders?.map(person => ({ ...person, branch: replace(person.branch), availableBranches: person.availableBranches.map(replace) }));
                updatedTasks = updatedTasks.map(task => ({ ...task, branch: replace(task.branch), ...(task.rounds && ['Not Started', 'In Progress', 'Revision Needed'].includes(task.status) ? { rounds: { ...task.rounds, branch: replace(task.rounds.branch) } } : {}) }));
            }
            if (entity === 'departments') {
                next.employees = next.employees.map(person => ({ ...person, department: replace(person.department) }));
                next.teamLeaders = next.teamLeaders.map(person => ({ ...person, department: replace(person.department) }));
                next.dailyReports = next.dailyReports?.map(report => ({ ...report, department: replace(report.department) }));
                next.roleHolders = next.roleHolders?.map(person => ({ ...person, department: replace(person.department) }));
                next.itDepartment = replace(next.itDepartment);
                next.cashierDepartment = replace(next.cashierDepartment);
                updatedTasks = updatedTasks.map(task => ({ ...task, department: replace(task.department), ...(task.rounds && ['Not Started', 'In Progress', 'Revision Needed'].includes(task.status) ? { rounds: { ...task.rounds, department: replace(task.rounds.department) } } : {}) }));
            }
            if (entity === 'roles') { next.teamLeaders = next.teamLeaders.map(person => ({ ...person, role: replace(person.role) })); next.employees = next.employees.map(person => ({ ...person, role: replace(person.role) })); next.roleHolders = next.roleHolders?.map(person => ({ ...person, role: replace(person.role) })); }
            if (['employees', 'roleHolders'].includes(entity)) updatedTasks = updatedTasks.map(task => task.assignee === original ? { ...task, assignee: label } : task);
            if (entity === 'priorities') updatedTasks = updatedTasks.map(task => ({ ...task, priority: replace(task.priority) }));
        }
        if (entity === 'priorities' && Number.isInteger(Number(value.rank))) {
            next.priorities = next.priorities.filter(name => name !== label);
            next.priorities.splice(Math.max(0, Math.min(Number(value.rank) - 1, next.priorities.length)), 0, label);
        }
    }
    return { config: next, tasks: updatedTasks };
}
