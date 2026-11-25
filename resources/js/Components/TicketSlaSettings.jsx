import { useEffect, useState } from 'react';
import { useForm } from '@inertiajs/react';
import TicketRemovalConfirmation from '@/Components/TicketRemovalConfirmation';

// Six decimal places in hours preserve whole-second targets after server rounding.
function PriorityForm({ priority, order }) {
    const [confirmRemoval, setConfirmRemoval] = useState(false);
    const removal = useForm({});
    const form = useForm({ label: priority?.label || '', score_points: priority?.score_points ?? 0, time_completion_points: priority?.time_completion_points ?? 3, description: priority?.description || '', response_hours: priority ? Number((priority.response_seconds / 3600).toFixed(6)) : '',
        resolution_hours: priority ? Number((priority.resolution_seconds / 3600).toFixed(6)) : '', update_hours: priority?.update_seconds ? Number((priority.update_seconds / 3600).toFixed(6)) : '',
        sort_order: priority?.sort_order || order });
    // Other cards may shift after a save/removal; refresh only the server-owned position.
    useEffect(() => { form.setData('sort_order', priority?.sort_order || order); }, [priority?.sort_order, order]);
    const submit = event => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => { if (!priority) form.reset(); } };
        if (priority) form.patch(route('tickets.priorities.update', priority.id), options);
        else form.post(route('tickets.priorities.store'), options);
    };
    return <section className="ticket-card ticket-priority-settings-card">
        <div className="ticket-card-heading"><h2>{priority ? priority.label : 'Add priority'}{priority?.archived_at && <small> · Archived</small>}</h2></div>
        {priority && <div className="ticket-priority-removal">
            {priority.archived_at ? <button type="button" className="ticket-secondary" disabled={removal.processing} onClick={() => removal.post(route('tickets.priorities.restore', priority.id), { preserveScroll: true })}>Restore priority</button>
                : <button type="button" className="ticket-secondary" onClick={() => { removal.clearErrors(); setConfirmRemoval(true); }}>Remove priority</button>}
            {Object.entries(removal.errors).map(([field, message]) => <p key={field} className="ticket-error" role="alert">{message}</p>)}
        </div>}
        {priority && <TicketRemovalConfirmation show={confirmRemoval} kind="priority" itemName={priority.label}
            processing={removal.processing} errors={removal.errors} onCancel={() => setConfirmRemoval(false)}
            onConfirm={() => { if (!removal.processing) removal.delete(route('tickets.priorities.destroy', priority.id), { preserveScroll: true, onSuccess: () => setConfirmRemoval(false) }); }} />}
        {priority?.archived_at && <p className="ticket-priority-removal">Unavailable for new tickets or priority changes. Existing tickets, history and filters are preserved.</p>}
        <form onSubmit={submit} className="ticket-priority-settings-form">
            <fieldset disabled={Boolean(priority?.archived_at)} className="ticket-priority-settings-fields">
            <label>Priority name<input required maxLength={80} value={form.data.label} onChange={e => form.setData('label', e.target.value)} /></label>
            <label>Priority points<input required type="number" min="0" max="7" step="1" value={form.data.score_points} onChange={e => form.setData('score_points', e.target.value)} /></label>
            <label>Time Completion points (on time)<input required type="number" min="0" max="3" step="1" value={form.data.time_completion_points} onChange={e=>form.setData('time_completion_points',e.target.value)} /></label>
            <p className="ticket-form-note">Default time score: 3 on time; 2 up to 24 calendar hours late; 1 over 24 through 48 hours late; 0 later. Lowering the on-time value deducts 1 or 2 from that value for the late brackets, minimum 0. Total score = Priority + Time Completion, maximum 10.</p>
            <label>Priority description (optional)<textarea maxLength={500} value={form.data.description} onChange={e => form.setData('description', e.target.value)} /></label>
            <label>Urgency order (1 is highest)<input required type="number" min="1" max="10000" step="1" value={form.data.sort_order} onChange={e => form.setData('sort_order', e.target.value)} /></label>
            <label>Response target (support hours)<input required type="number" min="0.000001" max="8760" step="any" value={form.data.response_hours} onChange={e => form.setData('response_hours', e.target.value)} /></label>
            <label>Resolution target (support hours)<input required type="number" min={form.data.response_hours || 0.000001} max="8760" step="any" value={form.data.resolution_hours} onChange={e => form.setData('resolution_hours', e.target.value)} /></label>
            <label>Progress update interval (support hours, optional)<input type="number" min="0.000001" max="8760" step="any" value={form.data.update_hours} onChange={e => form.setData('update_hours', e.target.value)} /></label>
            <div className="ticket-priority-settings-actions">
                {Object.entries(form.errors).map(([field, message]) => <p key={field} className="ticket-error" role="alert">{message}</p>)}
                <button type="submit" className="ticket-primary" disabled={form.processing}>{form.processing ? 'Saving…' : priority ? 'Save priority' : 'Add priority'}</button>
            </div>
            </fieldset>
        </form>
    </section>;
}

export default function TicketSlaSettings({ priorities }) {
    return <div>
        <div className="ticket-card-heading"><div><h1>SLA &amp; priorities</h1><p>Priority and Time Completion points are captured at permanent resolution and credited to the resolver. Later changes to priority or points do not change completed awards. Descriptions appear beside priorities in Create Ticket. Enter all durations in support hours. Fractions are allowed (for example, 0.5 hours). Existing tickets keep their saved targets; a priority change adopts the latest target without resetting elapsed time. Completed milestones stay preserved.</p><p>Remove deletes an unused priority or archives a used one. Archived priorities can be restored. At least one priority must remain active. Urgency order is a position: inserting or moving a priority automatically shifts the others. All priorities, including archived ones, have unique positions. Values beyond the list append to the end. The Critical priority retains its supervisor-approved workaround workflow.</p></div></div>
        <div className="ticket-priority-settings-grid">{priorities.map(priority => <PriorityForm key={priority.id} priority={priority} />)}<PriorityForm order={Math.max(0, ...priorities.map(p => p.sort_order)) + 1} /></div>
    </div>;
}
