import { useForm } from '@inertiajs/react';

export default function TicketWorkbookControls({ leader, pending, ticketRoute, view, search }) {
    const upload = useForm({ mode: 'preview', file: null });
    const confirm = useForm({ mode: 'confirm', token: pending?.token || '' });
    const cancel = useForm({ mode: 'cancel' });
    return <section className="ticket-workbook-controls" aria-label="XLSX import and export">
        {/* Native links download binary workbooks without an Inertia navigation. */}
        <a className="ticket-secondary" href={ticketRoute('export', { view, search })}>Export XLSX</a>
        {leader && <details><summary>Import new tickets (XLSX)</summary>
            <p>Creates new tickets only, using import time for creation and SLA receipt. Maximum 100 tickets / 5 MB. Validate and review before saving.</p>
            <a href={ticketRoute('template')} className="ticket-secondary">Download XLSX template</a>
            <form onSubmit={e => { e.preventDefault(); upload.post(ticketRoute('import'), { forceFormData: true, preserveScroll: true }); }}>
                <label>Completed workbook<input type="file" accept=".xlsx" required onChange={e => upload.setData('file', e.target.files[0] || null)} /></label>
                <button className="ticket-secondary" disabled={upload.processing}>{upload.processing ? 'Validating…' : 'Validate and preview'}</button>
                {Object.entries(upload.errors).map(([key, error]) => <p className="ticket-error" role="alert" key={key}>{error}</p>)}
            </form>
            {pending && <div className="ticket-import-preview"><h3>Review {pending.tickets.length} new tickets</h3>
                <div className="ticket-table-wrap"><table><thead><tr><th>Employee</th><th>Branch affected</th><th>Subject</th></tr></thead><tbody>{pending.tickets.map((ticket, index) => <tr key={index}><td>{ticket.employee}</td><td>{ticket.branch}</td><td>{ticket.subject}</td></tr>)}</tbody></table></div>
                <form onSubmit={e => { e.preventDefault(); confirm.transform(data => ({ ...data, token: pending.token })); confirm.post(ticketRoute('import'), { preserveScroll: true }); }}>
                    <button className="ticket-primary" disabled={confirm.processing || cancel.processing}>{confirm.processing ? 'Importing…' : 'Confirm import and notify'}</button>
                    {Object.entries(confirm.errors).map(([key, error]) => <p className="ticket-error" role="alert" key={key}>{error}</p>)}
                </form>
                <button className="ticket-secondary" disabled={confirm.processing || cancel.processing} onClick={() => cancel.post(ticketRoute('import'), { preserveScroll: true })}>Discard preview</button>
            </div>}
        </details>}
    </section>;
}
