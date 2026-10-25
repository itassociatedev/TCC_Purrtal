import { departmentLeadership, additionalTeamLeaderPositions } from '../resources/js/Pages/Tasks/organizationStructure.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { branches, departments, operationsManagers, teamLeaders, employees, managerForBranch, leaderForDepartment, tasksForPreview, employeesForPreview } from '../resources/js/Pages/Tasks/taskDirectory.mjs';

test('there is one OM per branch and leadership only for chart-defined departments', () => {
    assert.equal(operationsManagers.length, 3);
    assert.equal(teamLeaders.length, 7);
    assert.equal(teamLeaders.filter(person => person.role === 'Team Leader').length, 7);
    assert.equal(teamLeaders.filter(person => person.role === 'Supervisor').length, 0);
    for (const branch of branches) assert.equal(operationsManagers.filter(manager => manager.branch === branch).length, 1);
    for (const department of departments) assert.equal(teamLeaders.filter(leader => leader.department === department).length, (departmentLeadership[department]?.role === 'Team Leader' ? 1 : 0) + additionalTeamLeaderPositions.filter(person => person.department === department).length);
    const names = [...employees, ...operationsManagers, ...teamLeaders].map(person => person.name);
    assert.equal(new Set(names).size, names.length);
});
test('employees share the department TL but have the OM for their own branch', () => {
    const it = employees.filter(employee => employee.department === 'IT');
    assert.equal(new Set(it.map(employee => leaderForDepartment(employee.department).name)).size, 1);
    assert.equal(new Set(it.map(employee => managerForBranch(employee.branch).name)).size, 3);
});
const tasks = [
    { id: 1, assignee: 'John Doe', department: 'IT', branch: 'Makati' },
    { id: 2, assignee: 'John Doe 2', department: 'Inventory', branch: 'Alabang' },
    { id: 3, assignee: 'John Doe 41', department: 'IT', branch: 'Alabang' },
    { id: 4, assignee: 'John Doe 4', department: 'Reception', branch: 'Makati' },
];
test('OM dashboards span departments inside one branch only', () => {
    assert.deepEqual(tasksForPreview(tasks, { role: 'Operations Manager', branch: 'Makati' }).map(task => task.id), [1, 4]);
    assert.ok(employeesForPreview({ role: 'Operations Manager', branch: 'Makati' }).every(employee => employee.branch === 'Makati'));
});
test('one department TL covers that department across branches', () => {
    assert.deepEqual(tasksForPreview(tasks, { role: 'Team Leader', department: 'IT' }).map(task => task.id), [1, 3]);
    const team = employeesForPreview({ role: 'Team Leader', department: 'IT' });
    assert.equal(new Set(team.map(employee => employee.branch)).size, 3);
    assert.ok(team.every(employee => employee.department === 'IT'));
});
test('employees retain a personal task view and EVP retains the organization view', () => {
    assert.deepEqual(tasksForPreview(tasks, { role: 'Employee', employee: 'John Doe' }).map(task => task.id), [1]);
    assert.equal(tasksForPreview(tasks, { role: 'EVP' }).length, tasks.length);
});
