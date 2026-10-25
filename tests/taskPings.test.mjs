import test from 'node:test';
import assert from 'node:assert/strict';
import { canPingTask, sendTaskPing, acknowledgeTaskPing, validPingChange } from '../resources/js/Pages/Tasks/taskPings.mjs';
import { taskNotificationChanges } from '../resources/js/Pages/Tasks/taskNotifications.mjs';

const task = { id: 1, title: 'Review inventory', assignee: 'John Doe', department: 'IT', branch: 'Makati', status: 'In Progress' };
const leader = { role: 'Team Leader', department: 'IT', sender: 'John Doe 60' };
test('TL and OM follow-ups respect scope while EVP can follow up across the organization', () => {
    assert.equal(canPingTask(task, leader), true);
    assert.equal(canPingTask(task, { ...leader, department: 'HR' }), false);
    assert.equal(canPingTask(task, { role: 'Operations Manager', branch: 'Makati' }), true);
    assert.equal(canPingTask(task, { role: 'Operations Manager', branch: 'Alabang' }), false);
    assert.equal(canPingTask(task, { role: 'EVP' }), true);
    assert.equal(canPingTask(task, { role: 'Employee', employee: 'John Doe' }), false);
    assert.equal(canPingTask(task, { role: 'Chief Vet', branch: 'Makati' }), false);
    assert.equal(canPingTask({ ...task, status: 'Completed' }, leader), false);
    assert.throws(() => sendTaskPing(task, leader, ' '), /message/);
});
test('only the assigned employee may acknowledge a ping and task completion stays unchanged', () => {
    const pings = sendTaskPing(task, leader, 'Please acknowledge this follow-up.');
    assert.equal(validPingChange(task, pings, leader), true);
    const pending = { ...task, pings };
    const employee = { role: 'Employee', employee: 'John Doe' };
    const acknowledged = acknowledgeTaskPing(pending, pings[0].id, employee);
    assert.ok(acknowledged[0].acknowledgedAt);
    assert.equal(validPingChange(pending, acknowledged, employee), true);
    assert.equal(acknowledged[0].acknowledgedBy, 'John Doe');
    assert.equal(pending.status, 'In Progress');
    assert.equal(pings[0].acknowledgedAt, null);
    assert.throws(() => acknowledgeTaskPing(pending, pings[0].id, leader), /assigned employee/);
    assert.throws(() => acknowledgeTaskPing(pending, pings[0].id, { ...employee, employee: 'John Doe 2' }), /assigned employee/);
    assert.throws(() => acknowledgeTaskPing({ ...pending, pings: acknowledged }, pings[0].id, employee), /assigned employee/);
    assert.equal(validPingChange(pending, [{ ...acknowledged[0], message: 'Tampered' }], employee), false);
    assert.equal(validPingChange(task, pings, employee), false);
});
test('ping and acknowledgement generate distinct actionable notifications', () => {
    const pings = sendTaskPing(task, leader, 'Please send an update.');
    const pending = { ...task, pings };
    const sent = taskNotificationChanges([task], [pending]);
    assert.equal(sent.length, 1);
    assert.match(sent[0].action, /Acknowledgement requested/);
    assert.equal(sent[0].taskId, task.id);
    const next = { ...pending, pings: acknowledgeTaskPing(pending, pings[0].id, { role: 'Employee', employee: 'John Doe' }) };
    const ack = taskNotificationChanges([pending], [next]);
    assert.equal(ack.length, 1);
    assert.equal(ack[0].action, 'Follow-up acknowledged');
});
