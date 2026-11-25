import test from 'node:test';
import assert from 'node:assert/strict';
import { indexTasks, isReportTask, reportSectionTasks, reportMatchesDate, activityReport } from '../resources/js/Pages/Tasks/taskViews.mjs';
const tasks = [
    { id: 1, title: 'Check network', assignee: 'John Doe', department: 'IT', due: '2026-10-24', template: 'standard', status: 'Pending Review' },
    { id: 2, title: 'Opening Rounds', assignee: 'John Doe', department: 'IT', due: '2026-10-24', scheduledDate: '2026-10-24', template: 'it-opening-rounds', status: 'Completed' },
    { id: 3, title: 'Weekly Report', assignee: 'John Doe', department: 'IT', due: '2026-10-30', template: 'intern-weekly-report', weekStart: '2026-10-24', weekEnd: '2026-10-30', status: 'Pending Review' },
    { id: 4, title: 'Test', assignee: 'John Doe 2', department: 'Cashier', due: '2026-10-24', template: 'daily-custom-test', status: 'Denied' },
];
test('reports have independent review and archive lists without duplicating regular tasks', () => {
    assert.deepEqual(tasks.filter(task => !isReportTask(task)).map(task => task.id), [1]);
    assert.deepEqual(reportSectionTasks(tasks, { weekly: true, section: 'Review Queue' }).map(task => task.id), [3]);
    assert.deepEqual(reportSectionTasks(tasks, { section: 'Archive' }).map(task => task.id), [2, 4]);
    assert.deepEqual(reportSectionTasks(tasks, { weekly: true, section: 'Archive' }), []);
    assert.equal(reportMatchesDate(tasks[2], '2026-10-26'), true);
    assert.equal(reportMatchesDate(tasks[2], '2026-10-31'), false);
    assert.equal(reportMatchesDate(tasks[1], '2026-10-25'), false);
});
test('lookup groups preserve task identities and original order without changing records', () => {
    const before = JSON.stringify(tasks);
    const index = indexTasks(tasks);
    assert.equal(index.byId.get(2), tasks[1]);
    assert.deepEqual(index.byAssignee.get('John Doe').map(task => task.id), [1, 2, 3]);
    assert.deepEqual(index.byDate.get('2026-10-24').map(task => task.id), [1, 2, 4]);
    assert.equal(JSON.stringify(tasks), before);
});
test('report activity uses task identity and avoids unrelated text or employee matches', () => {
    const index = indexTasks(tasks).byId;
    const reports = tasks.filter(isReportTask);
    assert.equal(activityReport({ taskId: 1, text: 'Opening Rounds approved' }, index, reports), null);
    assert.equal(activityReport({ taskId: 3 }, index, reports), tasks[2]);
    assert.equal(activityReport({ text: 'Test network settings', assignee: 'John Doe', department: 'IT' }, index, reports), null);
    assert.equal(activityReport({ text: '“Opening Rounds” submitted.', assignee: 'John Doe', department: 'IT' }, index, reports), tasks[1]);
});
