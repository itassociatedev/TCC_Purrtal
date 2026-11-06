import {useState} from 'react';
import {formatNarrative,validateNarrative} from './dailyTasks.mjs';
import {narrativePeriod,narrativeSummary} from './narrativePeriods.mjs';
export default function NarrativeReport({canEdit=false,task,tasks=[],branches,onDraft,onSubmit,onNotice}){
 const editable=canEdit&&['Not Started','In Progress','Revision Needed'].includes(task.status);
 const period=narrativePeriod(task),heading=period.frequency==='weekly'?'Weekly':period.frequency==='monthly'?'Monthly':'Daily';
 const [report,setReport]=useState(()=>({...task.narrative,date:task.scheduledDate||task.due,branch:task.narrative?.branch||task.branch,department:task.department,issues:task.narrative?.issues||'',solutions:task.narrative?.solutions||'',followUps:task.narrative?.followUps||task.narrative?.nextSteps||''}));
 const [error,setError]=useState('');
 const summary=editable||!task.narrative?narrativeSummary(task,tasks):task.narrative.summary;
 const snapshot=()=>({...report,summary,automaticSummary:true});
 const field=(key,value)=>{setError('');setReport(previous=>({...previous,[key]:value}));};
 return <section className="tm-rounds"><h3>{heading} Narrative Report</h3><p className="tm-daily-caption">{period.start===period.end?period.start:period.start+' – '+period.end}</p><form onSubmit={event=>{event.preventDefault();if(!editable)return;const message=validateNarrative(snapshot(),branches,task.scheduledDate||task.due);if(message){setError(message);return;}onSubmit(snapshot());}}>
 <div className="tm-form-grid"><label>Work branch<select value={report.branch} disabled={!editable} onChange={event=>field('branch',event.target.value)}>{[...new Set([...branches,report.branch])].map(branch=><option key={branch}>{branch}</option>)}</select></label><label>Department<input value={report.department} readOnly/></label></div>
 <h4>Summary <small>(Tasks Completed)</small></h4><p className="tm-daily-caption">Filled automatically from your approved tasks completed during this period.</p><pre className="tm-weekly-summary-text" style={{whiteSpace:'pre-wrap'}}>{summary}</pre>
 {[['issues','Issues / Problems'],['solutions','Solutions'],['followUps','Follow-ups']].map(([key,label])=><label key={key}>{label}<textarea rows={3} value={report[key]} disabled={!editable} onChange={event=>field(key,event.target.value)} placeholder={key==='issues'?'Describe any problems, or enter None.':key==='followUps'?'List what still needs action, or enter None.':'Describe how the problems were resolved, or enter None.'}/></label>)}
 {task.narrative&&(task.narrative.accomplishments||task.narrative.nextSteps||task.narrative.helpNeeded)&&<details><summary>Earlier report details</summary><p>{task.narrative.accomplishments}</p><p>{task.narrative.nextSteps}</p><p>{task.narrative.helpNeeded}</p></details>}
 {error&&<p className="tm-rounds-error" role="alert">{error}</p>}{editable&&<div className="tm-modal-actions"><button type="button" className="tm-secondary" onClick={()=>onDraft(snapshot())}>Save draft</button><button type="submit" className="tm-primary">Submit narrative for review</button></div>}
 </form><details className="tm-rounds-report"><summary>Report preview</summary><pre>{formatNarrative(snapshot(),task)}</pre><button type="button" className="tm-secondary" onClick={async()=>{try{await navigator.clipboard.writeText(formatNarrative(snapshot(),task));onNotice('Report copied.');}catch{onNotice('Select the report text to copy it.');}}}>Copy report</button></details></section>;
}
