import { useState } from 'react';
import './person-picker.css';

export default function PersonPicker({ people, value, onChoose, disabled, branch, branches, onBranch, branchDisabled, label = 'Assign to person', showTaskBranch = true }) {
    const [search, setSearch] = useState('');
    const [department, setDepartment] = useState('');
    const [workBranch, setWorkBranch] = useState('');
    const departments = [...new Set(people.map(person => person.department))].sort();
    const workBranches = [...new Set(people.flatMap(person => person.availableBranches || [person.branch]))].filter(Boolean).sort();
    const selected = people.find(person => person.name === value);
    const query = search.trim().toLocaleLowerCase();
    const results = people.filter(person =>
        (!department || person.department === department)
        && (!workBranch || (person.availableBranches || [person.branch]).includes(workBranch))
        && [person.name, person.position, person.role, person.department, ...(person.availableBranches || [person.branch])]
            .join(' ').toLocaleLowerCase().includes(query)
    ).sort((a, b) => a.department.localeCompare(b.department) || (a.position || '').localeCompare(b.position || '') || a.name.localeCompare(b.name));
    const availableBranches = (selected?.availableBranches || [selected?.branch])
        .filter(name => name && branches.includes(name));

    return <div className="tm-person-picker">
        {!disabled && <label>{label}
            <input type="search" value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search a name, job title or department" autoComplete="off" />
        </label>}
        {!disabled && <>
            <div className="tm-person-browse">
                <label>Department<select value={department} onChange={event => setDepartment(event.target.value)}>
                    <option value="">All departments</option>
                    {departments.map(name => <option key={name}>{name}</option>)}
                </select></label>
                <label>Works at<select value={workBranch} onChange={event => setWorkBranch(event.target.value)}>
                    <option value="">All branches</option>
                    {workBranches.map(name => <option key={name}>{name}</option>)}
                </select></label>
            </div>
            <small className="tm-person-result-count">{results.length} {results.length === 1 ? 'person' : 'people'}</small>
            <div className="tm-person-picker-results" aria-label="Matching people">
            {results.map(person => <button type="button" key={person.id || person.name}
                aria-pressed={person.name === value}
                onClick={() => { onChoose(person); setSearch(''); }}>
                <strong>{person.name}</strong>
                <small>{person.position || person.role} · {person.department}</small>
                <small>{(person.availableBranches || [person.branch]).join(', ')}</small>
            </button>)}
            {!results.length && <p>No people match. <button type="button" onClick={() => { setSearch(''); setDepartment(''); setWorkBranch(''); }}>Clear search and filters</button></p>}
        </div></>}
        {selected && <div className="tm-person-picker-selected"  aria-live="polite">
            <strong>{selected.name}</strong>
            <span>{selected.position || selected.role} · {selected.department}</span>
            <small>Works at {(selected.availableBranches || [selected.branch]).join(', ')}</small>
        </div>}
        {selected && showTaskBranch && <div className="tm-person-branches" role="group" aria-label="Task branch">
            <span>Task branch</span>
            {availableBranches.map(name => <button type="button" key={name}
                aria-pressed={branch === name} disabled={branchDisabled}
                onClick={() => onBranch(name)}>{name}</button>)}
        </div>}
    </div>;
}
