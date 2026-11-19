export const soundEvents = [
    ['created', 'Task created', 'task_created.wav'],
    ['submitted', 'Work submitted', 'task_submitted.mp3'],
    ['approved', 'Task approved / completed', 'task_approved.mp3'],
    ['denied', 'Request denied', 'task_denied.wav'],
    ['revision', 'Task returned', 'task_revision.flac'],
    ['overdue', 'Task overdue', 'task_overdue.wav'],
    ['ping', 'Follow-ups and reminders', 'task_ping.wav'],
    ['handover', 'Handover updates', 'task_ping.wav'],
    ['started', 'Task started', 'task_created.wav'],
];
const settingsKey = 'tcc-task-sound-settings-v1';
export function readSoundSettings() {
    try { return { enabled: true, volume: 65, events: {}, ...JSON.parse(localStorage.getItem(settingsKey) || '{}') }; }
    catch { return { enabled: true, volume: 65, events: {} }; }
}
export function saveSoundSettings(settings) {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
}
export function soundEventKey(action = '') {
    if (/denied/i.test(action)) return 'denied';
    if (/revision|returned/i.test(action)) return 'revision';
    if (/overdue/i.test(action)) return 'overdue';
    if (/follow-up|ping|acknowledg/i.test(action)) return 'ping';
    if (/approved|completed/i.test(action)) return 'approved';
    if (/submitted/i.test(action)) return 'submitted';
    if (/handover|turnover/i.test(action)) return 'handover';
    if (/started/i.test(action)) return 'started';
    if (/new task|task requested|task created/i.test(action)) return 'created';
    return null;
}
export function normalizeSoundLink(value = '') {
    try {
        const url = new URL(value.trim());
        if (url.protocol !== 'https:') return null;
        if (url.hostname === 'www.dropbox.com' || url.hostname === 'dropbox.com') { url.searchParams.delete('dl'); url.searchParams.set('raw', '1'); }
        return url.toString();
    } catch { return null; }
}
export function soundUrl(key, settings = readSoundSettings()) {
    const entry = settings.events?.[key] || {};
    if (!settings.enabled || entry.enabled === false) return null;
    const source = entry.source || (entry.url ? 'link' : 'default');
    if (source === 'upload') return entry.file || null;
    if (source === 'link') return normalizeSoundLink(entry.url);
    return (soundEvents.find(row => row[0] === key)?.[2] ? `/sounds/tasks/${soundEvents.find(row => row[0] === key)[2]}` : null);
}
// Match action names before viewer-specific wording is added to a notification.
export function notificationSound(action = '') {
    if (/denied/i.test(action)) return 'task_denied.wav';
    if (/revision/i.test(action)) return 'task_revision.flac';
    if (/overdue/i.test(action)) return 'task_overdue.wav';
    if (/follow-up|ping|acknowledg/i.test(action)) return 'task_ping.wav';
    if (/approved/i.test(action)) return 'task_approved.mp3';
    if (/submitted/i.test(action)) return 'task_submitted.mp3';
    if (/new task|task requested/i.test(action)) return 'task_created.wav';
    return null;
}

// Native audio playback supports remote audio without requiring fetch/CORS permission.
export function createNotificationSoundPlayer() {
    let unlocked = false, audio = null, disposed = false;
    const unlock = () => { unlocked = true; };
    const play = async events => {
        const settings = readSoundSettings();
        const file = events.map(event => soundUrl(soundEventKey(event.action), settings)).find(Boolean);
        if (!file || !unlocked || disposed) return;
        audio?.pause();
        audio = new Audio(file);
        audio.preload = 'auto';
        audio.volume = Math.min(1, Math.max(0, Number(settings.volume) / 100));
        try { await audio.play(); }
        catch { /* Missing audio must never block task notifications. */ }
    };
    return { unlock, play, destroy() { disposed = true; audio?.pause(); audio = null; } };
}
