import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, changeSetting, loadSettings } from '../resources/js/Pages/Tasks/taskSettings.mjs';
import { ensureDailyTasks, isDailyTemplate } from '../resources/js/Pages/Tasks/dailyTasks.mjs';
import { dailyReportTypes, canEditDailyReport } from '../resources/js/Pages/Tasks/taskPolicy.mjs';
import { formatCustomReport } from '../resources/js/Pages/Tasks/reportTemplates.mjs';

const value = { name: 'Daily Inventory Report', department: 'Inventory', description: 'Review daily inventory.', enabled: true, fields: [{ id: 'count', label: 'Items checked', type: 'number', required: true }] };
test('admin-created templates generate department-specific daily tasks with preserved definitions', () => {
    const { config } = changeSetting(defaultSettings(), [], { entity: 'dailyReports', action: 'add', value });
    const template = config.dailyReports.at(-1);
    const tasks = ensureDailyTasks([], config, '2026-10-23');
    const generated = tasks.filter(task => task.template === template.id);
    assert.equal(generated.length, config.employees.filter(person => person.department === value.department).length);
    assert.ok(generated.every(task => isDailyTemplate(task) && task.department === 'Inventory'));
    const task = generated[0];
    assert.equal(canEditDailyReport(task, { config, role: 'Employee', employee: config.employees.find(person => person.name === task.assignee) }), true);
    assert.ok(dailyReportTypes({ config, role: 'Employee', department: 'Inventory' }).some(([id]) => id === template.id));
    assert.ok(!dailyReportTypes({ config, role: 'Employee', department: 'IT' }).some(([id]) => id === template.id));
    const edited = changeSetting(config, tasks, { entity: 'dailyReports', action: 'edit', original: template.id, value: { ...value, fields: [{ id: 'notes', label: 'Notes', type: 'textarea', required: false }] } });
    assert.equal(edited.tasks.find(item => item.id === task.id).reportDefinition.fields[0].id, 'count');
    const nextDay = ensureDailyTasks(edited.tasks, edited.config, '2026-10-24');
    assert.equal(nextDay.find(item => item.template === template.id && item.due === '2026-10-24').reportDefinition.fields[0].id, 'notes');
    assert.match(formatCustomReport(task, { date: task.due, branch: task.branch, values: { count: 12 } }), /Items checked\n12/);
    const removed = changeSetting(edited.config, nextDay, { entity: 'dailyReports', action: 'remove', original: template.id });
    assert.equal(ensureDailyTasks(removed.tasks, removed.config, '2026-10-25').filter(item => item.template === template.id && item.due === '2026-10-25').length, 0);
    assert.ok(removed.tasks.some(item => item.id === task.id));
});
test('old settings gain built-in templates and empty catalogs remain empty', () => {
    const legacy = defaultSettings(); delete legacy.dailyReports;
    assert.equal(loadSettings(legacy).dailyReports.length, 3);
    assert.equal(loadSettings({ ...legacy, dailyReports: [] }).dailyReports.length, 0);
    assert.throws(() => changeSetting(defaultSettings(), [], { entity: 'dailyReports', action: 'add', value: { ...value, fields: [] } }), /field/);
});
