import test from 'node:test';
import assert from 'node:assert/strict';
import { taskNotificationChanges, overdueNotifications, notificationPresentation, pendingPreviewNotifications } from '../resources/js/Pages/Tasks/taskNotifications.mjs';
import { tasksForPreview } from '../resources/js/Pages/Tasks/taskDirectory.mjs';

const task = { id: 1, title: 'Check printers', assignee: 'John Doe', branch: 'Makati', department: 'IT', due: '2026-10-23', status: 'Not Started', priority: 'Medium' };
test('task actions generate actionable titles and reviewer feedback without notifying on draft saves', () => {
    const created = taskNotificationChanges([], [task])[0];
    assert.equal(created.action, 'New task'); assert.equal(created.title, task.title); assert.equal(created.taskId, task.id);
    assert.deepEqual(created.readBy, []);
    for (const [status, action] of [['Pending Review', 'Submitted for review'], ['Completed', 'Task approved'], ['Denied', 'Task denied'], ['Revision Needed', 'Revision requested']]) {
        const event = taskNotificationChanges([task], [{ ...task, status, remarks: 'Lorem ipsum.' }])[0];
        assert.equal(event.action, action); assert.equal(event.description, 'Lorem ipsum.');
    }
    assert.equal(taskNotificationChanges([task], [{ ...task, status: 'In Progress', history: [{ text: 'Report draft saved.' }] }]).length, 0);
    assert.equal(taskNotificationChanges([task], [{ ...task }]).length, 0);
    assert.equal(taskNotificationChanges([task], [{ ...task, due: '2026-10-24' }])[0].action, 'Deadline updated');
    assert.equal(taskNotificationChanges([task], [{ ...task, assignee: 'John Doe 2' }])[0].action, 'Assignment updated');
});
test('notification scope matches employee, department and branch task visibility', () => {
    const events = taskNotificationChanges([], [task, { ...task, id: 2, department: 'HR', branch: 'Alabang', assignee: 'John Doe 2' }]);
    assert.equal(tasksForPreview(events, { role: 'Employee', employee: 'John Doe' }).length, 1);
    assert.equal(tasksForPreview(events, { role: 'Team Leader', department: 'IT' }).length, 1);
    assert.equal(tasksForPreview(events, { role: 'Operations Manager', branch: 'Makati' }).length, 1);
    assert.equal(tasksForPreview(events, { role: 'EVP' }).length, 2);
});
test('overdue alerts exclude future and closed work and have stable deduplication keys', () => {
    const events = overdueNotifications([task, { ...task, id: 2, status: 'Completed' }, { ...task, id: 3, due: '2026-10-25' }], '2026-10-24');
    assert.equal(events.length, 1);
    assert.equal(events[0].action, 'Task overdue');
    assert.equal(events[0].dedupeKey, overdueNotifications([task], '2026-10-25')[0].dedupeKey);
});

test('review notifications distinguish actor, assignee and observers, including old records', () => {
    for (const status of ['Completed', 'Denied', 'Revision Needed']) {
        const event = taskNotificationChanges([task], [{ ...task, status, remarks: 'Nice job.' }], { name: 'John Doe TL', role: 'Team Leader' })[0];
        const leader = notificationPresentation(event, { role: 'Team Leader', actor: 'John Doe TL' });
        assert.match(leader.action, /By you/);
        assert.match(leader.description, /You .*the task assigned to John Doe/);
        assert.match(leader.description, /Reviewer remarks: Nice job/);
        const employee = notificationPresentation(event, { role: 'Employee', employee: 'John Doe' });
        assert.match(employee.description, /John Doe TL .*your task/);
        assert.doesNotMatch(employee.action, /By you/);
        const observer = notificationPresentation(event, { role: 'EVP', actor: 'John Doe EVP' });
        assert.match(observer.description, /John Doe TL .*the task assigned to John Doe/);
        const legacy = notificationPresentation({ ...event, actor: undefined }, { role: 'Team Leader', actor: 'John Doe TL' });
        assert.match(legacy.description, /task assigned to John Doe/);
    }
});

test('switching from TL to employee presents new recipient alerts once, without replaying history', () => {
    const scope = { role: 'Employee', employee: 'John Doe' };
    const identity = JSON.stringify(scope);
    const baseline = new Set(['historical']);
    const notifications = [
        { ...task, id: 'new-assignment', action: 'New task' },
        { ...task, id: 'historical', action: 'Task overdue' },
        { ...task, id: 'read', readBy: [identity] },
        { ...task, id: 'cleared', clearedBy: [identity] },
        { ...task, id: 'other-employee', assignee: 'John Doe 2' },
    ];
    const relevant = tasksForPreview(notifications, scope);
    const delivered = new Set();
    const pending = pendingPreviewNotifications(relevant, baseline, delivered, identity);
    assert.deepEqual(pending.map(item => item.id), ['new-assignment']);
    pending.forEach(item => delivered.add(item.id));
    assert.deepEqual(pendingPreviewNotifications(relevant, baseline, delivered, identity), []);
    // A TL's delivery state does not consume the employee's push notification.
    assert.equal(pendingPreviewNotifications(relevant, baseline, new Set(), identity).length, 1);
});
