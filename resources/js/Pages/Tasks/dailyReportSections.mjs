import { isDailyTemplate } from './dailyTasks.mjs';

// Report review and history use the same scoped records without mixing with assigned tasks.
export function dailyReportSection(tasks, section = 'Reports') {
    return tasks.filter(task => isDailyTemplate(task)
        && (section !== 'Review Queue' || ['Pending Review', 'Pending Approval'].includes(task.status))
        && (section !== 'Archive' || ['Completed', 'Denied'].includes(task.status)));
}
