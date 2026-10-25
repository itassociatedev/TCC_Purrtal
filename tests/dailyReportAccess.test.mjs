import test from 'node:test';
import assert from 'node:assert/strict';
import { canEditDailyReport, dailyReportTypes, itReportDone, canCorrectITReport } from '../resources/js/Pages/Tasks/taskPolicy.mjs';

test('submitted IT reports show done and allow only their owner to reopen a correction', () => {
    const context = { role: 'Employee', employee: { name: 'John Doe', department: 'IT' }, config: { itDepartment: 'IT' } };
    for (const template of ['it-opening-rounds', 'narrative-report']) {
        const task = { template, department: 'IT', assignee: 'John Doe', status: 'Pending Review', submission: 'Lorem ipsum.' };
        assert.equal(itReportDone(task), true);
        assert.equal(canCorrectITReport(task, context), true);
        assert.equal(canCorrectITReport({ ...task, status: 'Completed' }, context), true);
        assert.equal(canCorrectITReport(task, { ...context, role: 'EVP' }), false);
        assert.equal(canCorrectITReport(task, { ...context, employee: { name: 'John Doe 2', department: 'IT' } }), false);
        assert.equal(itReportDone({ ...task, status: 'In Progress' }), false);
        assert.equal(canCorrectITReport({ ...task, status: 'Denied' }, context), false);
    }
});

test('department views hide unrelated report types while reviewers retain visibility', () => {
    const config = { itDepartment: 'IT', cashierDepartment: 'Cashier' };
    const types = (role, department) => dailyReportTypes({ role, department, config }).map(([template]) => template);
    assert.deepEqual(types('Employee', 'IT'), ['it-opening-rounds', 'narrative-report']);
    assert.deepEqual(types('Employee', 'Cashier'), ['daily-operations']);
    assert.deepEqual(types('Employee', 'HR'), []);
    assert.deepEqual(types('Team Leader', 'Cashier'), ['daily-operations']);
    assert.equal(types('EVP').length, 3);
    assert.equal(types('Operations Manager').length, 0);
});

test('daily report writes require the assigned department employee and an editable state', () => {
    const config = { itDepartment: 'IT', cashierDepartment: 'Cashier' };
    for (const [template, department] of [['daily-operations', 'Cashier'], ['it-opening-rounds', 'IT'], ['narrative-report', 'IT']]) {
        const task = { template, department, assignee: 'John Doe', status: 'Not Started' };
        const context = { config, role: 'Employee', employee: { name: 'John Doe', department } };
        assert.equal(canEditDailyReport(task, context), true);
        assert.equal(canEditDailyReport(task, { ...context, employee: { name: 'John Doe', department: 'HR' } }), false);
        assert.equal(canEditDailyReport(task, { ...context, employee: { name: 'John Doe 2', department } }), false);
        for (const role of ['Team Leader', 'Operations Manager', 'Chief Vet', 'EVP']) assert.equal(canEditDailyReport(task, { ...context, role }), false);
        for (const status of ['Pending Review', 'Completed', 'Denied']) assert.equal(canEditDailyReport({ ...task, status }, context), false);
        assert.equal(canEditDailyReport({ ...task, status: 'Revision Needed' }, context), true);
    }
});
