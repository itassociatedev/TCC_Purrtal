import { useState } from 'react';
import PagedList from './PagedList.jsx';
import { accomplishedThisWeek, formatWeeklyReport, weeklySummary } from './weeklyReports.mjs';

// Saved submissions snapshot accomplishments; editable drafts refresh the completed-task list at save time.
export default function WeeklyReport({ task, tasks, canEdit, onDraft, onSubmit }) {
    const [report, setReport] = useState(() => ({ summary: '', accomplishments: [], ...task.weeklyReport, problems: task.weeklyReport?.problems ?? task.weeklyReport?.challenges ?? '', solutions: task.weeklyReport?.solutions ?? '',followUps:task.weeklyReport?.followUps??'' }));
    const [error, setError] = useState('');
    // Manual additions survive refreshes and revisions; automatic mode keeps following completed tasks.
    const [summaryEdited, setSummaryEdited] = useState(() => task.weeklyReport?.summaryEdited ?? Boolean(task.weeklyReport?.summary?.trim()));
    const [editingSummary, setEditingSummary] = useState(false);
    const accomplishments = canEdit || !task.weeklyReport ? accomplishedThisWeek(tasks, task.assignee, task.weekStart, task.weekEnd).map(item => ({ id: item.id, title: item.title, branch: item.branch })) : report.accomplishments;
    const summary = !canEdit && task.weeklyReport ? report.summary : weeklySummary(task, accomplishments);
    const snapshot = () => ({ ...report, summary, summaryEdited:false, accomplishments });
    return <section className="tm-rounds"><h3>Intern Weekly Report</h3><p>{task.weekStart} – {task.weekEnd} · Due Friday</p>
        <form onSubmit={event => { event.preventDefault(); if (!canEdit) return; if (!summary.trim()) return setError('Add your weekly summary before submitting.'); onSubmit(snapshot()); }}>
            <h4>Summary <small>(Tasks Completed)</small></h4><p className="tm-daily-caption">Filled automatically from your approved tasks completed during this week.</p><pre className="tm-weekly-summary-text" style={{whiteSpace:'pre-wrap'}}>{summary}</pre>
            {[['problems', 'Issues / Problems'], ['solutions', 'Solutions'], ['followUps','Follow-ups']].map(([key, label]) => <label key={key}>{label}{canEdit ? <textarea rows={3} value={report[key]} placeholder="Enter details, or None." onChange={event => { setError(''); setReport({ ...report, [key]: event.target.value }); }} /> : <p className="tm-weekly-summary-text">{report[key]?.trim() || 'None'}</p>}</label>)}
            {error && <p className="tm-rounds-error" role="alert">{error}</p>}{canEdit && <div className="tm-modal-actions"><button type="button" className="tm-secondary" onClick={() => onDraft(snapshot())}>Save draft</button><button className="tm-primary">Submit weekly report for review</button></div>}
        </form><details className="tm-rounds-report"><summary>Weekly report preview</summary><pre>{formatWeeklyReport(task, snapshot())}</pre></details></section>;
}
