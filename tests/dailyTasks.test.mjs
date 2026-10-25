import test from 'node:test';
import assert from 'node:assert/strict';
import { clinicDate, ensureDailyTasks, formatNarrative, validateNarrative, dashboardDailyTasks } from '../resources/js/Pages/Tasks/dailyTasks.mjs';
import { defaultSettings, changeSetting } from '../resources/js/Pages/Tasks/taskSettings.mjs';
import { filterTasks } from '../resources/js/Pages/Tasks/taskFilters.mjs';

const day = '2026-10-23';
test('dashboard submission totals exclude daily reports with no visible card', () => {
    const tasks = [
        { template: 'it-opening-rounds', scheduledDate: day, status: 'Pending Review' },
        { template: 'narrative-report', scheduledDate: day, status: 'Not Started' },
        { template: 'daily-custom-retired', scheduledDate: day, status: 'Not Started' },
        { template: 'it-opening-rounds', scheduledDate: '2026-10-22', status: 'Completed' },
    ];
    const shown = dashboardDailyTasks(tasks, day, ['it-opening-rounds', 'narrative-report']);
    assert.equal(shown.length, 2);
    assert.equal(shown.filter(task => ['Pending Review', 'Completed'].includes(task.status)).length, 1);
    assert.equal(tasks.length, 4);
});
test('daily tasks roll over at Philippine midnight, independently of UTC dates', () => {
    assert.equal(clinicDate(new Date('2026-10-22T15:59:59Z')), '2026-10-22');
    assert.equal(clinicDate(new Date('2026-10-22T16:00:00Z')), day);
});
test('IT receives both IT reports and Cashier receives the operations report', () => {
    const config = defaultSettings();
    const tasks = ensureDailyTasks([], config, day);
    assert.equal(tasks.filter(task => task.template === 'narrative-report').length, config.employees.filter(person => person.department === 'IT').length);
    assert.equal(tasks.filter(task => task.template === 'it-opening-rounds').length, config.branches.length);
    assert.ok(tasks.filter(task => task.template === 'it-opening-rounds').every(task => task.department === 'IT'));
    assert.equal(tasks.filter(task => task.template === 'daily-operations').length, config.employees.filter(person => person.department === 'Cashier').length);
    assert.ok(tasks.filter(task => task.template === 'daily-operations').every(task => task.department === 'Cashier'));
    assert.equal(ensureDailyTasks(tasks, config, day), tasks);
});
test('new days create new instances without resetting completed work or issue images', () => {
    const config = defaultSettings();
    const previous = ensureDailyTasks([], config, '2026-10-22');
    previous[0] = { ...previous[0], status: 'Completed', narrative: { summary: 'Lorem ipsum.' }, rounds: { images: [{ id: 'saved-photo' }] } };
    const next = ensureDailyTasks(previous, config, day);
    assert.equal(next.length, previous.length * 2);
    assert.equal(next[0].status, 'Completed');
    assert.equal(next[0].rounds.images[0].id, 'saved-photo');
    assert.ok(next.filter(task => task.scheduledDate === day).every(task => task.status === 'Not Started'));
});
test('changing the work branch or renaming an employee does not duplicate the daily report', () => {
    const config = defaultSettings();
    const tasks = ensureDailyTasks([], config, day);
    const task = tasks.find(task => task.assignee === 'John Doe' && task.template === 'narrative-report');
    task.branch = 'Alabang';
    assert.equal(ensureDailyTasks(tasks, config, day).length, tasks.length);
    const employee = config.employees.find(person => person.name === 'John Doe');
    const renamed = changeSetting(config, tasks, { entity: 'employees', action: 'edit', original: 'John Doe', value: { ...employee, name: 'John Doe IT' } });
    assert.equal(ensureDailyTasks(renamed.tasks, renamed.config, day).length, tasks.length);
});
test('legacy submitted rounds remain pending approval as shared branch reports', () => {
    const config = defaultSettings();
    const original = { id: 101, assignee: 'John Doe', template: 'it-opening-rounds', due: day, branch: 'Makati', department: 'IT', status: 'Pending Review', submission: 'Lorem ipsum.' };
    const tasks = ensureDailyTasks([original], config, day);
    assert.equal(tasks.filter(task => task.template === original.template && task.branch === original.branch && !task.supersededOpeningReport).length, 1);
    assert.equal(tasks[0].status, 'Pending Review');
    assert.equal(tasks[0].submittedBy, 'John Doe');
    assert.equal(tasks[0].recurrence, 'daily');
});
test('historical daily reports can be filtered by date and type, including completed tasks', () => {
    const config = defaultSettings();
    const first = ensureDailyTasks([], config, '2026-10-22');
    first.find(task => task.template === 'narrative-report').status = 'Completed';
    const tasks = ensureDailyTasks(first, config, day);
    const entries = filterTasks(tasks, { view: 'Daily Tasks', dailyDate: '2026-10-22', dailyTemplate: 'narrative-report', today: day });
    assert.equal(entries.length, config.employees.filter(person => person.department === 'IT').length);
    assert.ok(entries.every(task => task.scheduledDate === '2026-10-22'));
    assert.ok(entries.some(task => task.status === 'Completed'));
});
test('narrative submission requires a summary, the scheduled date, and a valid work branch', () => {
    const report = { date: day, branch: 'Makati', department: 'IT', summary: 'Lorem ipsum dolor sit amet.', accomplishments: 'Lorem ipsum.' };
    assert.equal(validateNarrative(report, ['Makati'], day), '');
    assert.match(validateNarrative({ ...report, summary: '  ' }, ['Makati'], day), /summary/);
    assert.match(validateNarrative({ ...report, date: '2026-10-22' }, ['Makati'], day), /scheduled date/);
    assert.ok(formatNarrative(report).includes('SUMMARY OF THE DAY\nLorem ipsum dolor sit amet.'));
});
