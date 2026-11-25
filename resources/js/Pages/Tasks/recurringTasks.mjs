export const taskFrequencyLabel=value=>({daily:'Daily',weekly:'Weekly',monthly:'Monthly'}[value]||'One-time');
export function repeatDate(anchor,frequency,offset){
 const date=new Date(anchor+'T00:00:00Z');
 if(frequency==='monthly'){const day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+offset);const end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,end));}
 else date.setUTCDate(date.getUTCDate()+offset*(frequency==='weekly'?7:1));
 return date.toISOString().slice(0,10);
}
export function ensureRecurringTasks(tasks,day){
 const groups=new Map();for(const task of tasks){if(task.template!=='standard'||task.parentId||!task.frequency)continue;const id=task.repeatSeriesId||task.id;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(task);}
 let result=tasks,id=Math.max(Date.now(),...tasks.map(task=>Number(task.id)||0));
 for(const [series,records]of groups){
  const root=tasks.find(task=>task.id===series);if(!root||root._serverKey)continue;
  const source=[...records].sort((a,b)=>String(b.frequencyChangedAt||'').localeCompare(a.frequencyChangedAt||'')||String(b.startDate||b.due).localeCompare(a.startDate||a.due))[0];
  if(!['daily','weekly','monthly'].includes(source.frequency)||['Denied','Dismissed','Pending Approval'].includes(source.status))continue;
  const anchor=source.repeatAnchorStart||source.startDate||source.due,due=source.repeatAnchorDue||source.due;
  if(!anchor||anchor>day)continue;
  const cutoff=source.frequencyChangedAt?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(source.frequencyChangedAt)):anchor;
  const known=new Set(records.map(task=>task.occurrenceStart||task.startDate||task.due));
  const date=new Date(anchor+'T00:00:00Z'),now=new Date(cutoff+'T00:00:00Z');
  let offset=source.frequency==='monthly'?Math.max(1,(now.getUTCFullYear()-date.getUTCFullYear())*12+now.getUTCMonth()-date.getUTCMonth()):Math.max(1,Math.floor((new Date(cutoff+'T00:00:00Z')-date)/86400000/(source.frequency==='weekly'?7:1)));
  let created=0;
  for(;created<100;offset++){
   const start=repeatDate(anchor,source.frequency,offset);if(start>day)break;if(start<cutoff||known.has(start))continue;
   const copy={...source, ...(source.recurrenceOwner?{assignee:source.recurrenceOwner.name,assigneeRole:source.recurrenceOwner.role,department:source.recurrenceOwner.department||source.department}:{}),id:++id,repeatSeriesId:series,repeatAnchorStart:anchor,repeatAnchorDue:due,occurrenceStart:start,startDate:start,due:repeatDeadline(anchor,due,source.frequency,offset),status:source.kind==='Self-created request'||source.kind==='Turnover request'?'Pending Approval':'Not Started',submission:'',remarks:'',pings:[],history:[{text:'Recurring task created.',at:new Date().toISOString()}]};
   for(const field of ['handover','handoverWork','recurrenceOwner','procedureReference','_serverKey','_serverVersion','startedAt','submittedAt','submittedBy','completedAt','elapsedSeconds','approvalGrantedAt','approvalGrantedBy','previousSubmission','correcting'])delete copy[field];
   if(result===tasks)result=[...tasks];result.push(copy);known.add(start);created++;
  }
 }
 return result;
}

export function suggestedTaskDeadline(start,frequency){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start||''))return '';
 const date=new Date((frequency==='monthly'?repeatDate(start,'monthly',1):start)+'T00:00:00Z');
 date.setUTCDate(date.getUTCDate()+(frequency==='weekly'?6:frequency==='monthly'?-1:0));
 return date.toISOString().slice(0,10);
}

export function repeatDeadline(anchor,deadline,frequency,offset){
 if(frequency==='monthly'&&deadline===suggestedTaskDeadline(anchor,'monthly')){
  const date=new Date(repeatDate(anchor,'monthly',offset+1)+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-1);return date.toISOString().slice(0,10);
 }
 return repeatDate(deadline,frequency,offset);
}
