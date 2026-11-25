import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOperations, formatOperations } from '../resources/js/Pages/Tasks/operationsReport.mjs';
import { ensureDailyTasks } from '../resources/js/Pages/Tasks/dailyTasks.mjs';
import { defaultSettings } from '../resources/js/Pages/Tasks/taskSettings.mjs';

test('operations report validates counts and formats calculated totals and confinement', () => {
    const report = { date: '2026-10-23', branch: 'Makati', reportedBy: 'John Doe', doctors: [{ name: 'Dr. John Doe', count: 8 }], offDoctors: [], surgeries: [{ name: 'Dental', count: 1 }, { name: 'Spay', count: 2 }], wellness: [{ name: 'Consultation', count: 9 }], promos: [], procedures: [{ name: 'Laboratory Test', count: 18 }], nonVet: 3, newConfinement: 2, discharged: 3 };
    assert.equal(validateOperations(report, ['Makati'], report.date), '');
    const text = formatOperations(report);
    assert.match(text, /Surgery: 3 Cats/);
    assert.match(text, /New Confinement: 2 Cats/);
    assert.match(text, /Reported by: John Doe/);
    assert.ok(validateOperations({ ...report, nonVet: -1 }, ['Makati'], report.date));
    assert.ok(validateOperations({ ...report, surgeries: [{ name: 'Dental', count: 1.5 }] }, ['Makati'], report.date));
});

test('department correction removes untouched wrong assignments but preserves existing work', () => {
    const wrong = { id: 1, template: 'narrative-report', recurrence: 'daily', assignee: 'John Doe 2', department: 'Inventory', due: '2026-10-23', status: 'Not Started' };
    const started = { ...wrong, id: 2, status: 'In Progress', narrative: { summary: 'Lorem ipsum.' } };
    const tasks = ensureDailyTasks([wrong, started], defaultSettings(), wrong.due);
    assert.ok(!tasks.some(task => task.id === 1));
    assert.ok(tasks.some(task => task.id === 2 && task.narrative.summary === 'Lorem ipsum.'));
});
