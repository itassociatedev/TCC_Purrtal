import {useState} from 'react';
import PagedList from './PagedList.jsx';

export default function TeamProgressCards({participants,index,employeeByName,overdueCounts,avatar,overdueBadge}) {
 const [search,setSearch]=useState('');
 const people=participants.filter(name=>`${name} ${employeeByName(name)?.department || ''} ${employeeByName(name)?.branch || ''}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>a.localeCompare(b));
 return <><div className="tm-progress-search"><label>Find a team member<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, department or branch"/></label><span>{people.length} {people.length===1?'person':'people'}</span></div><PagedList items={people} label="people" initialSize={10} resetKey={search+participants.join('|')}>{page=><div className="tm-progress-people-grid">{page.map(name=>{
  const tasks=index.byAssignee.get(name)||[],done=tasks.filter(task=>task.status==='Completed').length,active=tasks.filter(task=>task.status==='In Progress').length;
  const percent=tasks.length?Math.round(done/tasks.length*100):0,person=employeeByName(name);
  return <article className="tm-progress-person" key={name}><header>{avatar(name)}<div><h3>{name}</h3><p>{[person?.department,person?.branch].filter(Boolean).join(' · ') || 'Shared team work'}</p></div>{overdueBadge(name,overdueCounts[name])}</header><div className="tm-progress-person-total"><span>{done} of {tasks.length} completed</span><strong>{percent}%</strong></div><div className="tm-track" role="progressbar" aria-label={`${name} task completion`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{width:`${percent}%`}}/></div><footer><span><i className="tm-progress-dot"/>{active} in progress</span><span className={overdueCounts[name]?'tm-late-text':''}>{overdueCounts[name]||0} overdue</span></footer></article>;
 })}{!people.length&&<div className="tm-dashboard-empty"><strong>{search?'No matching team members':'No tasks assigned yet'}</strong><p>{search?'Try another name, department or branch.':'Team progress will appear here as tasks are assigned.'}</p></div>}</div>}</PagedList></>;
}
