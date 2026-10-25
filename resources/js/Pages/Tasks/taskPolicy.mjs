import { reportTemplates } from './reportTemplates.mjs';
import {approvalBlocksWork} from './taskApproval.mjs';
// Preview role controls the task workflow; actual account permissions control Workspace Setup.
export const canRequestTask = role => ['Team Leader', 'Operations Manager', 'Chief Vet', 'EVP'].includes(role);
export const branchScopedRole = role => ['Operations Manager', 'Chief Vet'].includes(role);
// Viewing or supervising an employee's task does not grant permission to perform that employee's work.
export const canSubmitAssignedTask = (task, { role, employee, actor }) => Boolean(role === 'Employee' ? employee?.name && employee.name === task.assignee : actor?.baseRole === role && actor?.name === task.assignee)
    && !approvalBlocksWork(task) && ['Not Started', 'In Progress', 'Revision Needed'].includes(task.status);
// Department screens show only their own report types; organization and branch reviewers see all types.
export function dailyReportTypes({ role, department, config }) {
    if (role === 'Operations Manager') return [];
    const reports = reportTemplates(config).filter(report => report.enabled).map(report => [report.id, report.name, report.description, report.department]);
    return ['Employee', 'Team Leader'].includes(role) ? reports.filter(report => report[3] === department) : reports;
}
// Report authorship belongs to the assigned department employee; management reviews without rewriting it.
export function canEditDailyReport(task, { role, employee, config }) {
    const department = reportTemplates(config).find(report => report.id === task.template)?.department || (task.reportDefinition ? task.department : null) || (task.template === 'daily-operations' ? config.cashierDepartment || 'Cashier'
        : ['it-opening-rounds', 'narrative-report'].includes(task.template) ? config.itDepartment : null);
    return Boolean(department && role === 'Employee' && (employee?.name === task.assignee || task.template === 'it-opening-rounds' && task.sharedBranchReport && (employee?.availableBranches || [employee?.branch]).includes(task.branch))
        && employee.department === department && task.department === department
        && ['Not Started', 'In Progress', 'Revision Needed'].includes(task.status));
}
export const itReportDone = task => ['it-opening-rounds', 'narrative-report'].includes(task.template)
    && ['Pending Review', 'Completed'].includes(task.status) && Boolean(task.submission);
// Corrections reopen the employee's own submitted report and must go through review again.
export const canCorrectITReport = (task, context) => !task.sharedBranchReport && itReportDone(task)
    && canEditDailyReport({ ...task, status: 'In Progress' }, context);
export const pageTitle = ({ view, role, roleLabel, scope }) => view === 'Workspace Setup' ? 'Workspace Setup'
    : role === 'EVP' ? view === 'Dashboard' ? `${roleLabel} Dashboard` : view
    : view === 'Dashboard' ? `${scope} · ${roleLabel} Dashboard` : `${view} · ${scope}`;
