import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings } from '../resources/js/Pages/Tasks/taskSettings.mjs';
import { tasksForPreview } from '../resources/js/Pages/Tasks/taskDirectory.mjs';
import { createChildTask, dependencyBlockers, canReviewCollaborativeChild, taskHierarchy, createCollaborativeMain, removeIncorrectCollaborations, childDeadline, canCompleteMainTask, canCreateCollaborative, monitorMatchesAssignment, appendCollaborativeChild, canDelegate } from '../resources/js/Pages/Tasks/collaborativeTasks.mjs';
import { notificationForTask } from '../resources/js/Pages/Tasks/taskNotifications.mjs';
import { assignmentDirectory } from '../resources/js/Pages/Tasks/assignmentDirectory.mjs';

const config = defaultSettings();
const parent = { id: 1, title: 'Prepare product masterlist', template: 'collaborative', assignee: 'John Doe', department: 'IT', branch: 'Makati', due: '2026-10-30', status: 'Not Started', priority: 'High' };
const coordinator = { role: 'Employee', employee: parent.assignee };
const value = { title: 'Export source data', description: 'Lorem ipsum.', assignee: 'John Doe 2', branch: 'Alabang', due: '2026-10-28', dependsOn: [] };
test('EVP, Corporate Services, OM and TL can create collaborations, while employees cannot', () => {
    for (const role of config.roles) assert.equal(canCreateCollaborative(role.baseRole), ['EVP', 'Operations Manager', 'Team Leader'].includes(role.baseRole));
    const directory = assignmentDirectory(config);
    const owner = directory.find(person => person.role === 'EVP');
    const leader = directory.find(person => person.baseRole === 'Team Leader');
    for (const creator of directory.filter(person => ['Team Leader', 'Operations Manager', 'EVP'].includes(person.baseRole))) {
        const result = createCollaborativeMain(parent, [], config, { role: creator.baseRole, actor: creator.name }, { mainOwner: owner.name, assignee: leader.name, title: 'Monitor progress', description: 'Track completion.' });
        assert.equal(result.length, 2);
        assert.equal(result[0].requestedBy, creator.name);
    }
    assert.equal(canCreateCollaborative('Employee'), false);
});
test('coordinator delegates cross-department children and all approvals gate the parent', () => {
    assert.equal(dependencyBlockers(parent, [parent]).length, 1);
    const first = createChildTask(parent, [parent], config, coordinator, value);
    assert.equal(first.department, 'Inventory');
    assert.equal(first.parentId, parent.id);
    assert.equal(first.coordinator, parent.assignee);
    const second = createChildTask(parent, [parent, first], config, coordinator, { ...value, title: 'Compare data', assignee: 'John Doe 4', due: '2026-10-28', dependsOn: [first.id] });
    assert.equal(dependencyBlockers(second, [parent, first, second]).length, 1);
    assert.equal(dependencyBlockers(parent, [parent, first, second]).length, 2);
    const approvedFirst = { ...first, status: 'Completed' };
    assert.equal(dependencyBlockers(second, [parent, approvedFirst, second]).length, 0);
    assert.equal(dependencyBlockers(parent, [parent, approvedFirst, { ...second, status: 'Completed' }]).length, 0);
    assert.equal(dependencyBlockers(parent, [parent, approvedFirst, { ...second, status: 'Denied' }]).length, 1);
});
test('delegation rejects unauthorized actors, invalid dependencies and deadlines', () => {
    assert.throws(() => createChildTask(parent, [parent], config, { role: 'Employee', employee: 'John Doe 2' }, value), /coordinator/);
    assert.throws(() => createChildTask({ ...parent, status: 'Pending Review' }, [parent], config, coordinator, value), /coordinator/);
    assert.throws(() => createChildTask(parent, [parent], config, coordinator, { ...value, assignee: parent.assignee }), /another employee/);
    assert.throws(() => createChildTask(parent, [parent], config, coordinator, { ...value, due: '2026-11-01' }), /deadline/);
    assert.throws(() => createChildTask(parent, [parent], config, coordinator, { ...value, dependsOn: [parent.id] }), /prerequisites/);
});
test('coordinator and originating managers see cross-department tasks and receive notifications', () => {
    const child = createChildTask(parent, [parent], config, coordinator, value);
    assert.equal(canReviewCollaborativeChild(child, [parent, child], coordinator), true);
    assert.equal(canReviewCollaborativeChild(child, [parent, child], { role: 'Employee', employee: child.assignee }), false);
    assert.equal(tasksForPreview([parent, child], coordinator).length, 2);
    assert.equal(tasksForPreview([parent, child], { role: 'Team Leader', department: 'IT' }).length, 2);
    assert.equal(tasksForPreview([parent, child], { role: 'Employee', employee: child.assignee }).length, 1);
    const event = notificationForTask(child, 'New task', 'Lorem');
    assert.equal(tasksForPreview([event], coordinator).length, 1);
    assert.equal(tasksForPreview([event], { role: 'Operations Manager', branch: 'Makati' }).length, 1);
});
test('monitoring tasks delegate another level and the final task waits for every descendant', () => {
    const monitoring = createChildTask(parent, [parent], config, coordinator, { ...value, taskType: 'monitoring', title: 'Monitor product reconciliation', assignee: 'John Doe', due: '2026-10-29' });
    assert.equal(monitoring.template, 'collaborative');
    const inventory = createChildTask(monitoring, [parent, monitoring], config, coordinator, { ...value, title: 'Compare product records' });
    const accounting = createChildTask(monitoring, [parent, monitoring, inventory], config, coordinator, { ...value, title: 'Verify prices', assignee: 'John Doe 4', due: '2026-10-28', dependsOn: [inventory.id] });
    const tree = [parent, monitoring, inventory, accounting];
    assert.deepEqual(taskHierarchy(parent, tree).map(row => row.depth), [0, 1, 1]);
    assert.equal(dependencyBlockers(parent, tree).length, 3);
    assert.equal(dependencyBlockers(accounting, tree).length, 1);
    const completedLeaves = tree.map(task => [inventory.id, accounting.id].includes(task.id) ? { ...task, status: 'Completed' } : task);
    assert.equal(dependencyBlockers(monitoring, completedLeaves).length, 0);
    assert.equal(dependencyBlockers(parent, completedLeaves).length, 1);
    assert.equal(dependencyBlockers(parent, completedLeaves.map(task => task.id === monitoring.id ? { ...task, status: 'Completed' } : task)).length, 0);
    assert.equal(tasksForPreview([notificationForTask(inventory, 'Submitted', 'Lorem')], coordinator).length, 1);
});
test('EVP owns the final deliverable while TL receives a separately titled monitoring task and multiple children', () => {
    const directory = assignmentDirectory(config);
    const evp = directory.find(person => person.role === 'EVP');
    const tl = directory.find(person => person.employeeType === 'Supervisor' && person.department === 'Inventory');
    const draft = { ...parent, title: 'Product Masterlist', description: 'Finalize the product masterlist and make sure everything is correct.', assignee: tl.name };
    const [main, monitor] = createCollaborativeMain(draft, [], config, { role: 'EVP', actor: evp.name }, { assignee: tl.name, title: 'Monitor Inventory Progress', description: 'Monitor Inventory progress and track whether each task is completed.' });
    assert.equal(main.assignee, evp.name);
    assert.equal(monitor.assignee, tl.name);
    assert.equal(monitor.title, 'Monitor Inventory Progress');
    assert.equal(monitor.parentId, main.id);
    const ctx = { role: 'Employee', employee: tl.name, actor: tl.name, employeeType: 'Supervisor', department: 'Inventory' };
    const inventory = createChildTask(monitor, [main, monitor], config, ctx, { ...value, title: 'Compare old and new product lists', description: 'Compare both product lists and check formatting.' });
    const accountant = directory.find(person => person.department === 'Accounting' && person.baseRole === 'Employee');
    const accounting = createChildTask(monitor, [main, monitor, inventory], config, ctx, { ...value, assignee: accountant.name, title: 'Export products and find prices', description: 'Export the product list and find the product prices.' });
    assert.notEqual(inventory.id, accounting.id);
    const all = [main, monitor, inventory, accounting];
    assert.equal(taskHierarchy(main, all).length, 3);
    assert.equal(taskHierarchy(monitor, all).length, 2);
    assert.equal(tasksForPreview(all, ctx).length, 3);
    assert.equal(dependencyBlockers(main, all).length, 3);
});
test('requested cleanup removes only the two incorrect roots and their linked descendants', () => {
    const wrong = { ...parent, title: 'Product masterlist' };
    const another = { ...parent, id: 2, title: 'Prepare the clinic product masterlist' };
    const retained = { ...parent, id: 3, title: 'Other collaboration' };
    const standalone = { ...parent, id: 4, title: 'Product masterlist', template: 'standard' };
    const cleaned = removeIncorrectCollaborations([wrong, another, retained, standalone, { id: 5, parentId: wrong.id, title: 'Wrong child' }]);
    assert.deepEqual(cleaned.map(task => task.id), [3, 4]);
    assert.equal(removeIncorrectCollaborations(cleaned), cleaned);
});
test('four levels enforce Oct 30, 29, 28, 27 and reject equal or later child dates', () => {
    const second = createChildTask(parent, [parent], config, coordinator, { ...value, taskType: 'monitoring', due: childDeadline(parent.due) });
    const secondActor = { role: 'Employee', employee: second.assignee };
    const third = createChildTask(second, [parent, second], config, secondActor, { ...value, assignee: 'John Doe 4', taskType: 'monitoring', due: childDeadline(second.due) });
    const fourth = createChildTask(third, [parent, second, third], config, { role: 'Employee', employee: third.assignee }, { ...value, due: childDeadline(third.due) });
    assert.deepEqual([parent.due, second.due, third.due, fourth.due], ['2026-10-30', '2026-10-29', '2026-10-28', '2026-10-27']);
    assert.throws(() => createChildTask(parent, [parent], config, coordinator, { ...value, due: parent.due }), /earlier/);
    assert.throws(() => createChildTask(third, [parent, second, third], config, { role: 'Employee', employee: third.assignee }, { ...value, due: '2026-10-30' }), /earlier/);
});
test('explicit EVP ownership is separate from the creator and only that owner closes a ready main task', () => {
    const directory = assignmentDirectory(config);
    const evp = directory.find(person => person.role === 'EVP');
    const om = directory.find(person => person.baseRole === 'Operations Manager');
    const tl = directory.find(person => person.baseRole === 'Team Leader');
    const [main, monitoring] = createCollaborativeMain(parent, [], config, { role: 'Operations Manager', actor: om.name }, { mainOwner: evp.name, assignee: tl.name, title: 'Monitor inventory', description: 'Track completion.' });
    assert.equal(main.assignee, evp.name);
    assert.equal(main.requestedBy, om.name);
    assert.equal(monitoring.assignee, tl.name);
    const owner = { role: 'EVP', actor: evp.name };
    assert.equal(canCompleteMainTask(main, [main, monitoring], owner), false);
    const done = { ...monitoring, status: 'Completed' };
    assert.equal(canCompleteMainTask(main, [main, done], owner), true);
    assert.equal(canCompleteMainTask(main, [main, done], { role: 'Team Leader', actor: tl.name }), false);
    assert.equal(canCompleteMainTask(main, [main, done], { role: 'EVP', actor: 'Someone else' }), false);
    assert.throws(() => createCollaborativeMain(parent, [], config, owner, { mainOwner: evp.name, assignee: config.employees[0].name, title: 'Monitor', description: 'Track.' }), /Team Leader/);
});

