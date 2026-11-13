import HelpHint from '../../Components/HelpHint.jsx';
import SubmissionStamp from './SubmissionStamp.jsx';
import { useLayoutEffect,useState,useRef } from 'react';

// Keep panels mounted so switching tabs never clears an unsaved submission or follow-up.
export default function TaskDetailLayout({ task, workflow, followUps, history, children,initialVisit={},onVisitChange,restoreVersion=0 }) {
    const hasWorkflow = task.template === 'collaborative' || Boolean(task.parentId);
    const awaiting = (task.pings || []).filter(ping => !ping.acknowledgedAt).length;
    const tabs = ['Overview', ...(hasWorkflow ? ['Workflow'] : []), 'Follow-ups', 'History'];
    const initialTab=tabs.includes(initialVisit.tab)?initialVisit.tab:'Overview';
    const [tab,setTab]=useState(initialTab);
    const [visited,setVisited]=useState(()=>new Set(['Overview',initialTab]));
    const panels=useRef(null);
    useLayoutEffect(()=>{
        setTab(initialTab);
        setVisited(previous=>new Set([...previous,initialTab]));
        if(panels.current)panels.current.scrollTop=initialVisit.scrollTop||0;
    },[restoreVersion]);
    const prefix = `task-detail-${task.id}`;
    const changeTab = value => {
        if(value===tab)return;
        const previous={tab,scrollTop:panels.current?.scrollTop||0};
        setTab(value);
        setVisited(previous => previous.has(value) ? previous : new Set([...previous, value]));
        onVisitChange?.({tab:value,scrollTop:0,previous});
        // Each panel starts at its top; the surrounding dialog header stays visible.
        document.getElementById(prefix)?.scrollTo({ top: 0 });
    };
    return <div className="tm-task-detail-shell">
        <nav className="tm-task-detail-tabs" role="tablist" aria-label="Task sections">{tabs.map(name => <button type="button" id={`${prefix}-tab-${name}`} key={name} role="tab" tabIndex={tab === name ? 0 : -1} onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const index = tabs.indexOf(name); const next = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]; changeTab(next); document.getElementById(`${prefix}-tab-${next}`)?.focus(); }} aria-selected={tab === name} aria-controls={`${prefix}-${name}`} onClick={() => changeTab(name)}>{name}{name === 'Follow-ups' && awaiting > 0 && <span>{awaiting}</span>}{name === 'History' && task.history?.length > 0 && <span>{task.history.length}</span>}</button>)}</nav>
        <div className="tm-task-detail-panels" id={prefix} ref={panels} onScroll={event=>onVisitChange?.({tab,scrollTop:event.currentTarget.scrollTop})}>
            <div className="tm-task-details" role="tabpanel" id={`${prefix}-Overview`} aria-labelledby={`${prefix}-tab-Overview`} hidden={tab !== 'Overview'}><HelpHint label="Task status and timing help">Pending Approval means the request needs approval before work can start. Pending Review means the owner has submitted work for checking. Revision Needed means the reviewer returned it. Read the feedback, correct the output and submit again.</HelpHint><SubmissionStamp task={task} label="Latest submission ·"/>{children}</div>
            {hasWorkflow && <div className="tm-task-details" role="tabpanel" id={`${prefix}-Workflow`} aria-labelledby={`${prefix}-tab-Workflow`} hidden={tab !== 'Workflow'}>{visited.has('Workflow') && workflow}</div>}
            <div className="tm-task-details" role="tabpanel" id={`${prefix}-Follow-ups`} aria-labelledby={`${prefix}-tab-Follow-ups`} hidden={tab !== 'Follow-ups'}><HelpHint label="Follow-up help">Select Acknowledge after reading a reminder. Submit your completed work from the Overview tab.</HelpHint>{visited.has('Follow-ups') && followUps}</div>
            <div className="tm-task-details" role="tabpanel" id={`${prefix}-History`} aria-labelledby={`${prefix}-tab-History`} hidden={tab !== 'History'}>{visited.has('History') && history}</div>
        </div>
    </div>;
}
