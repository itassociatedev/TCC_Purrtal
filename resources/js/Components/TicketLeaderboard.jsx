import { Link } from '@inertiajs/react';

const colors = ['#2860ef', '#e72229', '#e9b600', '#12a345', '#9333ea', '#0891b2', '#ea580c', '#64748b'];
const periods = { day: 'Day', week: 'Week', month: 'Month', year: 'Year', all: 'All time' };
const detailLabels = { resolved: 'Resolved tickets', overdue: 'Overdue tickets', ratings: 'Ratings and comments' };
const formatDate = value => value ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }) : '—';
const ratingLabel = member => member.rating_count ? `${Number(member.rating_average).toFixed(1)} / 5` : 'Not rated yet';
const percent = value => Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// SLA averages arrive in support seconds; null means no eligible completed milestone.
const slaTime = seconds => seconds == null ? 'N/A' : `${(Number(seconds) / 60).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} min`;

function CatMedal({ rank }) {
    // Small vector cat medals echo the reference without introducing bitmap assets.
    return <svg viewBox="0 0 64 56" className="leaderboard-cat" aria-hidden="true"><path d="M13 30V9l18 10L49 9v22c0 14-36 14-36-1Z" fill="currentColor" fillOpacity=".14" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" /><circle cx="24" cy="29" r="1.5" fill="currentColor" /><circle cx="38" cy="29" r="1.5" fill="currentColor" /><circle cx="48" cy="40" r="14" fill="currentColor" stroke="white" strokeWidth="3" /><text x="48" y="45" textAnchor="middle" fill="white" fontSize="17" fontWeight="600">{rank}</text></svg>;
}

function LeaderboardDetail({ detail, period, detailUrl, backUrl, exportUrl, onSelectTicket }) {
    const { member, type, entries, total, page, last_page: lastPage } = detail;
    const ratings = type === 'ratings';
    const href = (nextType, nextPage) => detailUrl(member.id, nextType, nextPage);
    return <section className="ticket-leaderboard leaderboard-detail">
        <Link className="leaderboard-drill-link" href={backUrl}>← Back to leaderboard</Link>
        <h2>{member.name} · {detailLabels[type]}</h2>
        <p>{periods[period]} · {total} {ratings ? 'ratings' : 'tickets'}</p>
        <nav className="leaderboard-detail-links" aria-label="Leaderboard details">
            {Object.entries(detailLabels).map(([key, label]) => <Link key={key} className="ticket-secondary" href={href(key)} aria-current={key === type ? 'page' : undefined}>{label}</Link>)}
        </nav>
        <a className="ticket-secondary clinic-file-action" href={exportUrl}>Export {detailLabels[type].toLowerCase()} XLSX</a>
        {entries.length ? <div className="ticket-table-wrap"><table className="leaderboard-table">
            <thead><tr><th scope="col">Ticket</th><th scope="col">{ratings ? 'Rating' : 'Status'}</th><th scope="col">{ratings ? 'Comment' : 'Branch'}</th><th scope="col">{ratings ? 'Submitted' : type === 'resolved' ? 'Resolved' : 'Created'}</th></tr></thead>
            <tbody>{entries.map(entry => {
                const ticket = entry.ticket;
                return <tr key={ratings ? entry.id : ticket.id}>
                    <td data-label="Ticket">{ticket ? <button className="leaderboard-drill-link" type="button" onClick={() => onSelectTicket(ticket)}>{ticket.subject}</button> : entry.subject}
                        <small>#{ratings ? entry.ticket_code : ticket.ticket_code}</small></td>
                    <td data-label={ratings ? 'Rating' : 'Status'}>{ratings ? `${entry.rating} / 5` : <span className="leaderboard-detail-status">{ticket.status.replaceAll('_', ' ')}</span>}</td>
                    <td data-label={ratings ? 'Comment' : 'Location'} className="leaderboard-detail-comment">{ratings ? (entry.comment || 'No comment') : (ticket.ticket_location?.name || ticket.branch?.name || '—')}</td>
                    <td data-label={ratings ? 'Submitted' : type === 'resolved' ? 'Resolved' : 'Created'}>{formatDate(entry.at)}</td>
                </tr>;
            })}</tbody>
        </table></div> : <p className="ticket-empty">{ratings ? 'No ratings in this date range.' : 'No matching tickets in this date range.'}</p>}
        {lastPage > 1 && <nav className="leaderboard-detail-links" aria-label="Detail pages">
            {page > 1 && <Link className="ticket-secondary" href={href(type, page - 1)}>Previous</Link>}
            <span>Page {page} of {lastPage}</span>
            {page < lastPage && <Link className="ticket-secondary" href={href(type, page + 1)}>Next</Link>}
        </nav>}
    </section>;
}

