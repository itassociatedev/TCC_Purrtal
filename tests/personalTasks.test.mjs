import test from 'node:test';
import assert from 'node:assert/strict';
import { taskListScope, dashboardTaskCounts } from '../resources/js/Pages/Tasks/personalTasks.mjs';
import { dailyReportTypes } from '../resources/js/Pages/Tasks/taskPolicy.mjs';
import { defaultSettings } from '../resources/js/Pages/Tasks/taskSettings.mjs';

test('team leader personal tasks are separate from employee tasks', () => {
    const tasks = [{ id: 1, assignee: 'John Doe TL' }, { id: 2, assignee: 'John Doe' }, { id: 3, assignee: 'John Doe TL', template: 'collaborative' }];
    assert.deepEqual(taskListScope(tasks, 'My Tasks', 'John Doe TL').map(task => task.id), [1, 3]);
    assert.deepEqual(taskListScope(tasks, 'Team Tasks', 'John Doe TL').map(task => task.id), [2]);
    assert.equal(taskListScope(tasks, 'Calendar', 'John Doe TL'), tasks);
});
test('OM has no daily-report cards while department leaders retain their own report types', () => {
    const config = defaultSettings();
    assert.deepEqual(dailyReportTypes({ role: 'Operations Manager', config }), []);
    assert.equal(dailyReportTypes({ role: 'Team Leader', department: 'IT', config }).length, 2);
    assert.equal(dailyReportTypes({ role: 'Team Leader', department: 'Cashier', config }).length, 1);
});


test('dashboard open count matches one active task rather than five completed plus one active', () => {
    const tasks = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, assignee: 'John Paul Marfil', title: 'Task', due: '2026-11-14', status: index === 5 ? 'Not Started' : 'Completed' }));
    const result = dashboardTaskCounts(tasks, [], '2026-11-14', true);
    assert.equal(result.my, 1);
    assert.equal(result.completed, 5);
    assert.equal(result.dueToday, 1);
    assert.equal(result.inProgress, 0);
});

test('management counts keep personal and team work separate and ignore closed tasks', () => {
    const make = (id, status, due = '2026-11-14') => ({ id, status, due, title: 'Task' });
    const result = dashboardTaskCounts([make(1, 'In Progress'), make(2, 'Completed')], [make(3, 'Not Started', '2026-11-13'), make(4, 'Completed'), make(5, 'Denied'), make(6, 'Dismissed'), make(3, 'Not Started', '2026-11-13')], '2026-11-14');
    assert.equal(result.my, 1);
    assert.equal(result.team, 1);
    assert.equal(result.completed, 2);
    assert.equal(result.inProgress, 1);
    assert.equal(result.overdue, 1);
    assert.deepEqual(result.openTeam.map(task => task.id), [3]);
});

test('employee dashboard never includes another persons team totals', () => {
    const result = dashboardTaskCounts([{ id: 1, title: 'Mine', due: '2026-11-14', status: 'Not Started' }], [{ id: 2, title: 'Team', due: '2026-11-13', status: 'Completed' }], '2026-11-14', true);
    assert.equal(result.my, 1);
    assert.equal(result.team, 0);
    assert.equal(result.completed, 0);
});
