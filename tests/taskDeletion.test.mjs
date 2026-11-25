import test from 'node:test';
import assert from 'node:assert/strict';
import { canDeleteTask, deleteTaskTree } from '../resources/js/Pages/Tasks/taskDeletion.mjs';
import { clearNotificationHistory } from '../resources/js/Pages/Tasks/taskNotifications.mjs';

const task = { id: 1, assignee: 'John Doe', department: 'IT', branch: 'Makati', template: 'collaborative', status: 'Not Started' };
test('task deletion enforces role scope and preserves automatic report schedules', () => {
    assert.equal(canDeleteTask(task, [task], { role: 'EVP' }), true);
    assert.equal(canDeleteTask(task, [task], { role: 'Team Leader', department: 'IT' }), true);
    assert.equal(canDeleteTask(task, [task], { role: 'Operations Manager', branch: 'Alabang' }), false);
    assert.equal(canDeleteTask(task, [task], { role: 'Employee', employee: 'John Doe' }), false);
    assert.equal(canDeleteTask({ ...task, recurrence: 'daily' }, [task], { role: 'EVP' }), false);
});
test('deletion removes the hierarchy but refuses to leave external dependencies broken', () => {
    const child = { id: 2, parentId: 1, title: 'Monitor Inventory', template: 'collaborative' };
    const leaf = { id: 3, parentId: 2, title: 'Compare records' };
    const other = { id: 4, title: 'Other task' };
    assert.deepEqual(deleteTaskTree(task, [task, child, leaf, other], { role: 'EVP' }).tasks, [other]);
    assert.throws(() => deleteTaskTree(task, [task, child, leaf, { ...other, dependsOn: [3] }], { role: 'EVP' }), /depend/);
});
test('clearing task notifications is recipient-scoped and retains overdue deduplication data', () => {
    const notifications = [{ id: 'one', dedupeKey: 'overdue:1:2026-10-22', readBy: ['other-view'] }, { id: 'two', readBy: [] }];
    const result = clearNotificationHistory(notifications, ['one'], 'my-view');
    assert.deepEqual(result[0].clearedBy, ['my-view']);
    assert.deepEqual(result[0].readBy, ['other-view', 'my-view']);
    assert.equal(result[0].dedupeKey, notifications[0].dedupeKey);
    assert.equal(result[1], notifications[1]);
    assert.equal(notifications[0].clearedBy, undefined);
});
