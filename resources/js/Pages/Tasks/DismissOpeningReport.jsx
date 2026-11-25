export default function DismissOpeningReport({task,allowed,onDismiss}) {
 if(task.status==='Dismissed') return <div className="tm-form-note"><strong>Dismissed for this day</strong><p>Dismissed by {task.dismissedBy}. The next day’s report is unaffected.</p></div>;
 if(!allowed)return null;
 return <div className="tm-dismiss-opening"><div><strong>No IT staff at this branch today?</strong><p>Skip this branch’s Opening Report for today.</p></div><button className="tm-secondary" type="button" onClick={onDismiss}>Dismiss for today</button></div>;
}
