import test from 'node:test';
import assert from 'node:assert/strict';
import { employeeColor, employeeTaskGroups, calendarDayPreview, employeeOverdueCounts } from '../resources/js/Pages/Tasks/calendarEmployees.mjs';

test('employee overdue badges count past deadlines across months but exclude closed and future work', () => {
    const tasks = [
        { assignee: 'John Doe', due: '2026-09-01', status: 'Not Started' },
        { assignee: 'John Doe', due: '2026-10-22', status: 'In Progress' },
        { assignee: 'John Doe', due: '2026-10-22', status: 'Completed' },
        { assignee: 'John Doe', due: '2026-10-22', status: 'Denied' },
        { assignee: 'John Doe', due: '2026-10-23', status: 'Not Started' },
        { assignee: 'John Doe 2', due: '2026-10-24', status: 'Not Started' },
    ];
    assert.deepEqual(employeeOverdueCounts(tasks, '2026-10-23'), { 'John Doe': 2 });
});

test('busy calendar days show three employee bars and count hidden employees, not hidden tasks', () => {
    const tasks = Array.from({ length: 50 }, (_, index) => ({ assignee: `John Doe ${index + 1}` }));
    tasks.push({ assignee: 'John Doe 1' }, { assignee: 'John Doe 1' });
    const preview = calendarDayPreview(tasks);
    assert.equal(preview.shown.length, 3);
    assert.equal(preview.total, 50);
    assert.equal(preview.more, 47);
    assert.equal(preview.shown[0].count, 3);
    assert.equal(calendarDayPreview(tasks.slice(0, 2)).more, 0);
});

test('calendar groups all due tasks by employee rather than truncating task titles', () => {
    const groups = employeeTaskGroups([{ assignee: 'John Doe 2' }, { assignee: 'John Doe' }, { assignee: 'John Doe' }, { assignee: 'John Doe 2' }, { assignee: 'John Doe 3' }]);
    assert.deepEqual(groups.map(({ name, count }) => [name, count]), [['John Doe', 2], ['John Doe 2', 2], ['John Doe 3', 1]]);
    assert.equal(groups[0].color, employeeColor('John Doe'));
    assert.equal(employeeTaskGroups([{ assignee: 'John Doe 2' }])[0].color, groups[1].color);
    assert.notEqual(groups[0].color, groups[1].color);
    assert.deepEqual(employeeTaskGroups([]), []);
});
