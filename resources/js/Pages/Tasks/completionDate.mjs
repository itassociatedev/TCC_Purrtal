// Use recorded completion evidence and Manila calendar dates for report periods.
export function completionDay(task) {
    const historyDates = (task.history || [])
        .filter(event => /approved|task completed|main task completed/i.test(event.text || ''))
        .map(event => event.at || event.time)
        .filter(value => value && !Number.isNaN(new Date(value).getTime()))
        .sort((a, b) => new Date(b) - new Date(a));
    const candidates = [task.completedAt, task.approvedAt, ...historyDates, task.submittedAt];
    const timestamp = candidates.find(value => value && !Number.isNaN(new Date(value).getTime()));
    if (!timestamp) return null;
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}
