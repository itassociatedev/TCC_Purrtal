import { consolidateOpeningReports } from './sharedOpeningReports.mjs';
import { ensureWeeklyTasks } from './weeklyReports.mjs';
import { scheduledBranch } from './workSchedule.mjs';
import { reportTemplates } from './reportTemplates.mjs';
// Daily instances follow the clinic's Philippine calendar date, even on a device in another timezone.
export function clinicDate(date = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}
export const isDailyTemplate = task => (['it-opening-rounds', 'narrative-report', 'daily-operations'].includes(task.template) || task.template?.startsWith('daily-custom-'));
const dailyKey = task => `${task.template}:${encodeURIComponent(task.template === 'it-opening-rounds' ? task.branch : task.assignee)}:${task.scheduledDate || task.due}`;
// Dashboard totals and cards use the same active templates; historical/paused reports stay in task history.
export const dashboardDailyTasks = (tasks, day, templateIds) => tasks.filter(task => isDailyTemplate(task)
    && (task.scheduledDate || task.due) === day && templateIds.includes(task.template));

// Generate only today's work when opened; preserve all previous instances, drafts, photos, and review states.
export function ensureDailyTasks(tasks, config, day) {
    let changed = false;
    // Remove only untouched automatic reports assigned to the wrong department by the old schedule.
    const activeNames = new Set(config.employees.map(person => person.name));
    const retained = tasks.filter(task => {
        const wrongDepartment = ['it-opening-rounds', 'narrative-report'].includes(task.template) && task.department !== config.itDepartment;
        const untouched = task.recurrence === 'daily' && task.status === 'Not Started' && !task.submission && !task.rounds && !task.narrative && !task.history?.length;
        const removedEmployee = isDailyTemplate(task) && task.template !== 'it-opening-rounds' && !activeNames.has(task.assignee);
        return !((wrongDepartment || removedEmployee) && untouched);
    });
    changed = retained.length !== tasks.length;
    const result = retained.map(task => {
        if (!isDailyTemplate(task)) return task;
        const retired = task.template !== 'it-opening-rounds' && !activeNames.has(task.assignee);
        if (Boolean(task.retiredDailyAssignment) !== retired) { task = {...task, retiredDailyAssignment:retired}; changed=true; }
        const key = dailyKey(task);
        if (task.recurrence === 'daily' && task.dailyKey === key && task.scheduledDate) return task;
        changed = true;
        return { ...task, recurrence: 'daily', scheduledDate: task.scheduledDate || task.due, dailyKey: key };
    });
    const keys = new Set(result.filter(isDailyTemplate).map(task => task.dailyKey));
    let id = Math.max(1000, ...result.map(task => Number(task.id) || 0));
    for (const employee of config.employees) {
        if (scheduledBranch(employee, day) === 'Off') continue;
        const templates = reportTemplates(config).filter(report => report.enabled && report.department === employee.department).map(report => report.id);
        for (const template of templates) {
            // Use the dated assignment; a temporary branch never carries over to an unscheduled day.
            const branch = scheduledBranch(employee, day);
            const task = { id: ++id, template, ...(template === 'it-opening-rounds' ? {sharedBranchReport:true} : {}), assignee: template === 'it-opening-rounds' ? 'IT team' : employee.name, branch, department: employee.department, due: day, scheduledDate: day, recurrence: 'daily', status: 'Not Started', kind: 'Daily task', title: template === 'it-opening-rounds' ? 'Opening Rounds' : template === 'daily-operations' ? 'Daily Operations Report' : 'Narrative Report', priority: template === 'it-opening-rounds' ? config.priorities[0] : config.priorities[Math.min(1, config.priorities.length - 1)], description: template === 'it-opening-rounds' ? 'Complete the daily system checks before clinic operations begin.' : template === 'daily-operations' ? 'Record doctor loads, procedures, wellness visits, and confinement movements for the day.' : 'Summarize today’s work, accomplishments, issues, and follow-up actions.', submission: '', link: '', remarks: '' };
            const definition = reportTemplates(config).find(report => report.id === template);
            task.title = definition.name;
            task.description = definition.description;
            task.reportDefinition = structuredClone(definition);
            task.dailyKey = dailyKey(task);
            if (!keys.has(task.dailyKey)) { result.push(task); keys.add(task.dailyKey); changed = true; }
        }
    }
    const opening = reportTemplates(config).find(report => report.id === 'it-opening-rounds' && report.enabled);
    if (opening) for (const branch of config.branches) {
        const key = dailyKey({template:opening.id,branch,scheduledDate:day});
        if (!keys.has(key)) { result.push({id:++id,template:opening.id,title:opening.name,description:opening.description,reportDefinition:structuredClone(opening),assignee:'IT team',sharedBranchReport:true,branch,department:config.itDepartment,due:day,scheduledDate:day,recurrence:'daily',dailyKey:key,status:'Not Started',kind:'Daily task',priority:config.priorities[0],submission:'',link:'',remarks:''}); keys.add(key); }
    }
    const shared = consolidateOpeningReports(result);
    return ensureWeeklyTasks(JSON.stringify(shared) === JSON.stringify(tasks) ? tasks : shared, config, day);
}

export function formatNarrative(report) {
    return `Daily Narrative Report\n\nDate : ${report.date}\nBranch : ${report.branch}\nDepartment : ${report.department}\n\nSUMMARY OF THE DAY\n${report.summary || ''}\n\nACCOMPLISHMENTS\n${report.accomplishments?.trim() || 'None'}\n\nISSUES / CHALLENGES\n${report.issues?.trim() || 'None'}\n\nFOLLOW-UP / NEXT STEPS\n${report.nextSteps?.trim() || 'None'}\n\nHELP NEEDED\n${report.helpNeeded?.trim() || 'None'}`;
}
export function validateNarrative(report, branches, scheduledDate) {
    if (!branches.includes(report.branch)) return 'Choose an allowed work branch.';
    if (report.date !== scheduledDate) return 'Use the scheduled date of this daily task.';
    if (!report.summary?.trim()) return 'Add a summary of the day before submitting.';
    return '';
}
