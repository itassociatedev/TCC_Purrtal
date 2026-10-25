import test from 'node:test';
import assert from 'node:assert/strict';
import { canReviewWeeklyReports, canViewWeeklyReport, canAccessWeeklyReports } from '../resources/js/Pages/Tasks/weeklyReportAccess.mjs';
import { tasksForPreview } from '../resources/js/Pages/Tasks/taskDirectory.mjs';
const report = { id: 1, template: 'intern-weekly-report', assignee: 'John Doe Intern', department: 'IT', branch: 'Makati' };
test('weekly report review is restricted to EVP and the IT TL', () => {
    for (const scope of [{ role: 'EVP', roleName: 'EVP' }, { role: 'Team Leader', department: 'IT' }]) {
        assert.equal(canReviewWeeklyReports(scope), true);
        assert.equal(tasksForPreview([report], scope).length, 1);
    }
    for (const scope of [{ role: 'Operations Manager', branch: 'Makati' }, { role: 'Chief Vet', branch: 'Makati' }, { role: 'EVP', roleName: 'Corporate Services' }, { role: 'Team Leader', department: 'Cashier' }, { role: 'Employee', employee: 'John Doe Supervisor', employeeType: 'Supervisor' }]) {
        assert.equal(canReviewWeeklyReports(scope), false);
        assert.equal(canAccessWeeklyReports(scope), false);
        assert.equal(tasksForPreview([report], scope).length, 0);
        assert.equal(tasksForPreview([{ ...report, coordinator: scope.actor }], scope).length, 0);
    }
});
test('interns retain access to their own weekly report but cannot review other interns', () => {
    const scope = { role: 'Employee', employee: report.assignee, employeeType: 'Intern' };
    assert.equal(canAccessWeeklyReports(scope), true);
    assert.equal(canReviewWeeklyReports(scope), false);
    assert.equal(canViewWeeklyReport(report, scope), true);
    assert.equal(tasksForPreview([report, { ...report, id: 2, assignee: 'John Doe Other' }], scope).length, 1);
    assert.equal(canReviewWeeklyReports({ role: 'Team Leader', department: 'Technology', itDepartment: 'Technology' }), true);
});
