
const priorities = [
    ['P1 Critical', 'critical'], ['P2 High', 'high'], ['P3 Medium', 'medium'], ['P4 Low', 'low'],
];

export default function TicketSlaPerformance({ report, period = 'all', onPeriodChange }) {
    const backlog = Object.entries(report).filter(([label]) => label.endsWith(' open backlog'));
    const value = label => report[label] ?? 'N/A';
    // Keep the original report values and calculations; only group their display.
    return <section className="ticket-card ticket-sla-performance" aria-labelledby="sla-performance-title">
        <header className="sla-performance-heading">
            <div><h2 id="sla-performance-title">SLA performance</h2><p>Daily support · 7:30 AM–7:00 PM</p></div>
            <label className="sla-period">Received in<select value={period} onChange={e => onPeriodChange(e.target.value)}>
                {[['all', 'All time'], ['day', 'Today'], ['week', 'This week'], ['month', 'This month'], ['quarter', 'This quarter']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select></label>
        </header>

        <dl className="sla-summary-strip">
            {[['Tracked tickets', 'neutral'], ['Awaiting priority', 'violet'], ['At risk', 'amber'], ['Overdue open', 'red']].map(([label, tone]) =>
                <div className={`sla-summary-item sla-tone-${tone}`} key={label}><dt>{label}</dt><dd>{value(label)}</dd></div>
            )}
        </dl>

        <div className="sla-performance-groups">
            <section className="sla-performance-group" aria-labelledby="sla-service-title">
                <h3 id="sla-service-title">Service targets</h3>
                <table className="sla-compact-table"><thead><tr><th scope="col">Metric</th><th scope="col">Response</th><th scope="col">Resolution</th></tr></thead>
                    <tbody><tr><th scope="row">Compliance</th><td className="sla-compliance">{value('Response compliance')}</td><td className="sla-compliance">{value('Resolution compliance')}</td></tr>
                        <tr><th scope="row">Avg. support time</th><td>{value('Average response (support min)')} min</td><td>{value('Average resolution (support min)')} min</td></tr></tbody>
                </table>
            </section>
            <section className="sla-performance-group" aria-labelledby="sla-breaches-title">
                <h3 id="sla-breaches-title">Breaches by priority</h3>
                <table className="sla-compact-table"><thead><tr><th scope="col">Priority</th><th scope="col">Breached / total</th></tr></thead>
                    <tbody>{priorities.map(([label, tone]) => <tr key={label}><th scope="row"><span className={`sla-priority sla-priority-${tone}`}>{label}</span></th><td>{value(`${label} breaches`)}</td></tr>)}</tbody>
                </table>
            </section>
            <section className="sla-performance-group" aria-labelledby="sla-backlog-title">
                <h3 id="sla-backlog-title">Open backlog by branch</h3>
                <dl className="sla-backlog">{backlog.map(([label, count]) => <div key={label}><dt>{label.replace(/ open backlog$/, '')}</dt><dd>{count}</dd></div>)}</dl>
                {!backlog.length && <p className="sla-no-backlog">No open backlog in this period.</p>}
            </section>
        </div>

        <dl className="sla-secondary-strip">
            <div><dt>Reopened</dt><dd>{value('Reopened tickets')} <span>({value('Reopened (%)')})</span></dd></div>
            <div><dt>Linked follow-ups</dt><dd>{value('Linked follow-up tickets')}</dd></div>
        </dl>
        <details className="sla-measurement-note"><summary>How these metrics are measured</summary><p>Includes tickets received in the selected period. Existing tickets are excluded. Compliance includes completed targets and outstanding recorded breaches; Not Set tickets are excluded. All days, including holidays, count as support days. Breach totals include recorded previous breaches.</p></details>
    </section>;
}
