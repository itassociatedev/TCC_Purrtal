import { useRef, useState } from 'react';
import { assignmentDirectory } from './assignmentDirectory.mjs';
import { canMonitorCollaborative, childDeadline } from './collaborativeTasks.mjs';

// Keep assignment intent visible: someone either does the work or coordinates another level.
export default function ChildTaskForm({ task, children, config, onCreate, onClose }) {
    const [department, setDepartment] = useState(task.department);
    const [name, setName] = useState('');
    const [mode, setMode] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [branch, setBranch] = useState(task.branch);
    const [due, setDue] = useState(childDeadline(task.due));
    const [dependencies, setDependencies] = useState([]);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState('');
    const titleInput = useRef(null);
    const directory = assignmentDirectory(config);
    const person = directory.find(item => item.name === name);
    const responsibility=mode || (canMonitorCollaborative(person)?'monitoring':'execution');
    const monitoring=responsibility!=='execution';
    const candidates = directory.filter(item => item.department === department && item.name !== task.assignee);
    const allowedBranches = person?.availableBranches || (person ? [person.branch] : [task.branch]);
    const formatDate = value => new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const choosePerson = value => {
        setName(value); setMode(null); setError('');
        const selected = directory.find(item => item.name === value);
        if (selected && !(selected.availableBranches || [selected.branch]).includes(branch)) setBranch(selected.branch);
    };
    const submit = event => {
        event.preventDefault();
        const another = event.nativeEvent.submitter?.value === 'more';
        try {
            if (!person) throw new Error('Choose the person who will receive this task.');
            onCreate({ title, description, assignee: person.name, branch, due, dependsOn: dependencies, taskType: responsibility });
            if (!another) { onClose(); return; }
            setSaved(`Assigned “${title}” to ${person.name}. You can add another task below the same parent.`);
            setTitle(''); setDescription(''); setDependencies([]); setError(''); setName(''); setMode(null);
            titleInput.current?.focus();
        } catch (err) { setError(err.message); }
    };
    return <form className="tm-child-create-form tm-guided-child" onSubmit={submit}>
        <div><h4>Add a task</h4><p className="tm-daily-caption">Under <strong>{task.title}</strong> · reviewed by {task.assignee}</p></div>
        {saved && <p className="tm-child-saved" role="status">✓ {saved}</p>}
        <fieldset className="tm-child-step"><legend>1. What needs to be done?</legend>
            <label>Task title<input ref={titleInput} value={title} onChange={event => setTitle(event.target.value)} required maxLength={40} placeholder="e.g. Check inventory" /><small>{title.length}/40 characters</small></label>
            <label>Instructions<textarea value={description} onChange={event => setDescription(event.target.value)} required rows={3} placeholder="Describe the work and what the person should submit." /></label>
        </fieldset>
        <fieldset className="tm-child-step"><legend>2. Who is responsible?</legend>
            <label>Department<select value={department} onChange={event => { setDepartment(event.target.value); choosePerson(''); }}>{config.departments.map(item => <option key={item}>{item}</option>)}</select></label>
            <label>Assign to<select value={name} required onChange={event => choosePerson(event.target.value)}><option value="">Choose a person</option>{candidates.map(item => <option key={item.name} value={item.name}>{item.name} · {item.position || item.role}</option>)}</select></label>
            {!candidates.length && <p className="tm-daily-caption">No people are available in this department. Choose another department.</p>}
            {person && <><span className="tm-child-choice-label">What will {person.name} do?</span><div className="tm-child-mode" role="radiogroup" aria-label="Assignment responsibility">
                <button type="button" role="radio" aria-checked={responsibility==='execution'} className={responsibility==='execution' ? 'selected' : ''} onClick={() => setMode('execution')}><strong>Do the work</strong><span>Complete this task and submit the result.</span></button>
                <button type="button" role="radio" aria-checked={responsibility==='monitoring'} className={responsibility==='monitoring' ? 'selected' : ''} onClick={() => setMode('monitoring')}><strong>Coordinate others</strong><span>Assign tasks below this one and review their work.</span></button>
            <button type="button" role="radio" aria-checked={responsibility==='both'} className={responsibility==='both' ? 'selected' : ''} onClick={()=>setMode('both')}><strong>Both</strong><span>Do part of the work and coordinate other people.</span></button></div><p className="tm-daily-caption">{responsibility==='both'?'This person submits their own work after reviewing the assignments they give to others.':monitoring ? 'This person can add multiple tasks beneath their assignment.' : 'This is the final work assignment at this level.'}</p></>}
        </fieldset>
        <fieldset className="tm-child-step"><legend>3. Where and when?</legend><div className="tm-form-grid">
            <label>Work branch<select value={branch} onChange={event => setBranch(event.target.value)} required>{allowedBranches.map(item => <option key={item}>{item}</option>)}</select></label>
            <label>Due date<input type="date" value={due} onChange={event => setDue(event.target.value)} max={childDeadline(task.due)} required /></label>
        </div><p className="tm-deadline-hint">Due on or before <strong>{formatDate(childDeadline(task.due))}</strong>, the main task’s deadline.</p></fieldset>
        {children.length > 0 && <details className="tm-child-dependencies"><summary>Wait for another task first? <span>Optional</span></summary><p className="tm-daily-caption">Select only work that must be approved before this task can begin.</p><div className="tm-child-dependency-list">{children.map(child => <label key={child.id}><input type="checkbox" checked={dependencies.includes(child.id)} onChange={event => setDependencies(event.target.checked ? [...dependencies, child.id] : dependencies.filter(id => id !== child.id))} /><span><strong>{child.title}</strong><small>{child.assignee} · Due {formatDate(child.due)}</small></span></label>)}</div></details>}
        {error && <p role="alert" className="tm-rounds-error">{error}</p>}
        <div className="tm-modal-actions"><button type="button" className="tm-secondary" onClick={onClose}>Cancel</button><button type="submit" value="more" className="tm-secondary">Assign & add another</button><button type="submit" value="close" className="tm-primary">Assign task</button></div>
    </form>;
}
