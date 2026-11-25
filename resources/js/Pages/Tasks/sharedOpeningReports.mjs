export const isSharedOpening = task => task.template === 'it-opening-rounds' && task.sharedBranchReport;
export function consolidateOpeningReports(tasks) {
    const groups = new Map();
    for (const task of tasks) {
        if (task.template !== 'it-opening-rounds') continue;
        const key = `${task.branch}:${task.scheduledDate || task.due}`;
        const group = groups.get(key) || [];
        group.push(task);
        groups.set(key, group);
    }
    const replacements = new Map();
    for (const group of groups.values()) {
        const rank = task => task.submission ? 3 : task.rounds ? 2 : task.sharedBranchReport ? 1 : 0;
        const ordered = [...group].sort((a,b) => rank(b) - rank(a) || Number(a.id) - Number(b.id));
        const winner = ordered[0];
        for (const task of group) {
            // Keep prior independent submissions available for audit, without requiring duplicate work.
            if (task.id !== winner.id) {
                if (task.submission || task.rounds) replacements.set(task.id, {...task, supersededOpeningReport: true});
                else replacements.set(task.id, null);
                continue;
            }
            const automaticCompletion = task.status === 'Completed' && task.history?.some(event => /^Opening Report completed by /.test(event.text || '')) && !task.history?.some(event => /: approved\.$/.test(event.text || ''));
            const submittedBy = task.submittedBy || (task.submission && task.assignee !== 'IT team' ? task.assignee : null);
            replacements.set(task.id, {...task, sharedBranchReport:true, assignee:'IT team',
                dailyKey:`it-opening-rounds:${encodeURIComponent(task.branch)}:${task.scheduledDate || task.due}`,
                ...(submittedBy ? {submittedBy} : {}),
                ...(task.submission && (automaticCompletion || !['Completed','Denied','Dismissed','Revision Needed'].includes(task.status)) ? {status:'Pending Review', ...(automaticCompletion ? {completedAt:undefined} : {})} : {})});
        }
    }
    return tasks.flatMap(task => replacements.has(task.id) ? replacements.get(task.id) ? [replacements.get(task.id)] : [] : [task]);
}