test('TL, OM and Corporate can own monitoring and delegate children', () => {
    const people = assignmentDirectory(config);
    const owner = people.find(person => person.role === 'EVP');
    for (const role of ['Team Leader', 'Operations Manager', 'Corporate Services']) {
        const monitor = people.find(person => person.role === role);
        assert.ok(monitor);
        const [main, next] = createCollaborativeMain(parent, [], config, { role: 'EVP', actor: owner.name }, { mainOwner: owner.name, assignee: monitor.name, title: 'Monitor progress', description: 'Coordinate departments.' });
        assert.equal(next.assignee, monitor.name);
        assert.equal(next.assigneeRole, role);
        const child = createChildTask(next, [main, next], config, { role: monitor.baseRole, actor: monitor.name }, { ...value, due: '2026-10-28' });
        assert.equal(child.coordinator, monitor.name);
    }
});

test('Veterinary monitoring choices include OM and Corporate across departments', () => {
    const people = assignmentDirectory(config);
    const assignment = { department: 'Veterinary', branch: 'Makati' };
    const options = people.filter(person => monitorMatchesAssignment(person, assignment));
    for (const role of ['Team Leader', 'Operations Manager', 'Corporate Services']) assert.ok(options.some(person => person.role === role), role);
    assert.ok(options.filter(person => person.baseRole === 'Team Leader').every(person => person.department === 'Veterinary'));
    assert.equal(monitorMatchesAssignment({ baseRole: 'Operations Manager', availableBranches: ['Alabang'] }, assignment), false);
});

