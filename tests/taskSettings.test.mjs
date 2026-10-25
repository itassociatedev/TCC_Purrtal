import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, loadSettings, changeSetting, canWorkAt, eligibleEmployees } from '../resources/js/Pages/Tasks/taskSettings.mjs';
import { enrichTask } from '../resources/js/Pages/Tasks/taskDirectory.mjs';
import { emptyRounds, validateRounds, formatRounds } from '../resources/js/Pages/Tasks/openingRounds.mjs';
import { filterTasks } from '../resources/js/Pages/Tasks/taskFilters.mjs';

test('Corporate Services gets EVP access and upgrades saved settings once', () => {
    const config = defaultSettings();
    const corporate = config.roles.find(role => role.name === 'Corporate Services');
    assert.equal(corporate.baseRole, 'EVP');
    assert.deepEqual(corporate.departments, ['Operations & Finance', 'Internal Audit', 'HR', 'Sales & Marketing']);
    assert.equal(eligibleEmployees(config, { role: corporate.baseRole }).length, config.employees.length);
    const legacy = structuredClone(config);
    delete legacy.corporateServicesVersion;
    legacy.roles = legacy.roles.filter(role => role.name !== corporate.name);
    const upgraded = loadSettings(legacy);
    assert.equal(upgraded.roles.filter(role => role.name === corporate.name).length, 1);
    assert.deepEqual(loadSettings(upgraded), upgraded);
});

test('portable employees can work in another branch without losing their home branch', () => {
    const config = defaultSettings();
    const person = config.employees.find(employee => employee.name === 'John Doe');
    assert.equal(person.branch, 'Makati');
    assert.equal(canWorkAt(person, 'Alabang'), true);
    assert.ok(eligibleEmployees(config, { role: 'Operations Manager', branch: 'Alabang' }).some(employee => employee.name === person.name));
    assert.equal(enrichTask({ assignee: person.name, branch: 'Alabang' }).branch, 'Alabang');
    assert.equal(person.branch, 'Makati');
});
test('new departments have no automatic TL while branches get an OM', () => {
    let result = changeSetting(defaultSettings(), [], { entity: 'departments', action: 'add', value: { name: 'Lorem Department' } });
    assert.equal(result.config.teamLeaders.filter(leader => leader.department === 'Lorem Department').length, 0);
    result = changeSetting(result.config, [], { entity: 'departments', action: 'remove', original: 'Lorem Department' });
    assert.ok(!result.config.teamLeaders.some(leader => leader.department === 'Lorem Department'));
    result = changeSetting(result.config, [], { entity: 'branches', action: 'add', value: { name: 'Lorem Branch' } });
    assert.equal(result.config.operationsManagers.filter(manager => manager.branch === 'Lorem Branch').length, 1);
    result = changeSetting(result.config, [], { entity: 'branches', action: 'remove', original: 'Lorem Branch' });
    assert.ok(!result.config.branches.includes('Lorem Branch'));
});
test('renames cascade to directory, leadership, and tasks without rewriting submitted reports', () => {
    const config = defaultSettings();
    const tasks = [{ id: 1, department: 'IT', branch: 'Makati', status: 'Pending Review', rounds: { branch: 'Makati', department: 'IT' } }, { id: 2, department: 'IT', branch: 'Makati', status: 'In Progress', rounds: { branch: 'Makati', department: 'IT' } }];
    const result = changeSetting(config, tasks, { entity: 'branches', action: 'edit', original: 'Makati', value: { name: 'Makati Clinic' } });
    assert.equal(result.tasks[0].branch, 'Makati Clinic');
    assert.equal(result.tasks[0].rounds.branch, 'Makati');
    assert.equal(result.tasks[1].rounds.branch, 'Makati Clinic');
    assert.ok(result.config.operationsManagers.some(manager => manager.branch === 'Makati Clinic'));
    assert.equal(config.branches.includes('Makati'), true);
});
test('in-use deletion and duplicate edits fail without partial mutations', () => {
    const config = defaultSettings();
    assert.throws(() => changeSetting(config, [], { entity: 'branches', action: 'remove', original: 'Alabang' }), /Reassign|assignments/);
    assert.throws(() => changeSetting(config, [], { entity: 'departments', action: 'add', value: { name: '  it ' } }), /already in use/);
    assert.equal(config.branches.length, 3);
    assert.equal(config.departments.length, 16);
});
test('custom roles can follow a supported workflow and rename employee references', () => {
    let result = changeSetting(defaultSettings(), [], { entity: 'roles', action: 'add', value: { name: 'Lorem Coordinator', baseRole: 'Team Leader' } });
    assert.equal(result.config.roles.at(-1).baseRole, 'Team Leader');
    result = changeSetting(result.config, [], { entity: 'roles', action: 'edit', original: 'Employee', value: { name: 'Staff', baseRole: 'Employee' } });
    assert.ok(result.config.employees.every(employee => employee.role === 'Staff'));
});
test('employee allowed branches cannot drop a branch where that employee still has work', () => {
    const config = defaultSettings();
    const person = config.employees[0];
    assert.throws(() => changeSetting(config, [{ assignee: person.name, branch: 'Alabang' }], { entity: 'employees', action: 'edit', original: person.name, value: { ...person, availableBranches: ['Makati'] } }), /still has tasks/);
});
test('leadership roles cannot create extra OMs or TLs through employee records', () => {
    const config = defaultSettings();
    const person = config.employees[0];
    assert.throws(() => changeSetting(config, [], { entity: 'employees', action: 'edit', original: person.name, value: { ...person, role: 'Operations Manager' } }), /leadership tabs/);
    assert.throws(() => changeSetting(config, [], { entity: 'roles', action: 'edit', original: 'Employee', value: { name: 'Staff', baseRole: 'Operations Manager' } }), /Employee workflow/);
});
test('custom priority ordering is respected by task lists', () => {
    const result = changeSetting(defaultSettings(), [], { entity: 'priorities', action: 'add', value: { name: 'Urgent', rank: 1 } });
    assert.equal(result.config.priorities[0], 'Urgent');
    const tasks = [{ id: 1, title: 'Review inventory', assignee: 'John Doe', description: 'Lorem', due: '2026-10-23', priority: 'High', status: 'Not Started' }, { id: 2, title: 'Check connection', assignee: 'John Doe', description: 'Lorem', due: '2026-10-23', priority: 'Urgent', status: 'Not Started' }];
    assert.equal(filterTasks(tasks, { view: 'Team Tasks', today: '2026-10-23', priorities: result.config.priorities, sort: 'priority' })[0].id, 2);
});
test('custom checklist systems validate and format while old snapshots retain their items', () => {
    const config = defaultSettings();
    const old = emptyRounds('2026-10-23', 'Makati');
    const edited = changeSetting(config, [], { entity: 'checks', action: 'add', value: { label: 'Network switch' } }).config;
    const rounds = { ...emptyRounds('2026-10-23', 'Alabang', edited.checks), headcount: 2, leave: 0, off: 1 };
    rounds.systems = Object.fromEntries(rounds.checks.map(([key]) => [key, 'good']));
    assert.equal(validateRounds(rounds, { branches: edited.branches }), '');
    assert.ok(formatRounds(rounds).includes('Network switch: ✅'));
    assert.equal(old.checks.length, 6);
    assert.equal(rounds.checks.length, 7);
});
