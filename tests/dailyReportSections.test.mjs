import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyReportSection } from '../resources/js/Pages/Tasks/dailyReportSections.mjs';
const tasks = [
    { id: 1, template: 'it-opening-rounds', recurrence: 'daily', status: 'Pending Review' },
    { id: 2, template: 'narrative-report', recurrence: 'daily', status: 'Completed' },
    { id: 3, template: 'daily-custom-sample', recurrence: 'daily', status: 'Denied' },
    { id: 4, template: 'standard', status: 'Pending Review' },
];
test('daily report workspace excludes regular tasks and preserves review and archive records', () => {
    assert.deepEqual(dailyReportSection(tasks).map(t => t.id), [1, 2, 3]);
    assert.deepEqual(dailyReportSection(tasks, 'Review Queue').map(t => t.id), [1]);
    assert.deepEqual(dailyReportSection(tasks, 'Archive').map(t => t.id), [2, 3]);
});
