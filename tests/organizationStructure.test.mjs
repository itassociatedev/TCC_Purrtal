import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, loadSettings, changeSetting } from '../resources/js/Pages/Tasks/taskSettings.mjs';
import { assignmentDirectory } from '../resources/js/Pages/Tasks/assignmentDirectory.mjs';
import { employees, legacyDepartmentLeaders } from '../resources/js/Pages/Tasks/taskDirectory.mjs';

test('old department TLs migrate to chart positions without dropping identities', () => {
    const current = defaultSettings();
    const raw = { ...current, organizationStructureVersion: 0, teamLeaders: legacyDepartmentLeaders,
        employees: current.employees.filter(person => employees.some(item => item.name === person.name)),
        roleHolders: current.roleHolders.filter(person => !legacyDepartmentLeaders.some(item => item.name === person.name)) };
    const before = JSON.stringify(raw);
    const next = loadSettings(raw);
    assert.equal(JSON.stringify(raw), before);
    assert.equal(next.teamLeaders.length, 7);
    const people = assignmentDirectory(next);
    assert.equal(new Set(people.map(person => person.name)).size, people.length);
    for (const old of legacyDepartmentLeaders) assert.ok(people.some(person => person.name === old.name));
    for (const department of ['IT', 'Inventory', 'Accounting', 'Procurement']) assert.ok(next.employees.some(person => person.department === department && person.employeeType === 'Supervisor' && person.role === 'Employee'));
    for (const department of ['Reception', 'Security', 'Facilities', 'Customer Service', 'HR', 'Internal Audit', 'Operations & Finance', 'Sales & Marketing']) assert.ok(!next.teamLeaders.some(person => person.department === department));
    assert.equal(people.find(person => person.name === 'John Doe 66').position, 'HR Manager');
    assert.equal(people.find(person => person.name === 'John Doe 64').position, 'Internal Auditor');
    assert.equal(people.find(person => person.name === 'John Doe 65').employeeType, 'Supervisor');
    assert.deepEqual(loadSettings(next), next);
});
test('admin explicitly configures leadership and existing assignments survive leadership edits', () => {
    let { config } = changeSetting(defaultSettings(), [], { entity: 'departments', action: 'add', value: { name: 'Lorem' } });
    assert.ok(!config.teamLeaders.some(person => person.department === 'Lorem'));
    ({ config } = changeSetting(config, [], { entity: 'teamLeaders', action: 'add', value: { name: 'John Doe Lorem', department: 'Lorem', role: 'Team Leader', position: 'Lorem Team Leader' } }));
    const task = { id: 1, assignee: 'John Doe Lorem', coordinator: 'John Doe Lorem', coordinators: ['John Doe Lorem'] };
    const result = changeSetting(config, [task], { entity: 'teamLeaders', action: 'edit', original: 'John Doe Lorem', value: { name: 'John Doe Updated', department: 'Lorem', role: 'Team Leader', position: 'Lorem Team Leader' } });
    assert.equal(result.tasks[0].assignee, 'John Doe Updated');
    assert.deepEqual(result.tasks[0].coordinators, ['John Doe Updated']);
    assert.throws(() => changeSetting(result.config, result.tasks, { entity: 'teamLeaders', action: 'remove', original: 'John Doe Updated' }), /Reassign/);
});

test('previous separate corporate roles migrate into positions under a single Corporate Services category', () => {
    const config = defaultSettings();
    config.organizationStructureVersion = 1;
    config.roles.push({ name: 'HR Manager', baseRole: 'EVP', group: 'Corporate Services' });
    const hr = config.roleHolders.find(person => person.position === 'HR Manager');
    hr.role = 'HR Manager';
    config.teamLeaders.push({ name: 'John Doe Reception', department: 'Reception', role: 'Team Leader', position: 'Reception Team Leader' });
    const migrated = loadSettings(config);
    assert.ok(!migrated.roles.some(role => role.name === 'HR Manager'));
    assert.equal(migrated.roleHolders.find(person => person.name === hr.name).role, 'Corporate Services');
    assert.ok(!migrated.teamLeaders.some(person => person.department === 'Reception'));
    assert.ok(migrated.employees.some(person => person.name === 'John Doe Reception' && person.position === 'Receptionist'));
    assert.equal(assignmentDirectory(migrated).find(person => person.name === hr.name).baseRole, 'EVP');
});