test('an existing Inventory supervisor execution child can delegate multiple employee tasks', () => {
    const people = assignmentDirectory(config);
    const tl = people.find(person => person.employeeType === 'Supervisor' && person.department === 'Inventory');
    const employee = people.find(person => person.baseRole === 'Employee' && person.department === 'Inventory');
    const legacy = { ...parent, id: 2, parentId: 1, template: 'standard', assignee: tl.name, assigneeRole: tl.role, due: '2026-10-28' };
    const context = { role: tl.baseRole, actor: tl.name, employee: tl.name, employeeType: tl.employeeType };
    assert.equal(canDelegate(legacy, context), true);
    assert.equal(canDelegate(legacy, { role: 'EVP', actor: 'Other owner' }), false);
    const draft = { ...value, assignee: employee.name, branch: employee.branch, due: '2026-10-27', taskType: 'auto' };
    const first = createChildTask(legacy, [parent, legacy], config, context, draft);
    const updated = appendCollaborativeChild([parent, legacy], legacy, first);
    assert.equal(updated[1].template, 'collaborative');
    assert.equal(first.template, 'standard');
    assert.equal(dependencyBlockers(updated[1], updated).length, 1);
    const second = createChildTask(updated[1], updated, config, context, draft);
    assert.notEqual(first.id, second.id);
    const autoLeader = createChildTask(parent, [parent], config, coordinator, { ...draft, assignee: tl.name, branch: tl.branch, taskType: 'auto' });
    assert.equal(autoLeader.template, 'collaborative');
});
