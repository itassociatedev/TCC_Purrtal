// Fixed Saturday–Friday periods include every workday regardless of individual days off.
export function weekRange(day) {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + (5 - date.getUTCDay() + 7) % 7);
    const end = date.toISOString().slice(0, 10);
    date.setUTCDate(date.getUTCDate() - 6);
    return { start: date.toISOString().slice(0, 10), end };
}
export const isIntern = (employee, config) => employee?.employeeType === 'Intern';
export const isWeeklyReport = task => task.template === 'intern-weekly-report';
export function weeklySummary(task, accomplishments) {
    if (!accomplishments.length) return `Week of ${task.weekStart} to ${task.weekEnd}: No completed tasks recorded yet.`;
    return `During the week of ${task.weekStart} to ${task.weekEnd}, I completed ${accomplishments.length} task${accomplishments.length === 1 ? '' : 's'}:\n\n${accomplishments.map(item => `• ${item.title}${item.branch ? ` (${item.branch})` : ''}`).join('\n')}`;
}
export function accomplishedThisWeek(tasks, employee, start, end) {
    return tasks.filter(task => {
        if (task.assignee !== employee || task.status !== 'Completed' || isWeeklyReport(task)) return false;
        const timestamp = task.completedAt || task.history?.find(event => /approved|completed/i.test(event.text))?.at;
        if (!timestamp) return false; // A deadline alone does not establish when work was completed.
        const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp));
        return date >= start && date <= end;
    });
}
export function ensureWeeklyTasks(tasks, config, day) {
    const range = weekRange(day);
    // Move only open current reports to the Friday cycle; submitted history keeps its original dates.
    let changed = false;
    const adjusted = tasks.map(task => {
        if (!isWeeklyReport(task) || !['Not Started', 'In Progress', 'Revision Needed'].includes(task.status) || task.weekStart > day || task.weekEnd < day || task.weekStart === range.start && task.weekEnd === range.end && task.due === range.end) return task;
        changed = true;
        return { ...task, weekStart: range.start, weekEnd: range.end, due: range.end };
    });
    let result = changed ? adjusted : tasks;
    let id = Math.max(1000, ...tasks.map(task => Number(task.id) || 0));
    for (const employee of config.employees.filter(person => isIntern(person, config))) {
        const { start, end } = range;
        // Preserve already submitted legacy periods through their original end date.
        if (result.some(task => isWeeklyReport(task) && task.assignee === employee.name && task.weekStart <= day && task.weekEnd >= day && ['Pending Review', 'Completed', 'Denied'].includes(task.status))) continue;
        if (result.some(task => isWeeklyReport(task) && task.assignee === employee.name && task.weekStart === start)) continue;
        if (result === tasks) result = [...tasks];
        result.push({ id: ++id, template: 'intern-weekly-report', title: 'Intern Weekly Report', assignee: employee.name, department: employee.department, branch: employee.branch, weekStart: start, weekEnd: end, due: end, status: 'Not Started', recurrence: 'weekly', kind: 'Weekly report', priority: config.priorities[Math.min(1, config.priorities.length - 1)], description: 'Summarize tasks accomplished this week, problems or issues, and solutions. Submit every Friday.', submission: '', remarks: '' });
    }
    return result;
}
export const canEditWeeklyReport = (task, employee, config, role) => role === 'Employee' && isIntern(employee, config) && task.assignee === employee.name && ['Not Started', 'In Progress', 'Revision Needed'].includes(task.status);
export function formatWeeklyReport(task, report) {
    return `INTERN WEEKLY REPORT\n${task.weekStart} to ${task.weekEnd}\nReported by: ${task.assignee}\nDepartment: ${task.department}\n\nSUMMARY OF TASKS\n${report.summary}\n\nPROBLEMS / ISSUES\n${report.problems || report.challenges || 'None'}\n\nSOLUTIONS\n${report.solutions || 'None'}`;
}
