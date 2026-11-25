export const serverTaskIdentity = task => task.repeatSeriesId&&task.occurrenceStart?`repeat:${task.repeatSeriesId}:${task.occurrenceStart}`: task.template==='narrative-report'&&['weekly','monthly'].includes(task.recurrence)?`narrative:${task.recurrence}:${task.assignee}:${task.periodStart}`:task.recurrence === 'daily'
 ? `daily:${task.template}:${task.sharedBranchReport?task.branch:task.assignee}:${task.scheduledDate||task.due}`
 : task.template === 'intern-weekly-report' ? `weekly:${task.assignee}:${task.weekStart||task.due}` : `task:${task.id}`;
export const isEmailSample = task => Boolean(task.sample||task.sampleKey||String(task.title||'').startsWith('[Sample]'));
export function mergeServerTasks(local,records) {
 const deleted=new Set(records.filter(task=>task._deleted).map(task=>task._serverKey));
 const incoming=new Map(records.filter(task=>!task._deleted).map(task=>[serverTaskIdentity(task),task]));
 const merged=local.filter(task=>!deleted.has(task._serverKey)).map(task=>{const key=serverTaskIdentity(task),replacement=incoming.get(key);incoming.delete(key);return replacement&&!(task._serverKey===replacement._serverKey&&Number(task._serverVersion)>Number(replacement._serverVersion))?replacement:task;});
 return [...merged,...incoming.values()];
}
