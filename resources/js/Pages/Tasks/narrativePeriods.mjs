import {reportTemplates} from './reportTemplates.mjs';
import {weekRange} from './weeklyReports.mjs';
import {assignmentDirectory} from './assignmentDirectory.mjs';
export function narrativePeriod(task){
 const frequency=task.recurrence||'daily';
 const start=task.periodStart||task.weekStart||task.scheduledDate||task.due;
 return {frequency,start,end:task.periodEnd||task.weekEnd||task.scheduledDate||task.due};
}
export function narrativeDateMatches(task,day){const period=narrativePeriod(task);return !day||period.start<=day&&period.end>=day;}
export function narrativeSummary(task,tasks){
 const {start,end}=narrativePeriod(task),seen=new Set();
 const completed=tasks.filter(item=>{
  if(item.id===task.id||seen.has(item.id)||item.assignee!==task.assignee||item.status!=='Completed'||item.sample||item.sampleKey||item.title?.startsWith('[Sample]')||item.template==='narrative-report'||item.template==='intern-weekly-report'||item.template==='it-opening-rounds'||item.template==='daily-operations'||item.template?.startsWith('daily-custom-'))return false;
  const timestamp=item.completedAt||item.approvedAt||item.history?.find(event=>/approved|task completed|main task completed/i.test(event.text||''))?.at;
  if(!timestamp||Number.isNaN(new Date(timestamp).getTime()))return false;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(timestamp)).map(part=>[part.type,part.value]));
  const day=parts.year+'-'+parts.month+'-'+parts.day;
  if(day<start||day>end)return false;
  seen.add(item.id);return true;
 }).sort((a,b)=>a.title.localeCompare(b.title));
 return completed.length?completed.map(item=>'• '+item.title+(item.branch?' ('+item.branch+')':'')).join('\n'):'No completed tasks recorded for this period.';
}
export function ensurePeriodicNarratives(tasks,config,day){
 if(!reportTemplates(config).some(report=>report.id==='narrative-report'&&report.enabled))return tasks;
 let result=tasks,id=Math.max(1000,...tasks.map(task=>Number(task.id)||0));
 const people=[...new Map(assignmentDirectory(config).filter(person=>person.department===config.itDepartment&&person.active!==false&&!person.disabled).map(person=>[person.name,person])).values()];
 const week=weekRange(day),monthEnd=new Date(Date.UTC(Number(day.slice(0,4)),Number(day.slice(5,7)),0)).toISOString().slice(0,10);
 for(const person of people)for(const [frequency,start,end]of [['weekly',week.start,week.end],['monthly',day.slice(0,7)+'-01',monthEnd]]){
  // Reuse an existing weekly report, including the intern form, rather than duplicating it.
  if(result.some(task=>task.assignee===person.name&&(task.template==='narrative-report'||frequency==='weekly'&&task.template==='intern-weekly-report')&&(task.recurrence===frequency||task.template==='intern-weekly-report')&&narrativeDateMatches(task,day)))continue;
  if(result===tasks)result=[...tasks];
  result.push({id:++id,template:'narrative-report',title:(frequency==='weekly'?'Weekly':'Monthly')+' Narrative Report',description:'Review your completed tasks, describe any issues or problems, and record the solutions.',assignee:person.name,assigneeRole:person.role,department:person.department,branch:person.branch,recurrence:frequency,periodStart:start,periodEnd:end,scheduledDate:end,due:end,status:'Not Started',kind:frequency==='weekly'?'Weekly narrative report':'Monthly narrative report',priority:config.priorities[1]||config.priorities[0],submission:'',remarks:''});
 }
 return result;
}

export function narrativeFrequencyMatches(task,frequency){return task.template==='narrative-report'?(task.recurrence||'daily')===frequency:frequency==='weekly'&&task.template==='intern-weekly-report';}
