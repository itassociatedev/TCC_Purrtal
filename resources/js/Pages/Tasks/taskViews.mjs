import { isDailyTemplate } from './dailyTasks.mjs';
import { isWeeklyReport } from './weeklyReports.mjs';

export const isReportTask = task => isDailyTemplate(task) || isWeeklyReport(task);
// Build shared lookups once per task change rather than scanning the list for every employee/day.
export function indexTasks(tasks) {
    const byId = new Map(), byAssignee = new Map(), byDate = new Map();
    for (const task of tasks) {
        byId.set(task.id, task);
        for (const [map, key] of [[byAssignee, task.assignee], [byDate, task.due]]) {
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(task);
        }
    }
    return { byId, byAssignee, byDate };
}
export function reportMatchesDate(task, date) {
    if (!date) return true;
    return isWeeklyReport(task) ? task.weekStart <= date && task.weekEnd >= date : (task.scheduledDate || task.due) === date;
}
export function reportSectionTasks(tasks, { weekly = false, section = 'Reports', date = '' } = {}) {
    return tasks.filter(task => (weekly ? isWeeklyReport(task) : isDailyTemplate(task))
        && (!task.retiredDailyAssignment || ['Archive', 'Activity'].includes(section))
        && (section !== 'Review Queue' || ['Pending Review', 'Pending Approval'].includes(task.status))
        && (section !== 'Archive' || ['Completed', 'Denied', 'Dismissed'].includes(task.status))
        && reportMatchesDate(task, date));
}
// Saved task IDs are authoritative. Older untagged events are matched narrowly within their scope.
export function activityReport(event, index, reports) {
    if (event.taskId != null && index.has(event.taskId)) return isReportTask(index.get(event.taskId)) ? index.get(event.taskId) : null;
    if (isReportTask(event)) return event;
    return reports.find(task => event.assignee === task.assignee && event.department === task.department
        && (event.text?.includes(`“${task.title}”`) || event.text?.startsWith(`${task.title}:`) || event.text?.startsWith(`${task.title} was `))) || null;
}
