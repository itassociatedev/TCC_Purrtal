import { useState } from 'react';
import { canDeleteTask } from './taskDeletion.mjs';
import { taskHierarchy } from './collaborativeTasks.mjs';

// Deletion is explicit and describes the affected hierarchy before any local records are removed.
export default function DeleteTaskControl({ task, tasks, context, onDelete }) {
    const [confirm, setConfirm] = useState(false);
    const [error, setError] = useState('');
    if (!canDeleteTask(task, tasks, context)) return null;
    const descendants = taskHierarchy(task, tasks).length;
    return <section className="tm-task-delete">{!confirm ? <button type="button" onClick={() => setConfirm(true)}>Delete task</button> : <><p>Delete <strong>{task.title}</strong>{descendants ? ` and its ${descendants} child task${descendants === 1 ? '' : 's'}` : ''}? This removes their saved submissions and follow-ups too.</p>{error && <p role="alert">{error}</p>}<div className="tm-modal-actions"><button type="button" className="tm-secondary" onClick={() => { setConfirm(false); setError(''); }}>Cancel</button><button type="button" className="tm-delete-confirm" onClick={() => { try { onDelete(); } catch (err) { setError(err.message); } }}>Delete permanently</button></div></>}</section>;
}
