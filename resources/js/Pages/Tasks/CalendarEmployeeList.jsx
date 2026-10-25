import CalendarHelp from './CalendarHelp.jsx';
import OverdueBadge from './OverdueBadge.jsx';
import { useState } from 'react';
import { employeeTaskGroups } from './calendarEmployees.mjs';
import PagedList from './PagedList.jsx';

// Busy dates open a searchable directory instead of expanding the calendar's day cells.
export default function CalendarEmployeeList({ tasks, date, onEmployee, overdueCounts = {} }) {
    const [search, setSearch] = useState('');
    const all = employeeTaskGroups(tasks.filter(task => task.due === date));
    const matches = all.filter(person => person.name.toLowerCase().includes(search.trim().toLowerCase()));
    return <div><p className="tm-daily-caption">{all.length} employees · {all.reduce((sum, person) => sum + person.count, 0)} tasks due on {date}</p><CalendarHelp /><label>Find employee<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search employee name…" /></label><PagedList items={matches} resetKey={search} label="employees">{items => <div className="tm-calendar-directory">{items.map(person => <button type="button" key={person.name} onClick={() => onEmployee(person.name)}><span className="tm-calendar-directory-name"><i style={{ backgroundColor: person.color }} />{person.name}<OverdueBadge name={person.name} count={overdueCounts[person.name]} /></span><span>{person.count} task{person.count === 1 ? '' : 's'} <span aria-hidden="true">→</span></span></button>)}{!items.length && <p>No employees match your search.</p>}</div>}</PagedList></div>;
}
