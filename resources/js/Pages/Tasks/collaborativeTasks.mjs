import { assignmentDirectory } from './assignmentDirectory.mjs';
const actorName = context => context.role === 'Employee' ? context.employee : context.actor;
export const isCollaborativeTask = task => task.template === 'collaborative';
export function validateCollaborativeSubmission(task, changes) {
    return (isCollaborativeTask(task) || task.parentId) && ['Pending Review','Completed'].includes(changes.status)
        && !String(changes.submission ?? task.submission ?? '').trim()
        ? 'Every collaborative assignment needs a text or link submission before it can be submitted or completed.' : '';
}
// Corporate Services uses the EVP base workflow, so it shares the same creation capability.
export const canCreateCollaborative = role => ['EVP', 'Operations Manager', 'Team Leader', 'Corporate Services'].includes(role);
export const canOwnCollaborative = person => canCreateCollaborative(person?.baseRole) || person?.role === 'Corporate Services' || person?.roleGroup === 'Corporate Services';
// Monitoring can be owned by department leaders, branch managers, or Corporate Services.
export const canMonitorCollaborative = person => ['Team Leader', 'Operations Manager'].includes(person?.baseRole) || person?.employeeType === 'Supervisor' || (person?.role === 'Corporate Services' || person?.roleGroup === 'Corporate Services');
// Department filters apply to TLs; OM and Corporate monitoring spans departments.
export const monitorMatchesAssignment = (person, assignment) => canMonitorCollaborative(person)
    && (person.baseRole !== 'Team Leader' && person.employeeType !== 'Supervisor' || person.department === assignment.department)
    && (person.availableBranches || [person.branch]).includes(assignment.branch);
