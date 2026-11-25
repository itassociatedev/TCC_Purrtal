import './opening-rounds-view.css';
import { useId, useState } from 'react';
import { emptyRounds, formatRounds, systemChecks, validateRounds } from './openingRounds.mjs';
import IssueImage from './IssueImage.jsx';

// A structured submission form replaces the generic text box for IT Opening Rounds tasks.
export default function OpeningRounds({ canEdit = false, requiresApproval = true, task, onDraft, onSubmit, onNotice, branches, checks: configuredChecks = systemChecks, itDepartment = 'IT' }) {
    // Save a checklist snapshot with each draft so settings edits never rewrite old reports.
    const [rounds, setRounds] = useState(() => {
        const checks = task.rounds ? task.rounds.checks || systemChecks : configuredChecks;
        const initial = emptyRounds(task.due, task.branch, checks, itDepartment);
        const editable = canEdit && ['Not Started', 'In Progress', 'Revision Needed'].includes(task.status);
        const savedBranch = task.rounds?.branch || task.branch;
        return { ...initial, ...task.rounds, checks, department: editable ? itDepartment : task.rounds?.department || itDepartment, branch: editable && branches && !branches.includes(savedBranch) ? task.branch : savedBranch, systems: { ...initial.systems, ...task.rounds?.systems } };
    });
    const checks = rounds.checks;
    const [error, setError] = useState('');
    const images = rounds.images || [];
    const validLinks = () => {
        const links = (rounds.issueLinks || '').split('\n').map(link => link.trim()).filter(Boolean);
        if (links.some(link => {
            try { return !['http:', 'https:'].includes(new URL(link).protocol); }
            catch { return true; }
        })) {
            setError('Enter a valid http:// or https:// link on each line.');
            return false;
        }
        return true;
    };
    // Each checklist row is an independent controlled radio group.
    const checklistId = useId();
    const editable = canEdit && ['Not Started', 'In Progress', 'Revision Needed'].includes(task.status);
    const checked = checks.filter(([key]) => ['good', 'warning'].includes(rounds.systems[key])).length;
    const warnings = checks.filter(([key]) => rounds.systems[key] === 'warning').length;
    const setField = (name, value) => { setError(''); setRounds(previous => ({ ...previous, [name]: value })); };
    const setSystem = (name, value) => { setError(''); setRounds(previous => ({ ...previous, systems: { ...previous.systems, [name]: value } })); };
    const copyReport = async () => {
        try { await navigator.clipboard.writeText(formatRounds(rounds)); onNotice('Daily Rounds Update copied.'); }
        catch { onNotice('Clipboard is unavailable. You can select and copy the report text below.'); }
    };
    return <section className="tm-rounds" aria-labelledby="tm-rounds-heading">
        <div className="tm-rounds-heading"><h3 id="tm-rounds-heading">{rounds.branch} · Opening Rounds</h3><span>{checked}/{checks.length} checked{warnings > 0 ? ` · ${warnings} warning${warnings === 1 ? '' : 's'}` : ''}</span></div>
        <progress className="tm-rounds-progress" value={checked} max={Math.max(1, checks.length)} aria-label="Systems checked" />
        <nav className="tm-rounds-nav" aria-label="Opening Rounds sections">
            {['Staffing', 'Systems', 'Issues', 'Submit'].map(section => <button type="button" key={section}
                onClick={event => event.currentTarget.closest('.tm-rounds').querySelector(`[data-rounds-section="${section}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{section}</button>)}
        </nav>
        <form onSubmit={event => {
            event.preventDefault(); if (!editable) return;
            const message = validateRounds(rounds, { branches, itDepartment });
            if (message) { setError(message); return; }
            if (!validLinks()) return;
            onSubmit({ ...rounds, headcount: Number(rounds.headcount), leave: Number(rounds.leave), off: Number(rounds.off) });
        }} noValidate>
            <div className="tm-form-grid"><label>Date<input type="date" value={rounds.date} onChange={event => setField('date', event.target.value)} readOnly={task.recurrence === 'daily'} disabled={!editable}/></label><label>Work branch<select value={rounds.branch} disabled={!editable} onChange={event => setField('branch', event.target.value)}>{[...new Set([...(branches || []), ...(!editable ? [rounds.branch] : [])])].map(branch => <option key={branch}>{branch}</option>)}</select></label><label>Department<input value={rounds.department} readOnly/></label></div>
            <fieldset data-rounds-section="Staffing" disabled={!editable}><legend>Staffing</legend><div className="tm-rounds-manpower">{[['headcount', 'Headcount'], ['leave', 'Leave'], ['off', 'Off']].map(([key, label]) => <label key={key}>{label}<input type="number" min="0" step="1" inputMode="numeric" value={rounds[key]} onChange={event => setField(key, event.target.value)} placeholder="0"/></label>)}</div></fieldset>
            <fieldset data-rounds-section="Systems" disabled={!editable}><legend>System checklist</legend><p className="tm-rounds-hint">Check means the system is working. Warning means an issue needs attention.</p><div className="tm-rounds-checks">{checks.map(([key, label]) => <div className="tm-rounds-system" key={key}><strong id={`${checklistId}-${key}`}>{label}</strong><div role="radiogroup" aria-labelledby={`${checklistId}-${key}`}>{[['good', '✅ Good'], ['warning', '⚠️ Warning']].map(([value, text], index) => <button key={value} type="button" role="radio" aria-label={`${text} — ${label}`} aria-checked={rounds.systems[key] === value} disabled={!editable} tabIndex={rounds.systems[key] === value || (!rounds.systems[key] && index === 0) ? 0 : -1} className={`tm-rounds-choice ${rounds.systems[key] === value ? `selected ${value}` : ''}`} onClick={() => setSystem(key, value)} onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 'good' : event.key === 'End' ? 'warning' : value === 'good' ? 'warning' : 'good'; setSystem(key, next); event.currentTarget.parentElement.querySelectorAll('[role="radio"]')[next === 'good' ? 0 : 1].focus(); }}><span className="tm-rounds-radio-dot" aria-hidden="true"/><span>{text}</span></button>)}</div></div>)}</div></fieldset>
            <label data-rounds-section="Issues">Issues / maintenance {warnings > 0 && <span className="tm-late-text">(required for warnings)</span>}<textarea rows={3} value={rounds.issues} onChange={event => setField('issues', event.target.value)} placeholder="Describe the issue, affected system and action taken. Enter None if there are no issues." disabled={!editable}/></label>
            <section className="tm-issue-images" aria-label="Issue links">
                <label>Issue image links <span>(optional)</span>
                    <textarea rows={2} value={rounds.issueLinks || ''} disabled={!editable}
                        onChange={event => setField('issueLinks', event.target.value)}
                        placeholder="Paste a screenshot or photo link. Use one link per line." />
                </label>
                {(rounds.issueLinks || '').split('\n').map(link => link.trim()).filter(link => /^https?:\/\//i.test(link)).map((link, index) =>
                    <a key={index} href={link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', overflowWrap: 'anywhere' }}>View image {index + 1} ↗</a>)}
                {images.length > 0 && <details><summary>Previously attached images</summary>
                    <div className="tm-issue-gallery">{images.map(image => <IssueImage key={image.id} image={image} editable={false} />)}</div>
                </details>}
            </section>
            <label>Help needed <span>(optional)</span><textarea rows={2} value={rounds.helpNeeded} onChange={event => setField('helpNeeded', event.target.value)} placeholder="None" disabled={!editable}/></label>
            {error && <p className="tm-rounds-error" role="alert">{error}</p>}
            {editable && <div data-rounds-section="Submit" className="tm-modal-actions"><button className="tm-secondary" type="button"  onClick={() => { if (validLinks()) { onDraft(rounds); setError(''); } }}>Save draft</button><button className="tm-primary" type="submit" >{!requiresApproval?'Complete Opening Rounds':task.sharedBranchReport ? 'Submit branch report for approval' : 'Submit rounds for review'}</button></div>}
        </form>
        {task.sharedBranchReport && <p className="tm-form-note">One opening report per branch per day. {task.submittedBy ? `${task.status === 'Completed' ? 'Approved report submitted' : 'Report submitted'} by ${task.submittedBy}. ${task.status === 'Pending Review' ? 'Awaiting approval; no duplicate submission is needed.' : task.status === 'Revision Needed' ? 'Needs revision before approval.' : 'No duplicate submission is needed.'}` : 'Any IT employee or intern with access to this branch can complete it.'}</p>}
        <details className="tm-rounds-report" open={!editable}><summary>{editable ? 'Preview formatted report' : 'Submitted report'}</summary><pre>{formatRounds(rounds)}</pre><button className="tm-secondary" type="button" onClick={copyReport}>Copy report</button></details>
    </section>;
}
