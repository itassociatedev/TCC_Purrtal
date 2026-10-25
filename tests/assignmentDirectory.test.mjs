import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, loadSettings, changeSetting } from '../resources/js/Pages/Tasks/taskSettings.mjs';
import { assignmentDirectory, eligibleAssignees, taskEditAssignees } from '../resources/js/Pages/Tasks/assignmentDirectory.mjs';
import { canSubmitAssignedTask } from '../resources/js/Pages/Tasks/taskPolicy.mjs';
import { canDelegate, createChildTask } from '../resources/js/Pages/Tasks/collaborativeTasks.mjs';
import { tasksForPreview } from '../resources/js/Pages/Tasks/taskDirectory.mjs';

test('EVP, Corporate Services and OM can assign individuals across every default role and branch', () => {
    const config = defaultSettings(); const all = assignmentDirectory(config);
    for (const role of config.roles) assert.ok(all.some(person => person.role === role.name), role.name);
    assert.equal(new Set(all.map(person => person.name)).size, all.length);
    assert.equal(eligibleAssignees(config, { role: 'EVP' }).length, all.length);
    assert.equal(eligibleAssignees(config, { role: 'Operations Manager', branch: 'Makati' }).length, all.length);
    assert.ok(eligibleAssignees(config, { role: 'Team Leader', department: 'IT' }).some(person => person.department !== 'IT' && person.baseRole === 'Employee'));
    const legacy = structuredClone(config); delete legacy.roleHolders;
    assert.ok(loadSettings(legacy).roleHolders.some(person => person.role === 'Corporate Services'));
});
test('management assignees can submit and coordinate their own work but cannot submit employee work', () => {
    const config = defaultSettings();
    const actor = assignmentDirectory(config).find(person => person.baseRole === 'Team Leader' && person.department === 'Vet Tech');
    const task = { id: 1, template: 'collaborative', assignee: actor.name, department: actor.department, branch: 'Makati', status: 'Not Started', due: '2026-10-30' };
    const context = { role: 'Team Leader', actor: actor.name, department: actor.department };
    assert.equal(canSubmitAssignedTask(task, { role: 'Team Leader', actor }), true);
    assert.equal(canSubmitAssignedTask({ ...task, assignee: 'John Doe' }, { role: 'Team Leader', actor }), false);
    assert.equal(canDelegate(task, context), true);
    const manager = assignmentDirectory(config).find(person => person.baseRole === 'Operations Manager');
    const child = createChildTask(task, [task], config, context, { title: 'Review data', description: 'Lorem ipsum.', assignee: manager.name, branch: manager.branch, due: '2026-10-29' });
    assert.equal(child.assignee, manager.name);
    assert.equal(tasksForPreview([task, child], context).length, 2);
    assert.equal(tasksForPreview([{ ...task, assignee: manager.name, branch: 'Makati' }], { role: 'Operations Manager', branch: 'Alabang', actor: manager.name }).length, 1);
});
test('role members are editable and duplicate identities cannot be added', () => {
    const config = defaultSettings(); const member = config.roleHolders[0];
    const result = changeSetting(config, [], { entity: 'roleHolders', action: 'edit', original: member.name, value: { ...member, name: 'John Doe Role Member' } });
    assert.equal(result.config.roleHolders[0].name, 'John Doe Role Member');
    assert.throws(() => changeSetting(config, [], { entity: 'roleHolders', action: 'add', value: { ...member, name: config.employees[0].name } }), /already/);
    const added = changeSetting(config, [], { entity: 'departments', action: 'add', value: { name: 'Lorem Department' } });
    const all = assignmentDirectory(added.config);
    assert.equal(new Set(all.map(person => person.name)).size, all.length);
});

test('edit choices preserve a TL owner and existing branch without broadening new-task permissions', () => {
    const config = defaultSettings();
    const directory = assignmentDirectory(config);
    const leader = directory.find(person => person.baseRole === 'Team Leader' && person.department === 'Vet Tech');
    const scope = { role: 'Team Leader', department: 'IT' };
    const task = { assignee: leader.name, assigneeRole: leader.role, department: leader.department, branch: 'Makati' };
    const choices = taskEditAssignees(config, scope, task);
    const owner = choices.find(person => person.name === leader.name);
    assert.equal(owner.department, task.department);
    assert.ok(owner.availableBranches.includes(task.branch));
    assert.equal(choices.filter(person => person.name === leader.name).length, 1);
    assert.ok(choices.every(person => person.name === leader.name || person.baseRole === 'Employee'));
    assert.equal(eligibleAssignees(config, scope).some(person => person.name === leader.name), false);
    const removed = taskEditAssignees(config, scope, { ...task, assignee: 'John Doe Former Member' });
    assert.equal(removed.find(person => person.name === 'John Doe Former Member').branch, 'Makati');
});

test('a Team Leader can assign their own task when their department has no employee records', () => {
    const config=defaultSettings();
    const leader=config.teamLeaders[0];
    config.employees=config.employees.filter(person=>person.department!==leader.department);
    const choices=eligibleAssignees(config,{role:'Team Leader',department:leader.department,actor:leader.name});
    assert.ok(choices.some(person=>person.name===leader.name));
    assert.ok(choices.find(person=>person.name===leader.name).availableBranches.includes(leader.branch));
});

test('Team Leaders may assign employees across departments while excluding other leaders', () => {
    const config=defaultSettings();
    const leader=config.teamLeaders.find(person=>person.department==='Vet Tech');
    const choices=eligibleAssignees(config,{role:'Team Leader',department:leader.department,actor:leader.name});
    assert.ok(choices.some(person=>person.name===leader.name));
    assert.ok(choices.some(person=>person.baseRole==='Employee'));
    assert.ok(choices.every(person=>person.baseRole==='Employee'||person.name===leader.name));
});
