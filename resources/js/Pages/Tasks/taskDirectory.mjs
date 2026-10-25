import { canViewWeeklyReport } from './weeklyReportAccess.mjs';
import { departmentLeadership, additionalTeamLeaderPositions } from './organizationStructure.mjs';
// Department names follow the supplied organization chart; identities remain sample John Doe records.
export const branches = ['Alabang', 'Makati', 'Greenhills'];
export const departments = [
    'Veterinary', 'Vet Tech', 'Clinic Assistant', 'Sales & Marketing', 'Customer Service',
    'Security', 'Facilities', 'Reception', 'Cashier', 'Inventory', 'Accounting',
    'Procurement', 'Internal Audit', 'IT', 'HR', 'Operations & Finance',
];

const positions = {
    Veterinary: 'Veterinarian', 'Vet Tech': 'Vet Tech', 'Clinic Assistant': 'Clinic Assistant',
    'Sales & Marketing': 'Sales & Marketing Assistant', 'Customer Service': 'Customer Service Associate',
    Security: 'Security Guard', Facilities: 'Company Driver', Reception: 'Receptionist',
    Cashier: 'Cashier Assistant', Inventory: 'Inventory Assistant', Accounting: 'General Accounting Assistant',
    Procurement: 'Procurement Assistant', 'Internal Audit': 'Internal Auditor', IT: 'IT Associate',
    HR: 'HR Assistant', 'Operations & Finance': 'Operations & Finance Coordinator',
};

// Retain the first five sample identities so saved assignments can be enriched without a reset.
const initial = [
    ['John Doe', 'IT', 'Makati'],
    ['John Doe 2', 'Inventory', 'Alabang'],
    ['John Doe 3', 'Inventory', 'Greenhills'],
    ['John Doe 4', 'Reception', 'Makati'],
    ['John Doe 5', 'Clinic Assistant', 'Alabang'],
].map(([name, department, branch]) => ({ name, department, branch, position: positions[department] }));

// Include one sample employee in every department/branch combination for UI exploration.
export const employees = [...initial];
for (const department of departments) {
    for (const branch of branches) {
        if (!employees.some(employee => employee.department === department && employee.branch === branch)) {
            employees.push({ name: `John Doe ${employees.length + 1}`, department, branch, position: positions[department] });
        }
    }
}
export const employeeByName = name => employees.find(employee => employee.name === name);

// Branch OMs and chart-defined department leaders retain their original sample identities.
export const operationsManagers = branches.map((branch, index) => ({
    name: `John Doe ${employees.length + index + 1}`, branch, position: 'Operations Manager',
}));
export const legacyDepartmentLeaders = departments.map((department, index) => ({
    name: `John Doe ${employees.length + operationsManagers.length + index + 1}`, department, position: 'Team Leader',
}));
export const teamLeaders = [...legacyDepartmentLeaders.filter(person => departmentLeadership[person.department]?.role === 'Team Leader').map(person => ({ ...person, ...departmentLeadership[person.department] })), ...additionalTeamLeaderPositions.map((person, index) => ({ ...person, name: `John Doe ${employees.length + operationsManagers.length + departments.length + 6 + index}` }))];
export const departmentSupervisors = legacyDepartmentLeaders.filter(person => departmentLeadership[person.department]?.role === 'Supervisor').map(person => ({ ...person, position: departmentLeadership[person.department].position, role: 'Employee', employeeType: 'Supervisor' }));
export const managerForBranch = branch => operationsManagers.find(manager => manager.branch === branch);
export const leaderForDepartment = department => teamLeaders.find(leader => leader.department === department) || departmentSupervisors.find(person => person.department === department);

// These are prototype visibility rules, not a replacement for server authorization during backend integration.
export function tasksForPreview(tasks, scope) {
    const { role, branch, department, employee, actor } = scope;
    return tasks.filter(task => !task.supersededOpeningReport && (task.template !== 'intern-weekly-report' || canViewWeeklyReport(task, scope)) && (actor && (task.assignee === actor || task.requestedBy === actor || task.approvalReviewer === actor || task.coordinator === actor || task.coordinators?.includes(actor)) || (role === 'Employee' ? task.sharedBranchReport && task.department === (scope.employeeDepartment || department) || task.assignee === employee || task.coordinator === employee || task.coordinators?.includes(employee)
        : ['Operations Manager', 'Chief Vet'].includes(role) ? task.branch === branch || task.originBranch === branch
        : role === 'Team Leader' ? task.department === department || task.originDepartment === department : true)));
}
export function employeesForPreview({ role, branch, department, employee }) {
    return employees.filter(person => role === 'Employee' ? person.name === employee
        : role === 'Operations Manager' ? person.branch === branch
        : role === 'Team Leader' ? person.department === department : true);
}

// Give the ordinary sample tasks department-appropriate owners rather than assigning clinic work to IT.
const sampleTeams = [
    ['Veterinary', 'Makati'], ['Inventory', 'Alabang'], ['Inventory', 'Greenhills'],
    ['Reception', 'Makati'], ['Clinic Assistant', 'Alabang'], ['Operations & Finance', 'Makati'],
    ['HR', 'Makati'], ['Vet Tech', 'Greenhills'],
];
export const sampleTaskOwner = index => employees.find(employee => employee.department === sampleTeams[index]?.[0] && employee.branch === sampleTeams[index]?.[1]);

// Backfill new organization fields on earlier browser-saved sample tasks.
export function enrichTask(task) {
    const employee = employeeByName(task.assignee);
    return { ...task, department: task.department || employee?.department || 'Operations & Finance', branch: task.branch || employee?.branch || 'Makati', template: task.template || 'standard' };
}

// Opening Rounds is an assigned IT checklist, with an example available at each location.
export function openingRoundsTasks(date) {
    return branches.map((branch, index) => ({
        id: 101 + index, title: 'Opening Rounds', assignee: employees.find(employee => employee.department === 'IT' && employee.branch === branch).name,
        department: 'IT', branch, template: 'it-opening-rounds', priority: 'High', due: date,
        status: 'Not Started', description: 'Check IT systems and record the daily rounds update before clinic operations begin.',
        submission: '', link: '', remarks: '', kind: 'Assigned task',
    }));
}
export function ensureOpeningRounds(tasks, date) {
    const updated = tasks.map(enrichTask);
    for (const task of openingRoundsTasks(date)) {
        if (!updated.some(existing => existing.template === task.template && existing.branch === task.branch)) updated.push(task);
    }
    return updated;
}
