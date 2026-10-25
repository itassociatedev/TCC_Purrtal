// Show essential facts first; secondary scheduling details can be expanded when needed.
export default function TaskOverview({ task, badges, assignee, schedule, deadline, actions }) {
    return <section className="tm-task-overview tm-task-overview-compact">
        <div className="tm-task-overview-heading"><div className="tm-detail-badges">{badges}</div>{actions}</div>
        <dl className="tm-task-meta-grid tm-task-key-facts">
            <div><dt>Assigned to</dt><dd>{assignee}</dd></div>
            {task.startDate && <div><dt>Starting date</dt><dd><time dateTime={task.startDate}>{new Date(task.startDate+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</time></dd></div>}<div><dt>Deadline</dt><dd><time dateTime={task.due}>{deadline}</time></dd></div>
        </dl>
        <div className="tm-task-location"><span>{task.department}</span><span>{task.branch}</span></div>
        <div className="tm-task-description"><h3>Description</h3><p>{task.description || 'No description provided.'}</p></div>
        <details className="tm-task-extra-details"><summary>More details</summary><dl className="tm-task-meta-grid"><div><dt>Schedule</dt><dd>{schedule}</dd></div><div><dt>Task type</dt><dd>{task.kind}</dd></div></dl></details>
    </section>;
}
