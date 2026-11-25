import { useState } from 'react';
import { canPingTask, canAcknowledgePing } from './taskPings.mjs';
import PagedList from './PagedList.jsx';

// Acknowledgement records receipt only; it never completes or submits the task.
export default function TaskPings({ task, context, onSend, onAcknowledge }) {
    const [message, setMessage] = useState('Please provide an update on this task and acknowledge this follow-up.');
    const [error, setError] = useState('');
    const pings = [...(task.pings || [])].reverse();
    const canSend = canPingTask(task, context);
    if (!canSend && !pings.length) return <div className="tm-followups-empty"><h3>No follow-ups yet</h3><p>Follow-up requests and acknowledgements for this task will appear here.</p></div>;
    const pending = pings.filter(ping => !ping.acknowledgedAt && ping.assignee === task.assignee).length;
    const time = date => new Date(date).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return <section className="tm-task-pings"><div className="tm-weekly-summary-heading"><h3>Follow-ups & acknowledgement</h3>{pending > 0 && <span className="tm-ping-pending">{pending} awaiting acknowledgement</span>}</div>
        {canSend && <details open={pings.length === 0}><summary>Send a follow-up</summary><form onSubmit={event => { event.preventDefault(); try { onSend(message); setError(''); } catch (err) { setError(err.message); } }}><label>Follow-up message<textarea value={message} maxLength={500} required rows={3} onChange={event => setMessage(event.target.value)} /></label><p className="tm-daily-caption">{task.assignee} will receive a notification and be asked to acknowledge. This does not change the task’s status.</p>{error && <p role="alert" className="tm-rounds-error">{error}</p>}<button className="tm-primary">Send ping & request acknowledgement</button></form></details>}
        <PagedList items={pings} initialSize={5} label="follow-ups">{items => <div className="tm-ping-list">{items.map(ping => <article key={ping.id}><div className="tm-ping-meta"><strong>{ping.sender} · {ping.senderRole}</strong><span className={ping.acknowledgedAt ? 'tm-ping-acknowledged' : 'tm-ping-pending'}>{ping.acknowledgedAt ? 'Acknowledged' : 'Awaiting acknowledgement'}</span></div><p>{ping.message}</p><small>To {ping.assignee} · {time(ping.createdAt)}</small>{ping.acknowledgedAt && <small>Acknowledged by {ping.acknowledgedBy} · {time(ping.acknowledgedAt)}</small>}{canAcknowledgePing(task, ping, context) && <button className="tm-primary" type="button" onClick={() => onAcknowledge(ping.id)}>Acknowledge</button>}</article>)}</div>}</PagedList>
    </section>;
}
