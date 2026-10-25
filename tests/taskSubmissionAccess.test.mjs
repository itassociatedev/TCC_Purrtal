import test from 'node:test';
import assert from 'node:assert/strict';
import { canSubmitAssignedTask } from '../resources/js/Pages/Tasks/taskPolicy.mjs';

test('only the assigned employee may start or submit an editable standard task', () => {
    const task = { assignee: 'John Doe', status: 'Not Started' };
    const employee = { name: 'John Doe' };
    for (const status of ['Not Started', 'In Progress', 'Revision Needed']) assert.equal(canSubmitAssignedTask({ ...task, status }, { role: 'Employee', employee }), true);
    for (const role of ['Team Leader', 'Operations Manager', 'Chief Vet', 'EVP']) assert.equal(canSubmitAssignedTask(task, { role, employee }), false);
    assert.equal(canSubmitAssignedTask(task, { role: 'Employee', employee: { name: 'John Doe 2' } }), false);
    for (const status of ['Pending Approval', 'Pending Review', 'Completed', 'Denied']) assert.equal(canSubmitAssignedTask({ ...task, status }, { role: 'Employee', employee }), false);
});
