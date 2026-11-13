import PersonPicker from './PersonPicker.jsx';
import { childDeadline, canMonitorCollaborative, canOwnCollaborative } from './collaborativeTasks.mjs';

export default function CollaborationCreateFields({ config, people, assignment, onAssignment, today, branches }) {
    const owners = people.filter(canOwnCollaborative);
    const coordinators = people.filter(canMonitorCollaborative);
    const step = assignment.collabStep || 1;
    const due = assignment.due || today;
    const countTitle = event => {
        event.currentTarget.setCustomValidity('');
        event.currentTarget.nextElementSibling.textContent = `${event.currentTarget.value.length}/40 characters`;
    };

    return <>
        <input type="hidden" name="kind" value="Assigned task" />
        <input type="hidden" name="mainOwner" value={assignment.mainOwner || ''} />
        <div className="tm-collab-page" hidden={step !== 1}>
        <fieldset className="tm-create-section tm-create-assignment">
            <legend>Who & where</legend>
            <PersonPicker label="Final owner / approver" people={owners}
                value={assignment.mainOwner || ''} branches={branches} showTaskBranch={false}
                onChoose={person => onAssignment({ mainOwner: person.name })} />
            <p className="tm-collab-person-help">Reviews the final result and closes the workflow.</p>

        </fieldset>
        <fieldset className="tm-create-section tm-create-details">
            <legend>What needs doing</legend>
            <label>Overall task title<input name="title" required maxLength={40}
                placeholder="What needs to be done?" onInput={countTitle} /><small>0/40 characters</small></label>
            <label>Description<textarea name="description" required rows={3} onInput={event => event.currentTarget.setCustomValidity('')}
                placeholder="Describe the final result and expected output." /></label>
            <div className="tm-create-reference">
                <label>Reference / attachment link <span>(optional)</span>
                    <input name="link" type="url" placeholder="https://…" /></label>
            </div>

        </fieldset>
        <fieldset className="tm-create-section tm-create-schedule">
            <legend>When & priority</legend>
            <div className="tm-form-grid">
                <label>Priority<select name="priority" defaultValue={config.priorities.includes('Medium') ? 'Medium' : config.priorities[0]}>
                    {config.priorities.map(priority => <option key={priority}>{priority}</option>)}
                </select></label>
                <label>Final deadline<input type="date" name="due" required min={today} value={due}
                    onChange={event => onAssignment({ due: event.target.value })} /></label>

            </div>
        </fieldset>
        </div>
        <div className="tm-collab-page" hidden={step !== 2}>
            <fieldset className="tm-create-section tm-create-assignment">
                <legend>Coordinator</legend>
            <PersonPicker label="Coordinator" people={coordinators} value={assignment.name}
                branches={branches} branch={assignment.branch}
                onBranch={branch => onAssignment({ branch })}
                onChoose={person => onAssignment({
                    name: person.name, department: person.department,
                    branch: (person.availableBranches || [person.branch]).includes(assignment.branch)
                        ? assignment.branch : person.branch,
                })} />
            <p className="tm-collab-person-help">Coordinates the work and delegates child assignments.</p>
            </fieldset>
            <fieldset className="tm-create-section tm-create-details">
                <legend>Coordinator’s assignment</legend>
            <div className="tm-collab-coordinator-details">
                <label>Coordinator’s task title<input name="monitoringTitle" required maxLength={40}
                    placeholder="What should the coordinator do?" onInput={countTitle} /><small>0/40 characters</small></label>
                <label>Coordinator’s instructions<textarea name="monitoringDescription" required rows={3}
                    placeholder="Describe what to coordinate, check and submit." /></label>
            </div>                <label>Coordinator’s deadline<input key={due} name="monitoringDue" type="date"
                    required min={today} max={childDeadline(due)} defaultValue={childDeadline(due)} /></label>
            </fieldset>
        </div>


    </>;
}
