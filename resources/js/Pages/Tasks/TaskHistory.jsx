import PagedList from './PagedList.jsx';
// Format saved activity without burying the current task beneath the full history.
export default function TaskHistory({ task }) {
    return <section className="tm-task-history tm-task-history-tab"><div className="tm-section-heading"><h3>Task history</h3><span>{task.history?.length || 0} {task.history?.length === 1 ? 'update' : 'updates'}</span></div>{task.history?.length ? <PagedList items={task.history} label="updates" initialSize={5}>{items => <ol>{items.map((event, index) => <li key={`${event.at}-${index}`}><p>{event.text}</p><time dateTime={event.at}>{new Date(event.at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></li>)}</ol>}</PagedList> : <p>No changes recorded yet.</p>}</section>;
}
