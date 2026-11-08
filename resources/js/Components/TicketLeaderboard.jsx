import { Link } from '@inertiajs/react';

const colors = ['#2860ef', '#e72229', '#e9b600', '#12a345', '#9333ea', '#0891b2', '#ea580c', '#64748b'];
const periods = { day: 'Day', week: 'Week', month: 'Month', year: 'Year', all: 'All time' };
const detailLabels = { resolved: 'Resolved tickets', overdue: 'Overdue tickets', ratings: 'Ratings and comments' };
const formatDate = value => value ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }) : '—';
const ratingLabel = member => member.rating_count ? `${Number(member.rating_average).toFixed(1)} / 5` : 'Not rated yet';
const percent = value => Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function CatMedal({ rank }) {
    // Small vector cat medals echo the reference without introducing bitmap assets.
    return <svg viewBox="0 0 64 56" className="leaderboard-cat" aria-hidden="true"><path d="M13 30V9l18 10L49 9v22c0 14-36 14-36-1Z" fill="currentColor" fillOpacity=".14" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" /><circle cx="24" cy="29" r="1.5" fill="currentColor" /><circle cx="38" cy="29" r="1.5" fill="currentColor" /><circle cx="48" cy="40" r="14" fill="currentColor" stroke="white" strokeWidth="3" /><text x="48" y="45" textAnchor="middle" fill="white" fontSize="17" fontWeight="600">{rank}</text></svg>;
}

