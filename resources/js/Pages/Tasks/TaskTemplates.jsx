import { useState } from 'react';
import { taskFrequencyOptions } from './taskSettings.mjs';

const blankTemplate = priorities => ({
    name: '',
    title: '',
    description: '',
    priority: priorities[Math.min(1, priorities.length - 1)] || 'Medium',
    frequency: 'once',
    link: '',
});

export default function TaskTemplates({ config, onChange, onClose }) {
    const [form, setForm] = useState(null);
    const [error, setError] = useState('');
    const [confirmRemove, setConfirmRemove] = useState(null);
    const templates = config.taskTemplates || [];

    const openForm = template => {
        setError('');
        setConfirmRemove(null);
        setForm(template ? { ...template, original: template.name } : blankTemplate(config.priorities || []));
    };

    const save = event => {
        event.preventDefault();
        try {
            onChange({ entity: 'taskTemplates', action: form.original ? 'edit' : 'add', original: form.original, value: form });
            setForm(null);
            setError('');
        } catch (exception) {
            setError(exception.message || 'The template could not be saved.');
        }
    };

    const remove = () => {
        try {
            onChange({ entity: 'taskTemplates', action: 'remove', original: confirmRemove.name, value: {} });
            setConfirmRemove(null);
            setError('');
        } catch (exception) {
            setError(exception.message || 'The template could not be removed.');
        }
    };

    return <div className="tm-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <section className="tm-modal tm-template-manager" role="dialog" aria-modal="true" aria-labelledby="tm-task-templates-title">
            <header><div><h2 id="tm-task-templates-title">Task templates</h2><p>Save reusable task details to start future assignments faster.</p></div><button type="button" className="tm-icon-button" aria-label="Close task templates" onClick={onClose}>×</button></header>
            <p className="tm-form-note">Templates are saved in this browser’s Task Module workspace. They do not change task permissions or approval requirements.</p>
            {error && <p className="tm-rounds-error" role="alert">{error}</p>}
            {!form && <div className="tm-template-toolbar"><span>{templates.length} saved {templates.length === 1 ? 'template' : 'templates'}</span><button type="button" className="tm-primary" onClick={() => openForm(null)}>Add template</button></div>}
            {confirmRemove && <div className="tm-setup-confirm"><p>Remove <strong>{confirmRemove.name}</strong> from your saved templates?</p><div className="tm-modal-actions"><button type="button" className="tm-secondary" onClick={() => setConfirmRemove(null)}>Cancel</button><button type="button" className="tm-primary" onClick={remove}>Remove template</button></div></div>}
            {form && <form className="tm-template-form" onSubmit={save}>
                <label>Template name<input autoFocus required maxLength={80} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="e.g. Weekly stock check" /></label>
                <label>Task title<input required maxLength={40} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="What needs to be done?" /><small>{form.title.length}/40 characters</small></label>
                <label className="tm-template-description">Description<textarea rows={3} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Instructions and expected result" /></label>
                <label>Default priority<select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}>{(config.priorities || []).map(priority => <option key={priority}>{priority}</option>)}</select></label>
                <label>Default frequency<select value={form.frequency} onChange={event => setForm({ ...form, frequency: event.target.value })}>{taskFrequencyOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label className="tm-template-reference">Reference link <span>(optional)</span><input type="url" value={form.link} onChange={event => setForm({ ...form, link: event.target.value })} placeholder="https://…" /></label>
                <div className="tm-modal-actions"><button type="button" className="tm-secondary" onClick={() => { setForm(null); setError(''); }}>Cancel</button><button type="submit" className="tm-primary">Save template</button></div>
            </form>}
            {!form && <div className="tm-template-list">{templates.length ? templates.map(template => <article key={template.name}>
                <div><strong>{template.name}</strong><p>{template.title}</p><small>{taskFrequencyOptions.find(option => option.value === template.frequency)?.label || 'One-time'} · {template.priority}{template.link ? ' · Reference link included' : ''}</small></div>
                <div className="tm-template-actions"><button type="button" className="tm-text-button" onClick={() => openForm(template)}>Edit</button><button type="button" className="tm-text-button tm-template-remove" onClick={() => setConfirmRemove(template)}>Remove</button></div>
            </article>) : <p className="tm-template-empty">No templates yet. Add one to save task details you use often.</p>}</div>}
        </section>
    </div>;
}