test('a saved Supervisor role upgrades to an employee subtype while tasks keep the same assignee', () => {
    const config = defaultSettings();
    config.organizationStructureVersion = 2;
    config.roles.push({ name: 'Supervisor', baseRole: 'Team Leader' });
    const supervisor = config.employees.find(person => person.employeeType === 'Supervisor');
    config.employees = config.employees.filter(person => person.name !== supervisor.name);
    config.teamLeaders.push({ ...supervisor, role: 'Supervisor' });
    const next = loadSettings(config);
    assert.ok(!next.roles.some(role => role.name === 'Supervisor'));
    assert.ok(!next.teamLeaders.some(person => person.name === supervisor.name));
    const employee = next.employees.find(person => person.name === supervisor.name);
    assert.equal(employee.role, 'Employee');
    assert.equal(employee.employeeType, 'Supervisor');
    assert.equal(employee.position, supervisor.position);
    const edit = changeSetting(next, [], { entity: 'employees', action: 'edit', original: employee.name, value: employee });
    assert.equal(edit.config.employees.find(person => person.name === employee.name).employeeType, 'Supervisor');
});

test('the staff directory includes separate medical leaders, an IT TL and employee supervisors', () => {
    const config = defaultSettings();
    for (const position of ['Senior Veterinarian Assistant Team Leader', 'Junior Veterinarian Team Leader', 'Veterinary Technician Team Leader', 'Veterinary Technician Assistant Team Leader', 'Clinic Assistant Team Leader', 'Cashier Team Leader', 'IT Team Leader']) assert.ok(config.teamLeaders.some(person => person.position === position), position);
    assert.equal(config.teamLeaders.filter(person => person.department === 'Vet Tech').length, 2);
    assert.equal(config.teamLeaders.filter(person => person.department === 'Veterinary').length, 2);
    assert.ok(!config.teamLeaders.some(person => person.department === 'Reception'));
    for (const position of ['IT Supervisor', 'Inventory Supervisor', 'Finance Supervisor', 'Procurement Supervisor']) assert.ok(config.employees.some(person => person.position === position && person.employeeType === 'Supervisor'), position);
    assert.ok(config.employees.some(person => person.department === 'Inventory' && person.employeeType === 'Supervisor' && person.branch === 'Makati'));
    for (const position of ['HR Manager', 'Internal Auditor', 'Operations & Finance Coordination Lead', 'Sales & Marketing Manager']) assert.ok(config.roleHolders.some(person => person.role === 'Corporate Services' && person.position === position), position);
    const names = assignmentDirectory(config).map(person => person.name);
    assert.equal(new Set(names).size, names.length);
});

test('two people can hold different TL positions in one department and are edited by identity', () => {
    const config = defaultSettings();
    const medical = config.teamLeaders.filter(person => person.department === 'Veterinary');
    assert.equal(medical.length, 2);
    const junior = medical.find(person => person.position === 'Junior Veterinarian Team Leader');
    const result = changeSetting(config, [{ id: 1, assignee: junior.name }], { entity: 'teamLeaders', action: 'edit', original: junior.name, value: { ...junior, name: 'John Doe Junior' } });
    assert.ok(result.config.teamLeaders.some(person => person.name === 'John Doe Junior'));
    assert.ok(result.config.teamLeaders.some(person => person.name === medical.find(person => person.name !== junior.name).name));
    assert.equal(result.tasks[0].assignee, 'John Doe Junior');
    const legacy = structuredClone(config);
    legacy.organizationStructureVersion = 3;
    assert.equal(loadSettings(legacy).teamLeaders.filter(person => person.position === 'Junior Veterinarian Team Leader').length, 1);
});
