import ChildTaskForm from './ChildTaskForm.jsx';
import { useState } from 'react';
import { canDelegate, childTasks, dependencyBlockers, isCollaborativeTask, taskHierarchy, canCompleteMainTask } from './collaborativeTasks.mjs';
import PagedList from './PagedList.jsx';

// A coordinator delegates across departments; prerequisite and child approvals gate final submission.
export default function CollaborativeTasks({ task, tasks, config, context, onCreate, onOpen, onReopen, onComplete }) {
    const [adding, setAdding] = useState(false);
    const [finalSubmission,setFinalSubmission]=useState(task.submission || '');
    const [showAll, setShowAll] = useState(false);
    const parent = tasks.find(item => item.id === task.parentId);
    const children = childTasks(task, tasks);
    const hierarchy = taskHierarchy(task, tasks);
    const blockers = dependencyBlockers(task, tasks);
    if (!isCollaborativeTask(task) && !task.parentId) return null;
    const assignments = showAll ? hierarchy : hierarchy.filter(row => row.depth === 0);
    const ancestors = [];
    let cursor = parent;
    const visited = new Set([task.id]);
    while (cursor && !visited.has(cursor.id)) { ancestors.unshift(cursor); visited.add(cursor.id); cursor = tasks.find(item => item.id === cursor.parentId); }
    const approved = hierarchy.filter(row => row.task.status === 'Completed').length;
    const ready = canCompleteMainTask(task, tasks, context);
    const formatDate = value => new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const statusClass = status => status === 'Completed' ? 'approved' : status === 'Denied' ? 'denied' : status === 'Pending Review' ? 'review' : 'pending';
    return <section className="tm-collaboration">
        <header className="tm-collab-header">
            <div><span className="tm-collab-eyebrow">Collaborative workflow</span><h3>{isCollaborativeTask(task) ? task.parentId ? 'Monitoring assignment' : 'Main deliverable' : 'Execution assignment'}</h3></div>
            <span className={`tm-collab-status ${statusClass(task.status)}`}>{task.status === 'Completed' ? '✓ Approved' : task.status}</span>
        </header>
        {ancestors.length > 0 && <nav className="tm-workflow-breadcrumb" aria-label="Task path">{ancestors.map(item => <span key={item.id}><button type="button" onClick={() => onOpen(item)}>{item.title}</button><span aria-hidden="true">›</span></span>)}<strong aria-current="page">Current task</strong></nav>}
        <div className="tm-collab-context">
            {task.requestedBy && <div><span>Requested by</span><strong>{task.requestedBy}</strong></div>}
            {parent && <div><span>Parent task</span><button type="button" onClick={() => onOpen(parent)}>{parent.title}</button><small>Coordinator: {parent.assignee}</small></div>}
        </div>
        {isCollaborativeTask(task) ? <>
            <div className="tm-collab-progress">
                <div><strong>{approved} of {hierarchy.length} approved</strong><span>{ready ? 'Ready for final completion' : hierarchy.length ? 'All child tasks must be approved before this task can be submitted.' : 'Add child tasks to distribute the work.'}</span></div>
                <div className="tm-collab-track" role="progressbar" aria-label="Child task approvals" aria-valuemin={0} aria-valuemax={Math.max(1, hierarchy.length)} aria-valuenow={approved}><span style={{ width: `${hierarchy.length ? approved / hierarchy.length * 100 : 0}%` }} /></div>
            </div>
            <div className="tm-collab-section-title"><h4>Tasks under this assignment</h4><span>{children.length} direct · {hierarchy.length} total</span></div>
            {hierarchy.length > children.length && <div className="tm-workflow-list-toggle" role="group" aria-label="Task hierarchy detail"><button type="button" className={!showAll ? 'active' : ''} aria-pressed={!showAll} onClick={() => setShowAll(false)}>Direct tasks</button><button type="button" className={showAll ? 'active' : ''} aria-pressed={showAll} onClick={() => setShowAll(true)}>All levels</button></div>}
            {/* Separate block elements prevent titles, names and deadlines from running together. */}
            <PagedList items={assignments} resetKey={String(showAll)} label="child tasks" initialSize={5}>{items => <div className="tm-child-list">
                {!items.length && <div className="tm-workflow-empty"><strong>Split the work into smaller assignments</strong><p>Add a task for each person. Choose who does the work and who coordinates another level.</p></div>}
                {items.map(({ task: child, depth }) => <div className="tm-child-row" key={child.id} style={{ '--task-depth': Math.min(depth, 3) }}>
                    <button type="button" className="tm-child-card" onClick={() => onOpen(child)} aria-label={`Open ${child.title}`}>
                        <span className="tm-child-card-top"><span className="tm-hierarchy-level">Level {ancestors.length + depth + 2} · {child.template === 'collaborative' ? 'Coordinates others' : 'Does the work'}</span><span className={`tm-collab-status ${statusClass(child.status)}`}>{child.status === 'Completed' ? '✓ Approved' : child.status}</span></span>
                        <strong className="tm-child-title">{child.title}</strong>
                        <span className="tm-child-owner">{child.assignee} · {child.assigneeRole || child.department}</span><span className="tm-child-parent-label">Reports to {tasks.find(item => item.id === child.parentId)?.assignee || task.assignee}</span>
                        <span className="tm-child-card-footer"><span>{child.department} · {child.branch}</span><span>Due {formatDate(child.due)}</span></span>
                        {dependencyBlockers(child, tasks).length > 0 && <span className="tm-child-blocked">Waiting for required work</span>}
                    </button>
                    {child.status === 'Denied' && child.parentId === task.id && child.assignee !== task.assignee && canDelegate(task, context) && <button type="button" className="tm-text-button" onClick={() => onReopen(child)}>Return for revision</button>}
                </div>)}
            </div>}</PagedList>
        </> : <p>{blockers.length ? `Waiting for: ${blockers.map(item => item.title).join(', ')}` : 'Prerequisites cleared. You can work on this task.'}</p>}
        <div className="tm-workflow-next"><strong>Your next step</strong><p>{ready ? 'All work is approved. You can complete the main task.' : ['Completed', 'Denied'].includes(task.status) ? 'This assignment is closed. You can still view the work and history.' : task.status === 'Pending Review' ? 'Your submission is waiting for review.' : canDelegate(task, context) ? blockers.length ? 'Add assignments or follow up on unfinished work. Submit your result after every task below is approved.' : 'The work below is approved. Submit your result for review.' : `This assignment belongs to ${task.assignee}. They complete or delegate the work, then submit it for review.`}</p></div>
        <div className="tm-collab-actions">
            {canDelegate(task, context) && <button type="button" className="tm-secondary" aria-expanded={adding} onClick={() => setAdding(!adding)}>{adding ? 'Close assignment form' : '+ Add a task'}</button>}
            {ready && <form className="tm-final-submission" onSubmit={event=>{event.preventDefault();if(finalSubmission.trim())onComplete(finalSubmission.trim());}}><label>Final output or submission link<textarea required rows={3} value={finalSubmission} onChange={event=>setFinalSubmission(event.target.value)} placeholder="Describe the final result or paste its link…"/></label><button type="submit" className="tm-primary">Submit & complete main task</button></form>}
        </div>
        {!isCollaborativeTask(task) && canDelegate(task, context) && <p className="tm-daily-caption">Adding a child turns this assignment into a monitoring task.</p>}
        {task.parentId && !canDelegate(task, context) && !['Completed', 'Denied', 'Pending Review'].includes(task.status) && <p className="tm-daily-caption">To delegate further, open this assignment as {task.assignee}.</p>}
        {adding && canDelegate(task, context) && <ChildTaskForm task={task} children={children} config={config} onCreate={onCreate} onClose={() => setAdding(false)} />}
    </section>;
}
