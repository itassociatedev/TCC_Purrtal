import HelpHint from '../../Components/HelpHint.jsx';
// One flat set of controls: no nested filter drawers or separate bordered groups.
export default function TaskFilters({tasks,employee,config,values,onChange,onReset,active,statusChoices=[],status='All Tasks',onStatusChange,showFrequency=true}){
 const {department,branch,priority,assignee,due,sort,from='',to='',frequency='All'}=values;
 const departments=[...new Set(tasks.map(task=>task.department).filter(Boolean))].sort();
 const branches=[...new Set(tasks.map(task=>task.branch).filter(Boolean))].sort();
 const people=[...new Set(tasks.filter(task=>(department==='All'||task.department===department)&&(branch==='All'||task.branch===branch)).map(task=>task.assignee).filter(Boolean))].sort();
 return <div className="tm-list-filter-bar tm-unified-filters" aria-label="Task filters">
 <div className="tm-unified-fields">
 {statusChoices.length>0&&<label>Status<select value={status} onChange={event=>onStatusChange(event.target.value)}>{statusChoices.map(value=><option key={value} value={value}>{value==='All Tasks'?'All statuses':value}</option>)}</select></label>}
 {!employee&&departments.length>1&&<label>Department<select value={department} onChange={event=>onChange('department',event.target.value)}><option value="All">All departments</option>{departments.map(name=><option key={name}>{name}</option>)}</select></label>}
 {branches.length>1&&<label>Branch<select value={branch} onChange={event=>onChange('branch',event.target.value)}><option value="All">All branches</option>{branches.map(name=><option key={name}>{name}</option>)}</select></label>}
 {!employee&&people.length>1&&<label>Person<select value={assignee} onChange={event=>onChange('assignee',event.target.value)}><option value="All">Everyone</option>{people.map(name=><option key={name}>{name}</option>)}</select></label>}
 <label>Priority<select value={priority} onChange={event=>onChange('priority',event.target.value)}><option value="All">All priorities</option>{[...config.priorities].sort((a,b)=>a==='Critical'?-1:b==='Critical'?1:0).map(name=><option key={name}>{name}</option>)}</select></label>
 {showFrequency&&<label>Frequency<select value={frequency} onChange={event=>onChange('frequency',event.target.value)}><option value="All">All frequencies</option><option value="once">One-time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>}
 <label>Deadline<select value={due} onChange={event=>onChange('due',event.target.value)}><option value="All">Any deadline</option><option value="Today">Due today</option><option value="Overdue">Overdue</option></select></label>
 <label>From<input type="date" aria-label="Filter from date" value={from} max={to||undefined} onChange={event=>onChange('from',event.target.value)}/></label>
 <label>To<input type="date" aria-label="Filter to date" value={to} min={from||undefined} onChange={event=>onChange('to',event.target.value)}/></label>
 <label>Sort by<select value={sort} onChange={event=>onChange('sort',event.target.value)}><option value="due">Deadline: earliest</option><option value="priority">Priority: highest</option><option value="newest">Newest first</option><option value="title">Title: A–Z</option></select></label>
 </div><div className="tm-unified-filter-footer"><span>Changes apply automatically.<HelpHint label="Date range help">The date range filters task deadlines. Reports are included when any part of their reporting period falls within the selected dates.</HelpHint></span>{active&&<button type="button" className="tm-text-button" onClick={onReset}>Reset filters</button>}</div></div>;
}