export default function TicketLeaderboard({ data, onPeriodChange, exportUrl, detailUrl, backUrl, onSelectTicket }) {
    if (data?.detail) return <LeaderboardDetail detail={data.detail} period={data.period} detailUrl={detailUrl} backUrl={backUrl} exportUrl={exportUrl} onSelectTicket={onSelectTicket} />;
    const members = data?.members || [];
    const total = data?.total_resolved || 0;
    const winners = members.filter(m => m.resolved > 0).slice(0, 3);
    // The reference puts second on the left, first in the center, third on the right.
    const podium = [winners[1], winners[0], winners[2]];
    let offset = 0;
    return <div className="ticket-leaderboard">
        <div className="leaderboard-period-toolbar"><label>Date range<select value={data?.period || 'all'} onChange={e => onPeriodChange(e.target.value)}>
            {Object.entries(periods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label><a className="ticket-secondary clinic-file-action" href={exportUrl}>Export leaderboard XLSX</a></div>
        <div className="leaderboard-overview">
            <section className="leaderboard-panel"><header><h2>Top cats <span className="leaderboard-sparkle" aria-hidden="true">✦</span></h2><p>A little spotlight for a job well done.</p></header>
                <div className="leaderboard-podium">{podium.map((m, index) => m ? <article key={m.id} className={`leaderboard-place leaderboard-place-${[2, 1, 3][index]}`}>
                    <span className="leaderboard-place-label">{['Second place', 'Top cat', 'Third place'][index]}</span><CatMedal rank={m.rank} /><h3>{m.name}</h3><strong>{m.resolved}</strong><p>tickets resolved</p><p className="leaderboard-rating">{ratingLabel(m)}</p>
                </article> : <div key={`empty-${index}`} className={`leaderboard-place-empty leaderboard-place-${[2, 1, 3][index]}`}><span>{['Second place', 'Top cat', 'Third place'][index]}</span><p>No ranked staff yet</p></div>)}</div>
            </section>
            <section className="leaderboard-panel"><header><h2>Tickets resolved</h2><p>Share of completed resolutions in the current results</p></header>
                <div className="leaderboard-chart-row"><svg viewBox="0 0 200 200" role="img" aria-label={total ? 'Share of resolved tickets by IT staff; values listed in the legend.' : 'No resolved tickets to chart'}>
                    <circle cx="100" cy="100" r="80" fill="#eef0f6" />
                    {/* Exact counts define segments; displayed percentages are rounded independently. */}
                    {total > 0 && members.filter(m => m.resolved > 0).map(m => {
                        const share = m.resolved / total;
                        const start = offset; offset += share * Math.PI * 2;
                        const color = colors[members.indexOf(m) % colors.length];
                        const title = <title>{m.name}: {m.resolved} ({percent(m.percentage)}%)</title>;
                        // Filled sectors avoid thick dashed strokes overlapping near the center.
                        // A full circle requires its own element because an arc cannot join identical endpoints.
                        if (m.resolved === total) return <circle key={m.id} cx="100" cy="100" r="80" fill={color}>{title}</circle>;
                        const point = angle => `${100 + 80 * Math.cos(angle - Math.PI / 2)} ${100 + 80 * Math.sin(angle - Math.PI / 2)}`;
                        return <path key={m.id} d={`M 100 100 L ${point(start)} A 80 80 0 ${share > 0.5 ? 1 : 0} 1 ${point(offset)} Z`} fill={color}>{title}</path>;
                    })}
                </svg><div className="leaderboard-legend"><ul>{members.map((m, i) => <li key={m.id}><span className="leaderboard-color" style={{ background: colors[i % colors.length] }} aria-hidden="true" /><span>{m.name}</span><strong>{m.resolved}</strong><small>{percent(m.percentage)}%</small></li>)}<li className="leaderboard-legend-total"><span>Total resolved</span><strong>{total}</strong><small>{percent(total > 0 ? 100 : 0)}%</small></li></ul></div></div>
            </section>
        </div>
        <details className="leaderboard-rules"><summary>How rankings work</summary><p>Selected calendar period · current IT member and team leader roster. Resolution counts use resolution date; ratings use feedback submission date; overdue assignments use ticket creation date. All time removes these date limits. Resolved and closed tickets count once, credited to the recorded resolver. Reopened tickets are excluded until resolved again. Share is each person’s resolutions divided by all ranked staff resolutions. Tied totals share rank; names break display ties. Ratings average the latest feedback per ticket credited to its actual resolver, including half stars. Ratings do not change rank. SLA averages show support minutes for currently resolved or closed tickets resolved during the selected period, credited to the resolver. Response time describes those tickets, even if another staff member acknowledged them. Missing milestones are excluded; N/A means no timed tickets. Attention counts currently assigned open tickets with a breached resolution SLA.</p></details>
        <div className="ticket-table-wrap"><table className="leaderboard-table leaderboard-summary-table"><thead><tr><th scope="col">Rank</th><th scope="col">Employee</th><th scope="col">Tickets resolved</th><th scope="col">Share</th><th scope="col">Rating</th><th scope="col">Avg. response</th><th scope="col">Avg. resolution</th><th scope="col">Attention</th></tr></thead><tbody>{members.map(m => <tr key={m.id}><td data-label="Rank"><span className={`leaderboard-rank ${m.rank <= 3 ? 'leaderboard-rank-top' : ''}`}>{m.rank}</span></td><td data-label="Employee"><strong>{m.name}</strong><small>{m.role || 'IT member'}{m.branches ? ` · ${m.branches}` : ''}</small></td><td data-label="Tickets resolved"><Link className="leaderboard-drill-link" href={detailUrl(m.id, 'resolved')} aria-label={`View ${m.resolved} resolved tickets for ${m.name}`}>{m.resolved}</Link></td><td data-label="Share">{percent(m.percentage)}%</td><td data-label="Rating"><Link className="leaderboard-drill-link leaderboard-rating" href={detailUrl(m.id, 'ratings')} aria-label={`View ratings and comments for ${m.name}`}>{ratingLabel(m)}</Link><small>{m.rating_count || 0} rated ticket{m.rating_count === 1 ? '' : 's'}</small></td><td data-label="Avg. response">{slaTime(m.sla_response_average)}<small>{m.sla_response_count || 0} timed tickets</small></td><td data-label="Avg. resolution">{slaTime(m.sla_resolution_average)}<small>{m.sla_resolution_count || 0} timed tickets</small></td><td data-label="Attention" className={m.overdue ? 'leaderboard-overdue' : 'leaderboard-clear'}><Link className="leaderboard-drill-link" href={detailUrl(m.id, 'overdue')} aria-label={`View overdue tickets for ${m.name}`}>{m.overdue ? `${m.overdue} overdue ticket${m.overdue === 1 ? '' : 's'}` : 'No overdue work'}</Link></td></tr>)}</tbody></table></div>
        {!members.length && <p className="ticket-empty">No IT staff configured.</p>}
    </div>;
}
