import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduledBranch, applyBranchAssignment } from '../resources/js/Pages/Tasks/workSchedule.mjs';
import { weekRange, ensureWeeklyTasks } from '../resources/js/Pages/Tasks/weeklyReports.mjs';
import { ensureDailyTasks } from '../resources/js/Pages/Tasks/dailyTasks.mjs';
import { defaultSettings } from '../resources/js/Pages/Tasks/taskSettings.mjs';

test('intern periods always end on Friday and submitted periods are preserved', () => {
    assert.deepEqual(weekRange('2026-10-23', 3), { start: '2026-10-17', end: '2026-10-23' });
    assert.deepEqual(weekRange('2026-10-25', 0), { start: '2026-10-24', end: '2026-10-30' });
    const config = defaultSettings(); config.employees[0].employeeType = 'Intern'; config.employees[0].weekStartDay = 3;
    const tasks = ensureWeeklyTasks([], config, '2026-10-23');
    assert.equal(tasks[0].weekStart, '2026-10-17');
    assert.equal(tasks[0].due, '2026-10-23');
    tasks[0].status = 'Pending Review'; config.employees[0].weekStartDay = 1;
    assert.equal(ensureWeeklyTasks(tasks, config, '2026-10-23'), tasks);
});
test('IT schedules apply to the scheduled day only and skip day-off assignments', () => {
    const config = defaultSettings();
    const employee = config.employees[0]; employee.branchSchedule = { '2026-10-23': 'Alabang', '2026-10-24': 'Off' };
    assert.equal(scheduledBranch(employee, '2026-10-23'), 'Alabang');
    assert.equal(scheduledBranch(employee, '2026-10-25'), 'Makati');
    const tasks = ensureDailyTasks([], config, '2026-10-23');
    assert.ok(tasks.filter(task => task.assignee === employee.name).every(task => task.branch === 'Alabang'));
    const next = ensureDailyTasks(tasks, config, '2026-10-24');
    assert.equal(next.filter(task => task.assignee === employee.name && task.due === '2026-10-24').length, 0);
    assert.ok(ensureDailyTasks(next, config, '2026-10-25').filter(task => task.assignee === employee.name && task.due === '2026-10-25').every(task => task.branch === 'Makati'));
});
test('open legacy weekly reports move to Friday without losing answers or duplicating assignments', () => {
    const config = defaultSettings(); config.employees[0].employeeType = 'Intern';
    const legacy = { id: 1, template: 'intern-weekly-report', assignee: config.employees[0].name, weekStart: '2026-10-19', weekEnd: '2026-10-25', due: '2026-10-25', status: 'In Progress', weeklyReport: { problems: 'Lorem ipsum.' } };
    const tasks = ensureWeeklyTasks([legacy], config, '2026-10-23');
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].due, '2026-10-23');
    assert.equal(tasks[0].weeklyReport.problems, 'Lorem ipsum.');
    assert.equal(ensureWeeklyTasks(tasks, config, '2026-10-23'), tasks);
    const next = ensureWeeklyTasks(tasks, config, '2026-10-24');
    assert.equal(next.length, 2);
    assert.equal(next[1].weekStart, '2026-10-24');
    assert.equal(next[1].due, '2026-10-30');
});
test('assignment changes update drafts and preserve submissions and other dates', () => {
    const employee = { name: 'John Doe' };
    const tasks = [
        { id: 1, assignee: employee.name, recurrence: 'daily', due: '2026-10-23', status: 'In Progress', branch: 'Makati', rounds: { branch: 'Makati', images: [{ id: 'photo' }] } },
        { id: 2, assignee: employee.name, recurrence: 'daily', due: '2026-10-23', status: 'Completed', branch: 'Makati' },
        { id: 3, assignee: employee.name, recurrence: 'daily', due: '2026-10-24', status: 'Not Started', branch: 'Makati' },
        { id: 4, assignee: employee.name, recurrence: 'daily', due: '2026-10-23', status: 'Not Started', branch: 'Makati' },
    ];
    const updated = applyBranchAssignment(tasks, employee, '2026-10-23', 'Greenhills');
    assert.equal(updated[0].rounds.branch, 'Greenhills');
    assert.equal(updated[0].rounds.images[0].id, 'photo');
    assert.equal(updated[1].branch, 'Makati');
    assert.equal(updated[2].branch, 'Makati');
    const off = applyBranchAssignment(tasks, employee, '2026-10-23', 'Off');
    assert.deepEqual(off.map(task => task.id), [1, 2, 3]);
});
