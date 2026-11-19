import { filterTasks, isOverdue } from './taskFilters.mjs';
// Management personal work stays separate from tasks assigned to their team members.
export function taskListScope(tasks, view, actor) {
    if (!actor) return tasks;
    if (view === 'My Tasks') return tasks.filter(task => task.assignee === actor);
    if (view === 'Team Tasks') return tasks.filter(task => task.assignee !== actor);
    return tasks;
}

// Dashboard totals use the same default open-task view as My Tasks and Team Tasks.
// Completed work remains a separate statistic rather than inflating open assignments.
export function dashboardTaskCounts(myTasks, teamTasks, today, personalOnly = false) {
    const unique = tasks => [...new Map(tasks.map(task => [String(task.id), task])).values()];
    const my = unique(myTasks);
    const team = personalOnly ? [] : unique(teamTasks);
    const all = unique([...my, ...team]);
    const openMy = filterTasks(my, { view: 'My Tasks', today });
    const openTeam = filterTasks(team, { view: 'Team Tasks', today });
    const open = unique([...openMy, ...openTeam]);
    return {
        openMy, openTeam, all,
        my: openMy.length, team: openTeam.length,
        inProgress: all.filter(task => task.status === 'In Progress').length,
        completed: all.filter(task => task.status === 'Completed').length,
        dueToday: open.filter(task => task.due === today).length,
        overdue: open.filter(task => isOverdue(task, today)).length,
    };
}
