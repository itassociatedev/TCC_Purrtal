import { isWeeklyReport } from './weeklyReports.mjs';
import { isDailyTemplate } from './dailyTasks.mjs';
// Shared filtering rules keep counts, task tables, and exported reports consistent.
export const isOverdue = (task, today) => task.due < today && !['Completed', 'Denied', 'Dismissed'].includes(task.status);

export function filterTasks(tasks, { view, search = '', status = 'All Tasks', priority = 'All', assignee = 'All', department = 'All', branch = 'All', due = 'All', selectedDay = null, today, sort = 'due', priorities = ['High', 'Medium', 'Low'], dailyDate = today, dailyTemplate = 'All' }) {
    const closed = task => ['Completed', 'Denied', 'Dismissed'].includes(task.status);
    const result = tasks.filter(task => {
        if (view === 'Weekly Reports' && !isWeeklyReport(task)) return false;
        if (view === 'Daily Tasks' && (!isDailyTemplate(task) || (task.scheduledDate || task.due) !== dailyDate || (dailyTemplate !== 'All' && task.template !== dailyTemplate))) return false;
        if (['My Tasks', 'Team Tasks', 'Dashboard'].includes(view) && closed(task) && !(view === 'My Tasks' && status === 'Completed' && task.status === 'Completed')) return false;
        if (view === 'Task Archive' && !closed(task)) return false;
        if (view === 'Review Queue' && !['Pending Review', 'Pending Approval'].includes(task.status)) return false;
        if (view === 'Submissions' && !task.submission) return false;
        if (!`${task.title} ${task.assignee} ${task.description} ${task.department || ''} ${task.branch || ''}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
        if (department !== 'All' && task.department !== department) return false;
        if (branch !== 'All' && task.branch !== branch) return false;
        if (priority !== 'All' && task.priority !== priority) return false;
        if (assignee !== 'All' && task.assignee !== assignee) return false;
        if (selectedDay && task.due !== selectedDay) return false;
        if (due === 'Today' && (task.due !== today || closed(task))) return false;
        if (due === 'Overdue' && !isOverdue(task, today)) return false;
        return status === 'All Tasks' || (status === 'Overdue' ? isOverdue(task, today) : task.status === status);
    });
    const priorityOrder = Object.fromEntries(priorities.map((name, index) => [name, index]));
    return result.sort((a, b) => {
        if (sort === 'priority') return priorityOrder[a.priority] - priorityOrder[b.priority] || a.due.localeCompare(b.due);
        if (sort === 'title') return a.title.localeCompare(b.title);
        if (sort === 'newest') return b.id - a.id;
        return a.due.localeCompare(b.due) || priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}
