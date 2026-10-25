import test from 'node:test';
import assert from 'node:assert/strict';
import { taskListScope } from '../resources/js/Pages/Tasks/personalTasks.mjs';
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
