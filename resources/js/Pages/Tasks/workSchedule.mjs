// A dated assignment overrides the home branch for that day only, never the next day's location.
export const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function scheduledBranch(employee, date) {
    const assignment = employee.branchSchedule?.[date];
    if (assignment === 'Off') return 'Off';
    return (employee.availableBranches || [employee.branch]).includes(assignment) ? assignment : employee.branch;
}
export function applyBranchAssignment(tasks, employee, date, branch) {
    return tasks.flatMap(task => {
        if (task.sharedBranchReport || task.assignee !== employee.name || task.recurrence !== 'daily' || (task.scheduledDate || task.due) !== date || !['Not Started', 'In Progress', 'Revision Needed'].includes(task.status)) return [task];
        // Only untouched assignments disappear on a day off; existing work is kept for the employee.
        if (branch === 'Off') return task.status === 'Not Started' && !task.rounds && !task.narrative && !task.operations && !task.customReport && !task.submission && !task.history?.length ? [] : [task];
        return [{ ...task, branch, ...(task.rounds ? { rounds: { ...task.rounds, branch } } : {}), ...(task.narrative ? { narrative: { ...task.narrative, branch } } : {}), ...(task.operations ? { operations: { ...task.operations, branch } } : {}), ...(task.customReport ? { customReport: { ...task.customReport, branch } } : {}) }];
    });
}
