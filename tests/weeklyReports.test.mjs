import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, loadSettings, changeSetting } from '../resources/js/Pages/Tasks/taskSettings.mjs';
import { weekRange, ensureWeeklyTasks, accomplishedThisWeek, canEditWeeklyReport, formatWeeklyReport, weeklySummary } from '../resources/js/Pages/Tasks/weeklyReports.mjs';
import { tasksForPreview } from '../resources/js/Pages/Tasks/taskDirectory.mjs';

test('automatic weekly summary includes completed task titles and branch details', () => {
    const task = { weekStart: '2026-10-19', weekEnd: '2026-10-25' };
    const summary = weeklySummary(task, [{ title: 'Review inventory', branch: 'Makati' }, { title: 'Check printers', branch: 'Alabang' }]);
    assert.match(summary, /completed 2 tasks/);
    assert.match(summary, /Review inventory \(Makati\)/);
    assert.match(summary, /Check printers \(Alabang\)/);
    assert.match(weeklySummary(task, []), /No completed tasks recorded yet/);
});
test('department team leaders see intern weekly reports across branches and exclude other departments', () => {
    const reports = [
        { id: 1, template: 'intern-weekly-report', department: 'IT', branch: 'Makati', status: 'Pending Review', due: '2026-10-25', title: 'Intern Weekly Report', assignee: 'John Doe', description: '', priority: 'Medium' },
        { id: 2, template: 'intern-weekly-report', department: 'IT', branch: 'Alabang', status: 'Completed', due: '2026-10-25', title: 'Intern Weekly Report', assignee: 'John Doe 2', description: '', priority: 'Medium' },
        { id: 3, template: 'intern-weekly-report', department: 'HR', branch: 'Makati', status: 'Pending Review', due: '2026-10-25', title: 'Intern Weekly Report', assignee: 'John Doe 3', description: '', priority: 'Medium' },
    ];
    const scoped = tasksForPreview(reports, { role: 'Team Leader', department: 'IT' });
    assert.deepEqual(filterTasks(scoped, { view: 'Weekly Reports', today: '2026-10-23' }).map(task => task.id), [1, 2]);
    assert.deepEqual(filterTasks(scoped, { view: 'Review Queue', today: '2026-10-23' }).map(task => task.id), [1]);
});
import { filterTasks } from '../resources/js/Pages/Tasks/taskFilters.mjs';

test('interns are employee subtypes and legacy assignments migrate without changing identities', () => {
    const config = defaultSettings();
    assert.ok(!config.roles.some(role => role.name === 'Intern'));
    const legacy = structuredClone(config);
    legacy.roles.push({ name: 'Intern', baseRole: 'Employee', weeklyReport: true });
    legacy.employees[0].role = 'Intern';
    const migrated = loadSettings(legacy);
    assert.ok(!migrated.roles.some(role => role.name === 'Intern'));
    assert.equal(migrated.employees[0].role, 'Employee');
    assert.equal(migrated.employees[0].employeeType, 'Intern');
    assert.equal(migrated.employees[0].name, legacy.employees[0].name);
    const employee = config.employees[0];
    const result = changeSetting(config, [], { entity: 'employees', action: 'edit', original: employee.name, value: { ...employee, employeeType: 'Intern' } });
    assert.equal(result.config.employees[0].role, 'Employee');
    assert.equal(result.config.employees[0].employeeType, 'Intern');
});

test('weekly reports are created once per intern per Saturday–Friday week and retain older reports', () => {
    const config = defaultSettings(); config.employees[0].employeeType = 'Intern';
    assert.deepEqual(weekRange('2026-10-25'), { start: '2026-10-24', end: '2026-10-30' });
    const first = ensureWeeklyTasks([], config, '2026-10-23');
    assert.equal(first.length, 1);
    assert.equal(ensureWeeklyTasks(first, config, '2026-10-23'), first);
    first[0].status = 'Completed';
    const next = ensureWeeklyTasks(first, config, '2026-10-26');
    assert.equal(next.length, 2);
    assert.equal(next[0].status, 'Completed');
    assert.equal(next[1].weekStart, '2026-10-24');
    assert.equal(filterTasks(next, { view: 'Weekly Reports', today: '2026-10-26' }).length, 2);
});
test('accomplishments use completion time in Manila, not deadlines or other employees’ tasks', () => {
    const tasks = [
        { id: 1, title: 'Update inventory', assignee: 'John Doe', branch: 'Makati', status: 'Completed', completedAt: '2026-10-18T16:00:00Z' },
        { id: 2, assignee: 'John Doe', status: 'Completed', completedAt: '2026-10-25T16:00:00Z' },
        { id: 3, assignee: 'John Doe 2', status: 'Completed', completedAt: '2026-10-23T00:00:00Z' },
        { id: 4, assignee: 'John Doe', status: 'Completed', due: '2026-10-23' },
        { id: 5, assignee: 'John Doe', status: 'Pending Review', completedAt: '2026-10-23T00:00:00Z' },
    ];
    assert.deepEqual(accomplishedThisWeek(tasks, 'John Doe', '2026-10-19', '2026-10-25').map(task => task.id), [1]);
    assert.match(formatWeeklyReport({ assignee: 'John Doe', department: 'IT', weekStart: '2026-10-19', weekEnd: '2026-10-25' }, { accomplishments: [tasks[0]], summary: weeklySummary({ weekStart: '2026-10-19', weekEnd: '2026-10-25' }, [tasks[0]]) }), /Update inventory/);
});
test('only assigned interns can author editable weekly reports', () => {
    const config = defaultSettings(); const employee = { ...config.employees[0], employeeType: 'Intern' };
    const task = { assignee: employee.name, status: 'In Progress' };
    assert.equal(canEditWeeklyReport(task, employee, config, 'Employee'), true);
    assert.equal(canEditWeeklyReport(task, employee, config, 'EVP'), false);
    assert.equal(canEditWeeklyReport(task, { ...employee, employeeType: 'Regular' }, config, 'Employee'), false);
    assert.equal(canEditWeeklyReport({ ...task, status: 'Completed' }, employee, config, 'Employee'), false);
});
