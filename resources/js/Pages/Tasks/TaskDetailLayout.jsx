import { useState } from 'react';

// Keep panels mounted so switching tabs never clears an unsaved submission or follow-up.
export default function TaskDetailLayout({ task, workflow, followUps, history, children }) {
    const [tab, setTab] = useState('Overview');
    const [visited, setVisited] = useState(() => new Set(['Overview']));
    const hasWorkflow = task.template === 'collaborative' || Boolean(task.parentId);
    const awaiting = (task.pings || []).filter(ping => !ping.acknowledgedAt).length;
    const tabs = ['Overview', ...(hasWorkflow ? ['Workflow'] : []), 'Follow-ups', 'History'];
    const prefix = `task-detail-${task.id}`;
    const changeTab = value => {
        setTab(value);
        setVisited(previous => previous.has(value) ? previous : new Set([...previous, value]));
        // Each panel starts at its top; the surrounding dialog header stays visible.
        document.getElementById(prefix)?.scrollTo({ top: 0 });
    };
    return <div className="tm-task-detail-shell">
        <nav className="tm-task-detail-tabs" role="tablist" aria-label="Task sections">{tabs.map(name => <button type="button" id={`${prefix}-tab-${name}`} key={name} role="tab" tabIndex={tab === name ? 0 : -1} onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const index = tabs.indexOf(name); const next = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]; changeTab(next); document.getElementById(`${prefix}-tab-${next}`)?.focus(); }} aria-selected={tab === name} aria-controls={`${prefix}-${name}`} onClick={() => changeTab(name)}>{name}{name === 'Follow-ups' && awaiting > 0 && <span>{awaiting}</span>}{name === 'History' && task.history?.length > 0 && <span>{task.history.length}</span>}</button>)}</nav>
        <div className="tm-task-detail-panels" id={prefix}>
            <div className="tm-task-details" role="tabpanel" id={`${prefix}-Overview`} aria-labelledby={`${prefix}-tab-Overview`} hidden={tab !== 'Overview'}>{children}</div>
            {hasWorkflow && <div className="tm-task-details" role="tabpanel" id={`${prefix}-Workflow`} aria-labelledby={`${prefix}-tab-Workflow`} hidden={tab !== 'Workflow'}>{visited.has('Workflow') && workflow}</div>}
            <div className="tm-task-details" role="tabpanel" id={`${prefix}-Follow-ups`} aria-labelledby={`${prefix}-tab-Follow-ups`} hidden={tab !== 'Follow-ups'}>{visited.has('Follow-ups') && followUps}</div>
            <div className="tm-task-details" role="tabpanel" id={`${prefix}-History`} aria-labelledby={`${prefix}-tab-History`} hidden={tab !== 'History'}>{visited.has('History') && history}</div>
        </div>
    </div>;
}
