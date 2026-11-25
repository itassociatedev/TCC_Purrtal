import OverdueBadge from './OverdueBadge.jsx';

export default function CalendarHelp() {
    return <div className="tm-calendar-help"><span><OverdueBadge count={2} name="Example employee" />Red warning: employee’s total overdue tasks in your view, across all dates.</span><span><b className="tm-calendar-count-example">3</b>Bar number: tasks due for that employee on that date.</span></div>;
}
