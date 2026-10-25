import { useState } from 'react';
import PagedList from './PagedList.jsx';
import { scheduledBranch } from './workSchedule.mjs';

// Employees adjust their own reporting week and dated work assignments without changing home branch.
export default function EmployeeSchedule({ employee, today, intern, it, onAssignment }) {
    const [date, setDate] = useState(today);
    const [branch, setBranch] = useState(scheduledBranch(employee, today));
    return <section className="tm-panel tm-setup tm-personal-schedule"><h2>My reporting schedule</h2>{intern && <p className="tm-daily-caption">Weekly reports are due every Friday. Tasks are gathered automatically from Saturday through Friday, regardless of individual days off.</p>}
        {it && <><p className="tm-daily-caption">Choose the branch for a specific workday. Unscheduled days use your home branch, {employee.branch}. Submitted reports keep their recorded branch.</p><form className="tm-setup-toolbar" onSubmit={event => { event.preventDefault(); onAssignment(date, branch); }}><label>Work date<input type="date" min={today} value={date} required onChange={event => { setDate(event.target.value); setBranch(scheduledBranch(employee, event.target.value)); }} /></label><label>Assigned branch<select value={branch} onChange={event => setBranch(event.target.value)}>{(employee.availableBranches || [employee.branch]).map(name => <option key={name}>{name}</option>)}<option value="Off">Day off</option></select></label><button className="tm-primary">Save assignment</button></form>
            <PagedList items={Object.entries(employee.branchSchedule || {}).sort(([a], [b]) => a.localeCompare(b))} label="assignments">{items => <div className="tm-table-scroll"><table className="tm-table"><thead><tr><th>Date</th><th>Assignment</th><th>Action</th></tr></thead><tbody>{items.map(([day, place]) => <tr key={day}><td>{day}</td><td>{place === 'Off' ? 'Day off' : place}</td><td>{day >= today && <button className="tm-text-button" onClick={() => onAssignment(day, null)}>Use home branch</button>}</td></tr>)}</tbody></table></div>}</PagedList></>}
    </section>;
}
