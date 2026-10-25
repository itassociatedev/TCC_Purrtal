// Routine controls stay visible; optional filters share one compact, expandable area.
export default function TaskFilters({ tasks, employee, config, values, onChange, onReset, active }) {
    const { department, branch, priority, assignee, due, sort } = values;
    const departments = [...new Set(tasks.map(task => task.department).filter(Boolean))];
    const branches = [...new Set(tasks.map(task => task.branch).filter(Boolean))];
    const people = [...new Set(tasks.filter(task => (department === 'All' || task.department === department) && (branch === 'All' || task.branch === branch)).map(task => task.assignee))];
    const advanced = [department, branch, priority, assignee].filter(value => value !== 'All').length;
    return <div className="tm-list-filter-bar" aria-label="Task filters"><div className="tm-filter-basics">
        <label>Deadline<select value={due} onChange={event => onChange('due', event.target.value)}><option value="All">Any deadline</option><option value="Today">Due today</option><option value="Overdue">Overdue</option></select></label>
        <label>Sort by<select value={sort} onChange={event => onChange('sort', event.target.value)}><option value="due">Deadline: earliest first</option><option value="priority">Priority: high first</option><option value="newest">Newest first</option><option value="title">Title: A–Z</option></select></label>
        {active && <button className="tm-text-button" onClick={onReset}>Clear filters</button>}
    </div><details className="tm-advanced-filters"><summary>More filters{advanced > 0 && <span>{advanced} active</span>}</summary><div className="tm-filters">
        {!employee && departments.length > 1 && <label>Department<select value={department} onChange={event => onChange('department', event.target.value)}><option value="All">All departments</option>{departments.map(name => <option key={name}>{name}</option>)}</select></label>}
        {branches.length > 1 && <label>Branch<select value={branch} onChange={event => onChange('branch', event.target.value)}><option value="All">All branches</option>{branches.map(name => <option key={name}>{name}</option>)}</select></label>}
        <label>Priority<select value={priority} onChange={event => onChange('priority', event.target.value)}><option value="All">All priorities</option>{config.priorities.map(name => <option key={name}>{name}</option>)}</select></label>
        {!employee && people.length > 1 && <label>Assignee<select value={assignee} onChange={event => onChange('assignee', event.target.value)}><option value="All">All assignees</option>{people.map(name => <option key={name}>{name}</option>)}</select></label>}
    </div></details></div>;
}
