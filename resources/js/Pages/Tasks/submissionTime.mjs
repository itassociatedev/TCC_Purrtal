export function submissionTimestamp(task){
 const valid=value=>typeof value==='string' && !Number.isNaN(new Date(value).getTime());
 if(valid(task.submittedAt))return task.submittedAt;
 return (task.history||[]).filter(event=>/submitted for review|report submitted|work submitted|main task completed/i.test(event.text||'')).map(event=>event.at).filter(valid).sort((a,b)=>new Date(b)-new Date(a))[0]||'';
}
export function formatSubmissionTime(value){
 if(!value||Number.isNaN(new Date(value).getTime()))return '';
 return new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(value));
}