function LeaderboardDetail({ detail, period, detailUrl, backUrl, onSelectTicket }) {
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
        {entries.length ? <div className="ticket-table-wrap"><table className="leaderboard-table">
            <thead><tr><th scope="col">Ticket</th><th scope="col">{ratings ? 'Rating' : 'Status'}</th><th scope="col">{ratings ? 'Comment' : 'Branch'}</th><th scope="col">{ratings ? 'Submitted' : type === 'resolved' ? 'Resolved' : 'Created'}</th></tr></thead>
            <tbody>{entries.map(entry => {
                const ticket = entry.ticket;
                return <tr key={ratings ? entry.id : ticket.id}>
                    <td>{ratings ? <strong>{entry.subject}</strong> : <button className="leaderboard-drill-link" type="button" onClick={() => onSelectTicket(ticket)}>{ticket.subject}</button>}
                        <small>#{ratings ? entry.ticket_code : ticket.ticket_code}</small></td>
                    <td>{ratings ? `${entry.rating} / 5` : <span className="leaderboard-detail-status">{ticket.status.replaceAll('_', ' ')}</span>}</td>
                    <td className="leaderboard-detail-comment">{ratings ? (entry.comment || 'No comment') : (ticket.branch?.name || '—')}</td>
                    <td>{formatDate(entry.at)}</td>
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
    if (data?.detail) return <LeaderboardDetail detail={data.detail} period={data.period} detailUrl={detailUrl} backUrl={backUrl} onSelectTicket={onSelectTicket} />;
    const members = data?.members || [];
    const total = data?.total_resolved || 0;
    const winners = members.filter(m => m.resolved > 0).slice(0, 3);
    // The reference puts second on the left, first in the center, third on the right.
    const podium = [winners[1], winners[0], winners[2]];
    let offset = 0;
    return <div className="ticket-leaderboard">
        <div className="leaderboard-period-toolbar"><label>Date range<select value={data?.period || 'all'} onChange={e => onPeriodChange(e.target.value)}>
            {Object.entries(periods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label><p>Current calendar period</p><a className="ticket-secondary clinic-file-action" href={exportUrl}>Export leaderboard XLSX</a></div>
        <div className="leaderboard-overview">
            <section className="leaderboard-panel"><header><h2>Top cats <span className="leaderboard-sparkle" aria-hidden="true">✦</span></h2><p>A little spotlight for a job well done.</p></header>
                <div className="leaderboard-podium">{podium.map((m, index) => m ? <article key={m.id} className={`leaderboard-place leaderboard-place-${[2, 1, 3][index]}`}>
                    <span className="leaderboard-place-label">{['Second place', 'Top cat', 'Third place'][index]}</span><CatMedal rank={m.rank} /><h3>{m.name}</h3><strong>{m.resolved}</strong><p>tickets resolved</p><p className="leaderboard-rating">{ratingLabel(m)}</p>
                </article> : <div key={`empty-${index}`} className="leaderboard-place-empty"><span>{['Second place', 'Top cat', 'Third place'][index]}</span><p>No ranked staff yet</p></div>)}</div>
            </section>
            <section className="leaderboard-panel"><header><h2>Tickets resolved</h2><p>Share of completed resolutions in the current results</p></header>
                <div className="leaderboard-chart-row"><svg viewBox="0 0 200 200" role="img" aria-label={total ? 'Share of resolved tickets by IT staff; values listed in the legend.' : 'No resolved tickets to chart'}>
                    <circle cx="100" cy="100" r="80" fill="#eef0f6" />
                    {/* Exact counts define segments; displayed percentages are rounded independently. */}
                    {total > 0 && members.filter(m => m.resolved > 0).map(m => {
                        const length = m.resolved / total * 100;
                        const start = offset; offset += length;
                        return <circle key={m.id} cx="100" cy="100" r="40" fill="none" stroke={colors[members.indexOf(m) % colors.length]} strokeWidth="80" pathLength="100" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-start} transform="rotate(-90 100 100)"><title>{m.name}: {m.resolved} ({percent(m.percentage)}%)</title></circle>;
                    })}
                </svg><div className="leaderboard-legend"><ul>{members.map((m, i) => <li key={m.id}><span className="leaderboard-color" style={{ background: colors[i % colors.length] }} aria-hidden="true" /><span>{m.name}</span><strong>{m.resolved}</strong><small>{percent(m.percentage)}%</small></li>)}<li className="leaderboard-legend-total"><span>Total resolved</span><strong>{total}</strong></li></ul></div></div>
            </section>
        </div>
        <details className="leaderboard-rules"><summary>How rankings work</summary><p>Selected calendar period · current IT member and team leader roster. Resolution counts use resolution date; ratings use feedback submission date; overdue assignments use ticket creation date. All time removes these date limits. Resolved and closed tickets count once, credited to the recorded resolver. Reopened tickets are excluded until resolved again. Share is each person’s resolutions divided by all ranked staff resolutions. Tied totals share rank; names break display ties. Ratings average the latest feedback per ticket credited to its actual resolver, including half stars. Ratings do not change rank. Attention counts currently assigned open tickets with a breached resolution SLA.</p></details>
        <div className="ticket-table-wrap"><table className="leaderboard-table"><thead><tr><th scope="col">Rank</th><th scope="col">Employee</th><th scope="col">Tickets resolved</th><th scope="col">Share</th><th scope="col">Rating</th><th scope="col">Attention</th></tr></thead><tbody>{members.map(m => <tr key={m.id}><td><span className={`leaderboard-rank ${m.rank <= 3 ? 'leaderboard-rank-top' : ''}`}>{m.rank}</span></td><td><strong>{m.name}</strong><small>{m.role || 'IT member'}{m.branches ? ` · ${m.branches}` : ''}</small></td><td><Link className="leaderboard-drill-link" href={detailUrl(m.id, 'resolved')} aria-label={`View ${m.resolved} resolved tickets for ${m.name}`}>{m.resolved}</Link></td><td>{percent(m.percentage)}%</td><td><Link className="leaderboard-drill-link leaderboard-rating" href={detailUrl(m.id, 'ratings')} aria-label={`View ratings and comments for ${m.name}`}>{ratingLabel(m)}</Link><small>{m.rating_count || 0} rated ticket{m.rating_count === 1 ? '' : 's'}</small></td><td className={m.overdue ? 'leaderboard-overdue' : 'leaderboard-clear'}><Link className="leaderboard-drill-link" href={detailUrl(m.id, 'overdue')} aria-label={`View overdue tickets for ${m.name}`}>{m.overdue ? `${m.overdue} overdue ticket${m.overdue === 1 ? '' : 's'}` : 'No overdue work'}</Link></td></tr>)}</tbody></table></div>
        {!members.length && <p className="ticket-empty">No IT staff configured.</p>}
    </div>;
}
