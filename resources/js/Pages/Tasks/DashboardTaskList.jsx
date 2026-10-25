import OpeningWarning from './OpeningWarning.jsx';
// Dashboard previews use wrapping rows instead of squeezing full-width tables into cards.
export default function DashboardTaskList({ tasks, onOpen, prettyDate, badge, showAssignee }) {
    if (!tasks.length) return <div className="tm-dashboard-empty"><strong>No active tasks</strong><p>New assignments will appear here.</p></div>;
    return <div className="tm-dashboard-task-list">{tasks.slice(0, 3).map(task => <button type="button" key={task.id} className="tm-dashboard-task-row" onClick={() => onOpen(task)}>
        <div className="tm-dashboard-task-main"><strong>{task.title}</strong><OpeningWarning task={task}/><span>{showAssignee ? `${task.assignee} · ` : ''}{task.department} · {task.branch}</span></div>
        <div className="tm-dashboard-task-tags">{badge(task.priority)}{badge(task.status)}<time dateTime={task.due}><span>Due </span>{prettyDate(task.due)}</time></div>
    </button>)}</div>;
}
