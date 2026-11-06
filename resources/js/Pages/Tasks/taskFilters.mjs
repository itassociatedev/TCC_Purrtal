import {narrativeDateMatches,narrativeFrequencyMatches} from './narrativePeriods.mjs';
import {matchesSearch} from './search.mjs';
import { isWeeklyReport } from './weeklyReports.mjs';
import { isDailyTemplate } from './dailyTasks.mjs';
// Shared filtering rules keep counts, task tables, and exported reports consistent.
export const isOverdue = (task, today) => task.due < today && !['Completed', 'Denied', 'Dismissed'].includes(task.status);

export function taskMatchesDateRange(task,from='',to=''){
 if(from&&to&&from>to)return false;
 const report=isDailyTemplate(task)||isWeeklyReport(task);
 const start=report?(task.periodStart||task.weekStart||task.scheduledDate||task.due):task.due;
 const end=report?(task.periodEnd||task.weekEnd||task.scheduledDate||task.due):task.due;
 return (!from||Boolean(end&&end>=from))&&(!to||Boolean(start&&start<=to));
}
export function filterTasks(tasks, { view, search = '', status = 'All Tasks', priority = 'All', assignee = 'All', department = 'All', branch = 'All', due = 'All', selectedDay = null, today, sort = 'due', priorities = ['Critical', 'High', 'Medium', 'Low'], dailyDate = today, dailyTemplate = 'All', narrativeFrequency='daily',from='',to='',frequency='All' }) {
    const closed = task => ['Completed', 'Denied', 'Dismissed'].includes(task.status);
    const result = tasks.filter(task => {
        if(frequency!=='All'&&(task.frequency||'once')!==frequency)return false;
        if(!taskMatchesDateRange(task,from,to))return false;
        if (view === 'Weekly Reports' && !isWeeklyReport(task)) return false;
        if (view === 'Daily Tasks' && (task.template==='narrative-report'||task.template==='intern-weekly-report') ? !narrativeFrequencyMatches(task,narrativeFrequency)||!narrativeDateMatches(task,from||to?'':dailyDate) : view==='Daily Tasks'&&(!isDailyTemplate(task)||!(from||to)&&(task.scheduledDate||task.due)!==dailyDate||(dailyTemplate!=='All'&&task.template!==dailyTemplate))) return false;
        if (['My Tasks', 'Team Tasks', 'Dashboard'].includes(view) && closed(task) && !(view === 'My Tasks' && status === 'Completed' && task.status === 'Completed')) return false;
        if (view === 'Task Archive' && !closed(task)) return false;
        if (view === 'Review Queue' && !['Pending Review', 'Pending Approval'].includes(task.status)) return false;
        if (view === 'Submissions' && !task.submission) return false;
        if (!matchesSearch(search,task.title,task.assignee,task.description,task.department,task.branch,task.status,task.priority,task.kind,task.due,task.submittedBy)) return false;
        if (department !== 'All' && task.department !== department) return false;
        if (branch !== 'All' && task.branch !== branch) return false;
        if (priority !== 'All' && task.priority !== priority) return false;
        if (assignee !== 'All' && task.assignee !== assignee) return false;
        if (selectedDay && task.due !== selectedDay) return false;
        if (due === 'Today' && (task.due !== today || closed(task))) return false;
        if (due === 'Overdue' && !isOverdue(task, today)) return false;
        return status === 'All Tasks' || (status === 'Overdue' ? isOverdue(task, today) : task.status === status);
    });
    const priorityOrder = Object.fromEntries(['Critical',...priorities.filter(name=>name!=='Critical')].map((name, index) => [name, index]));
    return result.sort((a, b) => {
        if (sort === 'priority') return priorityOrder[a.priority] - priorityOrder[b.priority] || a.due.localeCompare(b.due);
        if (sort === 'title') return a.title.localeCompare(b.title);
        if (sort === 'newest') return b.id - a.id;
        return a.due.localeCompare(b.due) || priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}
