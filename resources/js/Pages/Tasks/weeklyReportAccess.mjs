// Corporate Services shares some EVP workflows, but weekly reports have a narrower audience.
export const canReviewWeeklyReports = scope => (scope.role === 'EVP' && (!scope.roleName || scope.roleName === 'EVP'))
    || (scope.role === 'Team Leader' && scope.department === (scope.itDepartment || 'IT'));
export const canAccessWeeklyReports = scope => canReviewWeeklyReports(scope)
    || scope.role === 'Employee' && scope.employeeType === 'Intern';
export const canViewWeeklyReport = (task, scope) => canReviewWeeklyReports(scope)
    || scope.role === 'Employee' && scope.employeeType === 'Intern' && task.assignee === scope.employee;
