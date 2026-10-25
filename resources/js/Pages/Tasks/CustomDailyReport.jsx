import { useState } from 'react';
import { formatCustomReport } from './reportTemplates.mjs';

// Render the saved field definition, so template edits never change an existing report's answers.
export default function CustomDailyReport({ task, canEdit, branches, onDraft, onSubmit }) {
    const [report, setReport] = useState(() => ({ date: task.scheduledDate, branch: task.branch, values: {}, ...task.customReport }));
    const [error, setError] = useState('');
    const answer = (id, value) => setReport(previous => ({ ...previous, values: { ...previous.values, [id]: value } }));
    return <section className="tm-rounds"><h3>{task.title}</h3><form onSubmit={event => { event.preventDefault(); if (!canEdit) return;
        if (!branches.includes(report.branch)) return setError('Choose an allowed work branch.');
        for (const field of task.reportDefinition.fields) {
            const value = report.values[field.id];
            if (field.required && !String(value ?? '').trim()) return setError(`Complete ${field.label}.`);
            if (field.type === 'number' && value !== undefined && value !== '' && (!Number.isInteger(Number(value)) || Number(value) < 0)) return setError(`${field.label} must be a whole number of zero or more.`);
        }
        onSubmit(report);
    }}><div className="tm-form-grid"><label>Date<input readOnly value={report.date} /></label><label>Work branch<select disabled={!canEdit} value={report.branch} onChange={event => setReport({ ...report, branch: event.target.value })}>{[...new Set([...branches, report.branch])].map(branch => <option key={branch}>{branch}</option>)}</select></label></div>
        {task.reportDefinition.fields.map(field => <label key={field.id}>{field.label}{field.required ? ' (required)' : ' (optional)'}{field.type === 'textarea' ? <textarea disabled={!canEdit} value={report.values[field.id] ?? ''} onChange={event => answer(field.id, event.target.value)} /> : field.type === 'status' ? <select disabled={!canEdit} value={report.values[field.id] ?? ''} onChange={event => answer(field.id, event.target.value)}><option value="">Choose status</option><option>Good</option><option>Warning</option></select> : <input disabled={!canEdit} type={field.type === 'number' ? 'number' : 'text'} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? 1 : undefined} value={report.values[field.id] ?? ''} onChange={event => answer(field.id, event.target.value)} />}</label>)}
        {error && <p role="alert" className="tm-rounds-error">{error}</p>}{canEdit && <div className="tm-modal-actions"><button type="button" className="tm-secondary" onClick={() => onDraft(report)}>Save draft</button><button className="tm-primary">Submit report for review</button></div>}</form><details className="tm-rounds-report"><summary>Report preview</summary><pre>{formatCustomReport(task, report)}</pre></details></section>;
}
