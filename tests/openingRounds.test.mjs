import test from 'node:test';
import assert from 'node:assert/strict';
import { branches, departments, employees, ensureOpeningRounds } from '../resources/js/Pages/Tasks/taskDirectory.mjs';
import { emptyRounds, validateRounds, formatRounds, systemChecks } from '../resources/js/Pages/Tasks/openingRounds.mjs';
import { filterTasks } from '../resources/js/Pages/Tasks/taskFilters.mjs';

const today = '2026-10-22';
const complete = () => ({ ...emptyRounds(today, 'Makati'), headcount: 2, leave: 0, off: 2, systems: Object.fromEntries(systemChecks.map(([key]) => [key, 'good'])) });

test('every organization department has a sample employee in all three locations', () => {
    assert.deepEqual(branches, ['Alabang', 'Makati', 'Greenhills']);
    for (const department of departments) for (const branch of branches) {
        assert.ok(employees.some(employee => employee.department === department && employee.branch === branch));
    }
    assert.equal(new Set(employees.map(employee => employee.name)).size, employees.length);
});
test('adding Opening Rounds preserves saved progress and does not duplicate tasks on refresh', () => {
    const existing = { id: 1, title: 'Update inventory tracker', assignee: 'John Doe 2', status: 'In Progress', history: [{ text: 'Lorem ipsum.' }] };
    const once = ensureOpeningRounds([existing], today);
    assert.equal(once.length, 4);
    assert.equal(once[0].status, existing.status);
    assert.deepEqual(once[0].history, existing.history);
    assert.equal(once[0].department, 'Inventory');
    const again = ensureOpeningRounds(once, '2026-10-23');
    assert.equal(again.length, 4);
    assert.ok(again.filter(task => task.template === 'it-opening-rounds').every(task => task.department === 'IT'));
});
test('branch and department filters select the right IT checklist', () => {
    const tasks = ensureOpeningRounds([], today);
    const result = filterTasks(tasks, { today, view: 'Team Tasks', branch: 'Greenhills', department: 'IT' });
    assert.equal(result.length, 1);
    assert.equal(result[0].branch, 'Greenhills');
});
test('systems require an explicit choice rather than defaulting to Good', () => {
    assert.match(validateRounds({ ...complete(), systems: emptyRounds(today, 'Makati').systems }), /every system/);
    assert.equal(validateRounds(complete()), '');
});
test('warning requires a useful issue description', () => {
    const rounds = complete();
    rounds.systems.tvMachines = 'warning';
    rounds.issues = 'None';
    assert.match(validateRounds(rounds), /Describe the issue/);
    rounds.issues = 'Lorem ipsum dolor sit amet.';
    assert.equal(validateRounds(rounds), '');
});
test('invalid dates, manpower counts, and unsupported locations are rejected', () => {
    for (const value of ['', -1, 1.5, null]) assert.match(validateRounds({ ...complete(), headcount: value }), /whole number/);
    assert.match(validateRounds({ ...complete(), date: '2026-02-31' }), /valid rounds date/);
    assert.match(validateRounds({ ...complete(), branch: 'Other' }), /supported branch/);
});
test('formatted report matches the requested sections, symbols, and manpower fields', () => {
    const rounds = complete();
    rounds.systems.tvMachines = 'warning';
    rounds.issues = 'Lorem ipsum dolor sit amet.';
    const report = formatRounds(rounds);
    for (const expected of ['Daily Rounds Update', 'Date : 10/22/2026', 'Branch : Makati', 'Department : IT', 'Headcount: 2', 'Leave: 0', 'Off: 2', 'Internet: ✅', 'TV / Machines: ⚠️', 'ISSUES / MAINTENANCE', 'HELP NEEDED\n• None']) assert.ok(report.includes(expected), expected);
});
