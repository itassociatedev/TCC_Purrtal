import {downloadCsv} from '../../Utils/csv.mjs';
const points=n=>(Number(n||0)/1000000).toFixed(2);
export default function TaskScoreBreakdown({row,onClose,demo=false}) {
 const entries=row.scoreEntries||[];
 const exportRows=()=>downloadCsv(demo?'DEMO-task-scores.xlsx':'task-scores.xlsx',['task_id','title','priority','deadline','submission_time','criterion_unit','time_score','priority_score','returns','return_deduction','returns_score','legacy_ownership_score','final_task_points','person_points','settings_version','status','allocations','submission_history','return_history','handover_history'],entries.map(({task,scoring:s,awardedUnits})=>[task.taskCode||task.id,task.title,s.priority||task.priority,task.due,s.submission_at||'',s.scoring_model==='points_10'?'points':'percent',s.scores?.time??'',s.scores?.priority??'',s.return_count??'',s.return_deduction??'',s.scores?.returns??'',s.scores?.ownership??'',points(s.earned_units),points(awardedUnits),s.policy_version||'',s.reason||'Scored',JSON.stringify(s.allocations||[]),JSON.stringify(s.submissions||[]),JSON.stringify(s.returns||[]),JSON.stringify(s.transfers||[])]));
 // Present saved scores only: the breakdown never recalculates historical awards.
 const dateLabel = value => {
   if (!value) return 'Not recorded';
   const date = new Date(value);
   return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-PH', {timeZone:'Asia/Manila', dateStyle:'medium', timeStyle:'short'});
 };
 const labels = {time:'Time Completion', priority:'Priority Level', returns:'Errors or Returns', ownership:'Ownership'};
 return <div className="tm-overdue-dialog-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
   <section className="tm-overdue-dialog tm-score-dialog" role="dialog" aria-modal="true" aria-labelledby="task-score-title" onKeyDown={e=>e.key==='Escape'&&onClose()}>
     <header><div><h2 id="task-score-title">{demo?'DEMO · ':''}Score Breakdown</h2><p>{row.name}</p></div><button autoFocus type="button" aria-label="Close score breakdown" onClick={onClose}>×</button></header>
     <div className="tm-score-overview">
       <div><span>Leaderboard Points</span><strong>{points(row.pointUnits)}</strong></div>
       <div><span>Completed Tasks</span><strong>{row.completed}</strong></div>
       <button type="button" className="tm-secondary" onClick={exportRows}>Export Breakdown</button>
     </div>
     <p className="tm-score-note">Only eligible, approved completions earn points. Each task below shows how its saved score was calculated and who received it.</p>
     {entries.map(({task,scoring:s,awardedUnits})=>{
       const raw = s.scoring_model==='points_10';
       return <article className="tm-task-score" key={task.id}>
         <div className="tm-score-task-heading"><div><span className="tm-score-task-code">{task.taskCode||task.id}</span><h3>{task.title}</h3></div><div className="tm-score-award"><span>Points for {row.name}</span><strong>{points(awardedUnits)}</strong></div></div>
         {!s.eligible&&<p className="tm-score-note">No points awarded: {(s.reason||'incomplete_records').replaceAll('_',' ')}.</p>}
         <dl className="tm-score-context">
           <div><dt>Priority</dt><dd>{s.priority||task.priority}</dd></div>
           <div><dt>Deadline · end of day</dt><dd>{task.due||'Not recorded'}</dd></div>
           <div><dt>Successful Submission</dt><dd>{dateLabel(s.submission_at)}</dd></div>
         </dl>
         <h4>How the Score Adds Up</h4>
         <dl className="tm-score-metrics">{Object.entries(s.scores||{}).map(([key,value])=><div key={key}><dt>{labels[key]||key}</dt><dd>{Number(value).toFixed(2)}<small>{raw?' points':'%'}</small></dd></div>)}</dl>
         <p className="tm-score-return-note">Formal returns: <strong>{s.return_count??'Not recorded'}</strong> · Return deduction: <strong>{s.return_deduction??'Not recorded'}{raw?' points':'%'}</strong>. This deduction is already included in the Errors or Returns score.</p>
         <div className="tm-score-total"><span>Total Earned by This Task</span><strong>{points(s.earned_units)} points</strong></div>
         <h4>Who Receives the Points?</h4>
         <p className="tm-score-note">{s.allocation_mode==='final_completer'?'The final completing assignee receives all earned points.':'Shares follow the scoring policy saved for this task.'}</p>
         <ul className="tm-score-allocations">{(s.allocations||[]).map(a=><li key={a.id}><span>{a.name}<small>{(a.units/10000).toFixed(2)}% share</small></span><strong>{points(a.awarded_units)} points</strong></li>)}</ul>
         <details><summary>View Submission and Handover History</summary>
           <p className="tm-score-note">Scoring policy: {s.policy_version||'Not recorded'} · {raw?'10-point rubric':'Historical percentage rubric'}. Displayed points are rounded to two decimal places.</p>
           <ul>{(s.submissions||[]).map((submission,i)=><li key={'s'+i}><strong>{i===0?'Original submission':'Resubmission'}</strong>: {dateLabel(submission.at)} · Employee ID {submission.actor_id}</li>)}{(s.returns||[]).map((r,i)=><li key={'r'+i}><strong>Returned for revision</strong>: {dateLabel(r.at)} · Reviewer ID {r.actor_id}</li>)}{(s.transfers||[]).map((t,i)=><li key={'t'+i}><strong>{t.from.name} → {t.to.name}</strong> · accepted {dateLabel(t.at)} · {t.allocation_mode==='final_completer'?'Final completer receives all points':`${t.percent}% handover pool when reserved`}</li>)}</ul>
           {!(s.submissions?.length||s.returns?.length||s.transfers?.length)&&<p>No activity history recorded.</p>}
           {(s.review_flags||[]).map((flag,i)=><p role="status" key={i}>{flag}</p>)}
         </details>
       </article>;
     })}
     {!entries.length&&<p>No completed task score records in this view.</p>}
     <footer><button type="button" className="tm-secondary" onClick={onClose}>Close</button></footer>
   </section>
 </div>;
}