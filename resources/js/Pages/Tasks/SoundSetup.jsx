import { useEffect, useRef, useState } from 'react';
import { readSoundSettings, saveSoundSettings, soundEvents, soundUrl } from './notificationSounds.mjs';

export default function SoundSetup({ canEdit }) {
    const [settings, setSettings] = useState(readSoundSettings);
    const [message, setMessage] = useState('');
    const audio = useRef(null);
    useEffect(() => () => audio.current?.pause(), []);
    const edit = next => { setSettings(next); setMessage(''); };
    const updateEvent = (key, value) => edit({ ...settings, events: { ...settings.events, [key]: { ...settings.events[key], ...value } } });
    const upload = async (key, file) => {
        if (!file) return;
        if (!/\.(mp3|wav|ogg|m4a|flac)$/i.test(file.name)) { setMessage('Choose an MP3, WAV, OGG, M4A or FLAC audio file.'); return; }
        if (file.size > 250 * 1024) { setMessage('Choose a short sound file no larger than 250 KB.'); return; }
        try {
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            setSettings(previous => ({ ...previous, events: { ...previous.events, [key]: { ...previous.events[key], source: 'upload', file: data, fileName: file.name } } }));
            setMessage('Audio file added. Select Play to preview, then Save sounds.');
        } catch { setMessage('The audio file could not be read. Please try again.'); }
    };
    const preview = async key => {
        audio.current?.pause();
        const url = soundUrl(key, { ...settings, enabled: true, events: { ...settings.events, [key]: { ...settings.events[key], enabled: true } } });
        if (!url) { setMessage('Add an audio file or link first.'); return; }
        audio.current = new Audio(url);
        audio.current.volume = settings.volume / 100;
        try { await audio.current.play(); setMessage(''); }
        catch { setMessage('This sound could not play. Use a public link that opens an audio file directly (MP3, WAV or OGG), not a sharing page. The file must allow playback without signing in.'); }
    };
    const save = event => {
        event.preventDefault();
        try {
            if (soundEvents.some(([key]) => settings.events[key]?.source === 'upload' && !settings.events[key]?.file)) { setMessage('Choose a file for each Upload file selection, or select Default.'); return; }
            saveSoundSettings(settings); setMessage('Sound settings saved.'); }
        catch { setMessage('Settings could not be saved. Check browser storage and try again.'); }
    };
    return <form onSubmit={save}>
        <h3>Task sounds</h3>
        <p>Choose a sound for each task notification. Upload a short audio file or use a direct HTTPS audio link. Choose Default to keep the original sound.</p>
        <p className="tm-form-note">Saved for this browser only. These settings affect Task Module alerts, not IT ticketing or other modules. Sound starts after the user interacts with the page.</p>
        <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="tm-setup-toolbar">
                <label><input type="checkbox" checked={settings.enabled} onChange={e => edit({ ...settings, enabled: e.target.checked })} /> Enable task sounds</label>
                <label>Volume: {settings.volume}%<input type="range" min="0" max="100" value={settings.volume} onChange={e => edit({ ...settings, volume: Number(e.target.value) })} /></label>
            </div>
            <div className="tm-table-scroll"><table className="tm-table"><thead><tr><th>Action / notification</th><th>Enabled</th><th>Sound source</th><th>Preview</th></tr></thead><tbody>
                {soundEvents.map(([key, label]) => <tr key={key}>
                    <td>{label}</td>
                    <td><input aria-label={`Enable ${label} sound`} type="checkbox" checked={settings.events[key]?.enabled !== false} onChange={e => updateEvent(key, { enabled: e.target.checked })} /></td>
                    <td><div style={{ display: 'grid', gap: 8, minWidth: 200 }}>
                        <select aria-label={`${label} sound source`} value={settings.events[key]?.source || (settings.events[key]?.url ? 'link' : 'default')} onChange={e => updateEvent(key, { source: e.target.value })}>
                            <option value="default">Default</option><option value="upload">Upload file</option><option value="link">Audio link</option>
                        </select>
                        {settings.events[key]?.source === 'upload' ? <>
                            <input aria-label={`${label} audio file`} type="file" accept=".mp3,.wav,.ogg,.m4a,.flac" onChange={e => { upload(key, e.target.files?.[0]); e.target.value = ''; }} />
                            <small>{settings.events[key]?.fileName || 'No file selected'} · Maximum 250 KB</small>
                            {settings.events[key]?.file && <button type="button" className="tm-text-button" onClick={() => updateEvent(key, { file: '', fileName: '' })}>Remove file</button>}
                        </> : (settings.events[key]?.source === 'link' || !settings.events[key]?.source && settings.events[key]?.url) && <input aria-label={`${label} sound link`} required type="url" pattern="https://.*" maxLength={2000} placeholder="https://…" value={settings.events[key]?.url || ''} onChange={e => updateEvent(key, { url: e.target.value.trim() })} style={{ width: '100%' }} />}
                    </div></td>
                    <td><button className="tm-secondary" type="button" onClick={() => preview(key)}>Play</button></td>
                </tr>)}
            </tbody></table></div>
            <div className="tm-modal-actions"><button className="tm-secondary" type="button" onClick={() => edit({ enabled: true, volume: 65, events: {} })}>Restore defaults</button><button className="tm-primary" type="submit">Save sounds</button></div>
        </fieldset>
        {message && <p role="status">{message}</p>}
    </form>;
}
