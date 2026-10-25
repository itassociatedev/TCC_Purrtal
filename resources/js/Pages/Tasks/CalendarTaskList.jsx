import PagedList from './PagedList.jsx';

// Cards fit the dialog width, keeping status and actions visible even on smaller screens.
export default function CalendarTaskList({ tasks, onOpen, renderStatus, renderPriority, overdue }) {
    return <PagedList items={tasks} label="tasks">{items => <div className="tm-calendar-task-cards">{items.map(task => <article key={task.id} className="tm-calendar-task-card"><div className="tm-calendar-task-card-heading"><h3><button type="button" onClick={() => onOpen(task)}>{task.title}</button></h3><button type="button" className="tm-secondary" onClick={() => onOpen(task)}>View details</button></div><p>{task.kind} · {task.department} · {task.branch}</p><dl><div><dt>Due date</dt><dd className={overdue(task) ? 'tm-late-text' : ''}>{task.due}{overdue(task) ? ' · Overdue' : ''}</dd></div><div><dt>Priority</dt><dd>{renderPriority(task)}</dd></div><div><dt>Status</dt><dd>{renderStatus(task)}</dd></div></dl></article>)}{!items.length && <p>No tasks due for this employee on this date.</p>}</div>}</PagedList>;
}
