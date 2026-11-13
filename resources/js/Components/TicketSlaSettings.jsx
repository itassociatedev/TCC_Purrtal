import { useForm, usePage } from '@inertiajs/react';

// Six decimal places in hours preserve whole-second targets after server rounding.
function PriorityForm({ priority, order }) {
    const form = useForm({ label: priority?.label || '', response_hours: priority ? Number((priority.response_seconds / 3600).toFixed(6)) : '',
        resolution_hours: priority ? Number((priority.resolution_seconds / 3600).toFixed(6)) : '', update_hours: priority?.update_seconds ? Number((priority.update_seconds / 3600).toFixed(6)) : '',
        sort_order: priority?.sort_order || order });
    const submit = event => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => { if (!priority) form.reset(); } };
        if (priority) form.patch(route('tickets.priorities.update', priority.id), options);
        else form.post(route('tickets.priorities.store'), options);
    };
    return <section className="ticket-card ticket-priority-settings-card">
        <div className="ticket-card-heading"><h2>{priority ? priority.label : 'Add priority'}</h2></div>
        <form onSubmit={submit} className="ticket-priority-settings-form">
            <label>Priority name<input required maxLength={80} value={form.data.label} onChange={e => form.setData('label', e.target.value)} /></label>
            <label>Urgency order (1 is highest)<input required type="number" min="1" max="10000" step="1" value={form.data.sort_order} onChange={e => form.setData('sort_order', e.target.value)} /></label>
            <label>Response target (support hours)<input required type="number" min="0.000001" max="8760" step="any" value={form.data.response_hours} onChange={e => form.setData('response_hours', e.target.value)} /></label>
            <label>Resolution target (support hours)<input required type="number" min={form.data.response_hours || 0.000001} max="8760" step="any" value={form.data.resolution_hours} onChange={e => form.setData('resolution_hours', e.target.value)} /></label>
            <label>Progress update interval (support hours, optional)<input type="number" min="0.000001" max="8760" step="any" value={form.data.update_hours} onChange={e => form.setData('update_hours', e.target.value)} /></label>
            <div className="ticket-priority-settings-actions">
                {Object.entries(form.errors).map(([field, message]) => <p key={field} className="ticket-error" role="alert">{message}</p>)}
                <button type="submit" className="ticket-primary" disabled={form.processing}>{form.processing ? 'Saving…' : priority ? 'Save priority' : 'Add priority'}</button>
            </div>
        </form>
    </section>;
}

export default function TicketSlaSettings({ priorities }) {
    const { flash } = usePage().props;
    return <div>
        <div className="ticket-card-heading"><div><h1>SLA &amp; priorities</h1><p>Enter all durations in support hours. Fractions are allowed (for example, 0.5 hours). Existing tickets keep their saved targets; a priority change adopts the latest target without resetting elapsed time. Completed milestones stay preserved.</p><p>Urgency order controls dropdowns and sorting. The Critical priority retains its supervisor-approved workaround workflow.</p></div></div>
        {flash?.success && <p role="status" className="ticket-settings-success">{flash.success}</p>}
        <div className="ticket-priority-settings-grid">{priorities.map(priority => <PriorityForm key={priority.id} priority={priority} />)}<PriorityForm order={Math.max(0, ...priorities.map(p => p.sort_order)) + 1} /></div>
    </div>;
}
