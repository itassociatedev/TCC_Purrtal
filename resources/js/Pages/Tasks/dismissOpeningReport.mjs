export const canDismissOpeningReport = (task, scope, today) => task?.template === 'it-opening-rounds'
    && scope.role === 'Team Leader' && scope.department === scope.itDepartment && Boolean(scope.actor)
    && (task.scheduledDate || task.due) === today && ['Not Started','In Progress','Revision Needed'].includes(task.status);
export function dismissOpeningReport(task, scope, today) {
    if (!canDismissOpeningReport(task, scope, today)) throw new Error('Only the IT Team Leader can dismiss an unfinished Opening Report for today.');
    return {status:'Dismissed',dismissedBy:scope.actor,dismissedAt:new Date().toISOString()};
}
