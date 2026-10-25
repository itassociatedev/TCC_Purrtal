import { taskHierarchy, canDelegate } from './collaborativeTasks.mjs';

export function canDeleteTask(task, tasks, context) {
    if (task.recurrence === 'daily' || task.recurrence === 'weekly') return false;
    if (context.role === 'EVP') return true;
    if (context.role === 'Operations Manager') return task.branch === context.branch || task.originBranch === context.branch || task.assignee === context.actor;
    if (context.role === 'Team Leader') return task.department === context.department || task.originDepartment === context.department || task.assignee === context.actor;
    const parent = tasks.find(item => item.id === task.parentId);
    return Boolean(parent && canDelegate(parent, context));
}
export function deleteTaskTree(task, tasks, context) {
    if (!canDeleteTask(task, tasks, context)) throw new Error('Your role cannot delete this task. Automatic reports are managed through report settings.');
    const removedIds = new Set([task.id, ...taskHierarchy(task, tasks).map(row => row.task.id)]);
    const blockers = tasks.filter(item => !removedIds.has(item.id) && item.dependsOn?.some(id => removedIds.has(id)));
    if (blockers.length) throw new Error(`These tasks still depend on it: ${blockers.map(item => item.title).join(', ')}. Remove the containing main task instead, or keep this prerequisite.`);
    return { tasks: tasks.filter(item => !removedIds.has(item.id)), removedIds };
}
