import { useEffect, useState } from 'react';
import axios from 'axios';
import { importErrorMessage } from '@/Utils/importErrors.mjs';

export default function TaskIdSetup({ config, canEdit, onChange }) {
    const [form, setForm] = useState(config.taskIdFormat || { prefixSource: 'department', dateFormat: 'my', digits: 5, separator: '-' });
    const [applyTo, setApplyTo] = useState('new');
    const [counters, setCounters] = useState([]);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => { let cancelled = false; axios.get(route('tasks.ids.show')).then(({data}) => { if (!cancelled) { setForm(data.settings); setCounters(data.counters); } }).catch(error => { if (!cancelled) setMessage(importErrorMessage(error)); }); return () => { cancelled = true; }; }, []);
    const save = async event => {
        event.preventDefault(); setBusy(true); setMessage('');
        try { const {data} = await axios.post(route('tasks.ids.update'), {...form, applyTo}); onChange({ entity:'taskIdSettings', action:'edit', value:data.settings, applyTo:data.applyTo, records:data.records }); setMessage(data.applyTo==='all' ? 'Format saved and existing task IDs updated. Task assignments and workflow links are unchanged.' : 'Format saved for new tasks. Existing task IDs stay unchanged.'); }
        catch (error) { setMessage(importErrorMessage(error)); }
        finally { setBusy(false); }
    };
    const period = { my:'1126', mY:'112026', Ym:'202611', Ymd:'20261115' }[form.dateFormat];
    return <form onSubmit={save} className="tm-task-id-settings"><h3>Task ID format</h3><p>New tasks use a department prefix, creation month and year, and a sequence number. Each series starts at 1. Choose whether to keep existing IDs or update them too.</p>
        <div className="tm-form-grid"><label>Prefix<select disabled={!canEdit || busy} value={form.prefixSource} onChange={e => setForm({...form,prefixSource:e.target.value})}><option value="department">Department</option><option value="role">Role</option></select></label>
            <label>Date format<select disabled={!canEdit || busy} value={form.dateFormat} onChange={e => setForm({...form,dateFormat:e.target.value})}><option value="my">Month and year · 1126</option><option value="mY">Month and full year · 112026</option><option value="Ym">Year and month · 202611</option><option value="Ymd">Full date · 20261115</option></select></label>
            <label>Sequence digits<select disabled={!canEdit || busy} value={form.digits} onChange={e => setForm({...form,digits:Number(e.target.value)})}>{[5,6,7,8,9].map(n => <option key={n} value={n}>{n} digits · maximum {(10**n-1).toLocaleString()}</option>)}</select></label>
            <label>Separator<select disabled={!canEdit || busy} value={form.separator} onChange={e => setForm({...form,separator:e.target.value})}><option value="-">Hyphen (-)</option><option value="_">Underscore (_)</option></select></label></div>
        <p><strong>Example: </strong><code>{form.prefixSource==='role'?'TL':'IT'}{form.separator}{period}{form.separator}{'1'.padStart(form.digits,'0')}</code></p>
        <p>When a series reaches its maximum, Admin receives a notification. Increase the sequence digits before creating more tasks in that series.</p>
        {counters.some(counter => Number(counter.last_number) >= 10**Number(counter.scope.split(':').at(-1))-1) && <p role="alert" className="tm-rounds-error">A task ID series has reached its limit. Increase its sequence digits to continue.</p>}
        <fieldset className="tm-id-apply"><legend>Apply this format to</legend><div className="tm-id-apply-options" role="group" aria-label="Apply ID format to">
            {[['new','New tasks only','Keep existing task IDs.'],['all','Existing and new tasks','Update existing task IDs too.']].map(([value,title,description])=><button key={value} type="button" className="tm-id-apply-option" aria-pressed={applyTo===value} disabled={!canEdit || busy} onClick={()=>setApplyTo(value)}><span className="tm-id-apply-indicator" aria-hidden="true">{applyTo===value?'●':'○'}</span><span><strong>{title}</strong><small>{description}</small></span></button>)}
        </div></fieldset>
        {applyTo==='all' && <p>Existing tasks receive new IDs using their original creation dates. Previous IDs are recorded in History; older exports keep the IDs they were downloaded with.</p>}
        <button className="tm-primary" disabled={!canEdit || busy}>{busy?'Saving…':'Save ID format'}</button>{message && <p role="status">{message}</p>}
    </form>;
}
