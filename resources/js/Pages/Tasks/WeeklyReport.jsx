import { useState } from 'react';
import PagedList from './PagedList.jsx';
import { accomplishedThisWeek, formatWeeklyReport, weeklySummary } from './weeklyReports.mjs';

// Saved submissions snapshot accomplishments; editable drafts refresh the completed-task list at save time.
export default function WeeklyReport({ task, tasks, canEdit, onDraft, onSubmit }) {
    const [report, setReport] = useState(() => ({ summary: '', accomplishments: [], ...task.weeklyReport, problems: task.weeklyReport?.problems ?? task.weeklyReport?.challenges ?? '', solutions: task.weeklyReport?.solutions ?? '' }));
    const [error, setError] = useState('');
    // Manual additions survive refreshes and revisions; automatic mode keeps following completed tasks.
    const [summaryEdited, setSummaryEdited] = useState(() => task.weeklyReport?.summaryEdited ?? Boolean(task.weeklyReport?.summary?.trim()));
    const [editingSummary, setEditingSummary] = useState(false);
    const accomplishments = canEdit || !task.weeklyReport ? accomplishedThisWeek(tasks, task.assignee, task.weekStart, task.weekEnd).map(item => ({ id: item.id, title: item.title, branch: item.branch })) : report.accomplishments;
    const summary = !canEdit && task.weeklyReport ? report.summary : summaryEdited ? report.summary : weeklySummary(task, accomplishments);
    const snapshot = () => ({ ...report, summary, summaryEdited, accomplishments });
    return <section className="tm-rounds"><h3>Intern Weekly Report</h3><p>{task.weekStart} – {task.weekEnd} · Due Friday</p>
        <form onSubmit={event => { event.preventDefault(); if (!canEdit) return; if (!summary.trim()) return setError('Add your weekly summary before submitting.'); onSubmit(snapshot()); }}>
            <div className="tm-weekly-summary-heading"><h4>Summary of Tasks</h4>{canEdit && <div className="tm-setup-row-actions"><button type="button" className="tm-secondary" onClick={() => { if (!editingSummary) { setReport(previous => ({ ...previous, summary })); setSummaryEdited(true); } setEditingSummary(!editingSummary); }}>{editingSummary ? 'Finish editing' : 'Edit'}</button>{summaryEdited && <button type="button" className="tm-text-button" onClick={() => { setSummaryEdited(false); setEditingSummary(false); setError(''); }}>Use automatic summary</button>}</div>}</div>
            {editingSummary && canEdit ? <label>Summary of Tasks<textarea autoFocus rows={7} value={summary} onChange={event => { setError(''); setReport({ ...report, summary: event.target.value }); setSummaryEdited(true); }} /></label> : summaryEdited ? <div className="tm-weekly-summary-text">{summary}</div> : <><p className="tm-daily-caption">{accomplishments.length} completed tasks this week</p><PagedList items={accomplishments} label="tasks">{items => <ul className="tm-weekly-task-list">{items.map(item => <li key={item.id}>{item.title} · {item.branch}</li>)}</ul>}</PagedList>{!accomplishments.length && <p>No completed tasks recorded for this week.</p>}</>}
            {[['problems', 'Problems / Issues'], ['solutions', 'Solutions']].map(([key, label]) => <label key={key}>{label}{canEdit ? <textarea rows={3} value={report[key]} placeholder="Lorem ipsum…" onChange={event => { setError(''); setReport({ ...report, [key]: event.target.value }); }} /> : <p className="tm-weekly-summary-text">{report[key]?.trim() || 'None'}</p>}</label>)}
            {error && <p className="tm-rounds-error" role="alert">{error}</p>}{canEdit && <div className="tm-modal-actions"><button type="button" className="tm-secondary" onClick={() => onDraft(snapshot())}>Save draft</button><button className="tm-primary">Submit weekly report for review</button></div>}
        </form><details className="tm-rounds-report"><summary>Weekly report preview</summary><pre>{formatWeeklyReport(task, snapshot())}</pre></details></section>;
}
