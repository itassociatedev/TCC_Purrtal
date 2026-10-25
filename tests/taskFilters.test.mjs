import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTasks, isOverdue } from '../resources/js/Pages/Tasks/taskFilters.mjs';

// Exercise workflow boundaries with sample identities, without touching the portal database.
const today = '2026-10-22';
const tasks = [
    { id: 1, title: 'Update inventory tracker', assignee: 'John Doe', description: 'Lorem ipsum.', priority: 'Medium', due: '2026-10-21', status: 'In Progress' },
    { id: 2, title: 'Prepare daily clinic summary', assignee: 'John Doe 2', description: 'Lorem ipsum.', priority: 'High', due: today, status: 'Pending Review', submission: 'Lorem ipsum.' },
    { id: 3, title: 'Check medical supplies', assignee: 'John Doe', description: 'Lorem ipsum.', priority: 'High', due: '2026-10-20', status: 'Completed', submission: 'Lorem ipsum.' },
    { id: 4, title: 'Prepare staff meeting agenda', assignee: 'John Doe 2', description: 'Lorem ipsum.', priority: 'Low', due: today, status: 'Denied' },
    { id: 5, title: 'Review client follow-ups', assignee: 'John Doe', description: 'Lorem ipsum.', priority: 'High', due: '2026-10-23', status: 'Pending Approval' },
];
const select = (options) => filterTasks(tasks, { today, view: 'Team Tasks', ...options });

test('active work and the archive are disjoint, including denied requests', () => {
    assert.deepEqual(select({}).map(t => t.id), [1, 2, 5]);
    assert.deepEqual(select({ view: 'Task Archive' }).map(t => t.id), [3, 4]);
    assert.equal(isOverdue(tasks[2], today), false);
    assert.deepEqual(select({ due: 'Overdue' }).map(t => t.id), [1]);
});
test('review queue includes both request approvals and work submissions', () => {
    assert.deepEqual(select({ view: 'Review Queue' }).map(t => t.id), [2, 5]);
    assert.deepEqual(select({ view: 'Review Queue', status: 'Pending Approval' }).map(t => t.id), [5]);
});
test('search, owner, priority, and date filters intersect instead of replacing each other', () => {
    assert.deepEqual(select({ search: '  CLINIC  ', assignee: 'John Doe 2', priority: 'High', due: 'Today' }).map(t => t.id), [2]);
    assert.deepEqual(select({ assignee: 'John Doe', selectedDay: today }), []);
});
test('sorting prioritizes urgent work without mutating stored task order', () => {
    assert.deepEqual(select({ sort: 'priority' }).map(t => t.id), [2, 5, 1]);
    assert.deepEqual(tasks.map(t => t.id), [1, 2, 3, 4, 5]);
});
test('employee submission history includes closed work but excludes unsubmitted requests', () => {
    assert.deepEqual(select({ view: 'Submissions' }).map(t => t.id), [3, 2]);
});
