import { dashboardTaskCounts } from './personalTasks.mjs';

export default function DashboardTaskSummary({ myTasks, teamTasks, today, onSelect, showTeam = true }) {
    const rows = [
        ['My tasks', dashboardTaskCounts(myTasks, [], today, true), 'My Tasks'],
        ...(showTeam ? [['Team tasks', dashboardTaskCounts(teamTasks, [], today, true), 'Team Tasks']] : []),
    ];
    return <section className={`tm-dashboard-summary${showTeam ? '' : ' tm-dashboard-summary-personal'}`} aria-label={showTeam ? 'Personal and team task totals' : 'My task totals'}>
        {rows.map(([label, counts, view]) => <article className="tm-summary-group" key={label} aria-label={label}>
            <div className="tm-summary-heading"><h2>{label}</h2><button type="button" onClick={() => onSelect(view, 'All Tasks')} className="tm-summary-total" title="All unfinished assignments, including in-progress and overdue work"><strong>{counts.my}</strong><span>open tasks</span></button></div>
            <dl className={`tm-summary-breakdown${showTeam ? '' : ' tm-summary-breakdown-four'}`}>
                <div><dt><button type="button" onClick={() => onSelect(view, 'In Progress')}>In progress</button></dt><dd><button type="button" aria-label={`${label}: ${counts.inProgress} in progress`} onClick={() => onSelect(view, 'In Progress')}>{counts.inProgress}</button></dd></div>
                <div><dt><button type="button" onClick={() => onSelect(view, 'Completed')}>Completed</button></dt><dd><button type="button" aria-label={`${label}: ${counts.completed} completed`} onClick={() => onSelect(view, 'Completed')}>{counts.completed}</button></dd></div>
                <div className={counts.overdue ? 'tm-summary-overdue' : ''}><dt><button type="button" onClick={() => onSelect(view, 'Overdue')}>Overdue</button></dt><dd><button type="button" aria-label={`${label}: ${counts.overdue} overdue`} onClick={() => onSelect(view, 'Overdue')}>{counts.overdue}</button></dd></div>
                {!showTeam && <div><dt><button type="button" onClick={() => onSelect(view, 'Today')}>Due today</button></dt><dd><button type="button" aria-label={`${label}: ${counts.dueToday} due today`} onClick={() => onSelect(view, 'Today')}>{counts.dueToday}</button></dd></div>}
            </dl>
        </article>)}
    </section>;
}