export const childTasks = (task, tasks) => tasks.filter(item => item.parentId === task.id);
// Reserve at least one full calendar day for each higher level to review and consolidate the work.
export function childDeadline(parentDeadline) {
    const date = new Date(`${parentDeadline}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
}
export function taskHierarchy(task, tasks, depth = 0, visited = new Set()) {
    if (visited.has(task.id)) return [];
    visited.add(task.id);
    return childTasks(task, tasks).flatMap(child => [{ task: child, depth }, ...taskHierarchy(child, tasks, depth + 1, visited)]);
}
export function dependencyBlockers(task, tasks) {
    const prerequisites = (task.dependsOn || []).map(id => tasks.find(item => item.id === id) || { title: 'Missing prerequisite task', status: 'Missing' }).filter(item => item.status !== 'Completed');
    if (isCollaborativeTask(task)) {
        const children = childTasks(task, tasks);
        const descendants = taskHierarchy(task, tasks).map(row => row.task);
        return [...prerequisites, ...(children.length ? descendants.filter(item => item.status !== 'Completed') : [{ title: 'Assign at least one child task' }])];
    }
    return prerequisites;
}
export const canDelegate = (task, context) => (isCollaborativeTask(task) || task.parentId && (canCreateCollaborative(context.role) || context.employeeType === 'Supervisor')) && Boolean(actorName(context)) && task.assignee === actorName(context) && ['Not Started', 'In Progress', 'Revision Needed'].includes(task.status);
export function canReviewCollaborativeChild(task, tasks, context) {
    const parent = tasks.find(item => item.id === task.parentId);
    return Boolean(parent && isCollaborativeTask(parent) && Boolean(actorName(context)) && parent.assignee === actorName(context) && task.assignee !== actorName(context));
}
// Prerequisites can point only to existing siblings, so new child tasks cannot introduce cycles.
export function createChildTask(parent, tasks, config, context, value) {
    if (!canDelegate(parent, context)) throw new Error('Only the main task’s assigned coordinator can delegate child tasks.');
    const employee = assignmentDirectory(config).find(person => person.name === value.assignee);
    const monitoring = value.taskType === 'monitoring' || value.taskType === 'auto' && canMonitorCollaborative(employee);
    if (!employee || !monitoring && employee.name === parent.assignee || !(employee.availableBranches || [employee.branch]).includes(value.branch)) throw new Error('Choose another employee and one of their allowed branches.');
    if (!value.title?.trim() || !value.description?.trim()) throw new Error('Enter a title and clear instructions for this child task.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.due) || value.due >= parent.due) throw new Error('The child deadline must be earlier than its parent deadline. Each higher level needs time to review.');
    const siblings = childTasks(parent, tasks);
    const dependsOn = [...new Set(value.dependsOn || [])];
    if (dependsOn.some(id => !siblings.some(item => item.id === id))) throw new Error('Choose prerequisites from this main task’s existing child tasks.');
    if (dependsOn.some(id => siblings.find(item => item.id === id).due > value.due)) throw new Error('Set this deadline on or after its prerequisites’ deadlines.');
    return { id: Math.max(Date.now(), ...tasks.map(item => Number(item.id) + 1 || 1)), title: value.title.trim(), description: value.description.trim(), assignee: employee.name, assigneeRole: employee.role, department: employee.department, branch: value.branch, template: monitoring ? 'collaborative' : 'standard', kind: monitoring ? 'Monitoring / delegated task' : 'Collaborative child task', parentId: parent.id, rootId: parent.rootId || parent.id, coordinator: parent.assignee, coordinators: [...new Set([...(parent.coordinators || []), parent.assignee])], requestedBy: parent.assignee, originDepartment: parent.originDepartment || parent.department, originBranch: parent.originBranch || parent.branch, dependsOn, due: value.due, priority: parent.priority, status: 'Not Started', submission: '', remarks: '', link: '', history: [{ text: `Child task assigned by ${parent.assignee}.`, at: new Date().toISOString() }] };
}
// Creating the final deliverable also creates a separate monitoring assignment for its designated lead.
export function createCollaborativeMain(draft, tasks, config, context, monitoring) {
    if (!canCreateCollaborative(context.role) || !context.actor) throw new Error('Only EVP, Corporate Services, OM, and Team Leaders can create collaborative tasks.');
    const people = assignmentDirectory(config);
    const requester = people.find(person => person.name === context.actor);
    if (!requester || !monitoring.title?.trim() || !monitoring.description?.trim()) throw new Error('Enter the monitoring task title and instructions.');
    const owner = people.find(person => person.name === (monitoring.mainOwner || context.actor) && canOwnCollaborative(person));
    const leader = people.find(person => person.name === monitoring.assignee && canMonitorCollaborative(person));
    if (!owner) throw new Error('Choose an EVP, Operations Manager, Corporate Services member, or Team Leader as the final approver.');
    if (!leader) throw new Error('Choose a Team Leader, Operations Manager, or Corporate Services member for monitoring.');
    const main = { ...draft, assignee: owner.name, assigneeRole: owner.role, department: owner.department, kind: 'Main / final deliverable', requestedBy: requester.name, template: 'collaborative', status: 'Not Started' };
    const child = createChildTask(main, [...tasks, main], config, { ...context, actor: owner.name, employee: owner.name }, { ...monitoring, taskType: 'monitoring', due: monitoring.due || childDeadline(draft.due), branch: draft.branch, dependsOn: [] });
    return [main, child];
}
export const canCompleteMainTask = (task, tasks, context) => isCollaborativeTask(task) && !task.parentId
    && canCreateCollaborative(context.role) && context.actor === task.assignee && !['Completed', 'Denied'].includes(task.status)
    && dependencyBlockers(task, tasks).length === 0;
// User-requested cleanup targets only the two incorrect root tasks and their descendants.
export function removeIncorrectCollaborations(tasks) {
    const names = new Set(['product masterlist', 'prepare the clinic product masterlist']);
    const roots = tasks.filter(task => !task.parentId && isCollaborativeTask(task) && names.has(task.title?.trim().toLowerCase()));
    const removed = new Set(roots.flatMap(task => [task.id, ...taskHierarchy(task, tasks).map(row => row.task.id)]));
    return removed.size ? tasks.filter(task => !removed.has(task.id)) : tasks;
}

// Adding a child turns a legacy execution assignment into a monitoring task atomically.
export function appendCollaborativeChild(tasks, parent, child) {
    return [...tasks.map(task => task.id === parent.id ? { ...task, template: 'collaborative', kind: task.parentId ? 'Monitoring / delegated task' : task.kind } : task), child];
}
