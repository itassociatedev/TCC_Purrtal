// Management personal work stays separate from tasks assigned to their team members.
export function taskListScope(tasks, view, actor) {
    if (!actor) return tasks;
    if (view === 'My Tasks') return tasks.filter(task => task.assignee === actor);
    if (view === 'Team Tasks') return tasks.filter(task => task.assignee !== actor);
    return tasks;
}
