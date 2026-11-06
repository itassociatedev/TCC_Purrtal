import { isOverdue } from './taskFilters.mjs';

const employeeColors = ['#496681', '#95595d', '#4d7565'];

// Count across the viewer's entire permitted scope, including overdue work from earlier months.
export function employeeOverdueCounts(tasks, today) {
    const counts = {};
    for (const task of tasks) if (isOverdue(task, today)) {
        const name = task.assignee || 'Unassigned';
        Object.defineProperty(counts, name, { value: (Object.hasOwn(counts, name) ? counts[name] : 0) + 1, enumerable: true, writable: true, configurable: true });
    }
    return counts;
}
// Name-based colors stay consistent when navigating months or filtering the calendar.
export function employeeColor(name) {
    let hash = 0;
    for (const character of name) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
    return employeeColors[hash % 3];
}
export function employeeTaskGroups(tasks) {
    const groups = new Map();
    for (const task of tasks) {
        const name = task.assignee || 'Unassigned';
        groups.set(name, (groups.get(name) || 0) + 1);
    }
    return [...groups].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([name, count], index) => ({ name, count, color: employeeColors[index % 3] }));
}
export function calendarDayPreview(tasks, limit = 3) {
    const employees = employeeTaskGroups(tasks);
    return { shown: employees.slice(0, limit), more: Math.max(0, employees.length - limit), total: employees.length };
}
