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

// Browsers require a user interaction before sound can start. Never replay old alerts on unlock.
export function createNotificationSoundPlayer() {
    let context, source, disposed = false, sequence = 0;
    const buffers = new Map();
    const unlock = () => {
        if (disposed) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        context ||= new AudioContext();
        if (context.state === 'suspended') context.resume().catch(() => {});
    };
    const play = async events => {
        const file = events.map(event => notificationSound(event.action)).find(Boolean);
        if (!file || !context || context.state !== 'running' || disposed) return;
        const current = ++sequence;
        try {
            // Cache decoded audio; one sound per batch avoids a burst of overlapping daily assignments.
            if (!buffers.has(file)) buffers.set(file, fetch(`/sounds/tasks/${file}`).then(response => {
                if (!response.ok) throw new Error('Sound unavailable');
                return response.arrayBuffer();
            }).then(data => context.decodeAudioData(data)));
            const buffer = await buffers.get(file);
            if (disposed || current !== sequence || context.state !== 'running') return;
            source?.stop();
            source = context.createBufferSource();
            const volume = context.createGain();
            volume.gain.value = 0.65;
            source.buffer = buffer;
            source.connect(volume);
            volume.connect(context.destination);
            source.start();
        } catch { buffers.delete(file); /* A missing or unsupported sound must never interrupt notifications. */ }
    };
    return { unlock, play, destroy() {
        disposed = true;
        sequence++;
        source?.stop();
        if (context && context.state !== 'closed') context.close().catch(() => {});
    } };
}
