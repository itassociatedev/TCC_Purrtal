// A submission is finished by its author but still has a separate review outcome.
export function reportStatus(status) {
    return ({
        'Not Started': { label: 'Not done', tone: 'not-done', icon: 'clock' },
        'In Progress': { label: 'Not done · In progress', tone: 'in-progress', icon: 'clock' },
        'Pending Review': { label: 'Done · For review', tone: 'for-review', icon: 'clock' },
        'Pending Approval': { label: 'For approval', tone: 'for-review', icon: 'clock' },
        Completed: { label: 'Done · Approved', tone: 'approved', icon: 'check' },
        Dismissed: { label: 'Dismissed · No report required', tone: 'denied', icon: 'close' },
        Denied: { label: 'Denied', tone: 'denied', icon: 'close' },
        'Revision Needed': { label: 'Needs revision', tone: 'revision', icon: 'tasks' },
    })[status] || { label: status || 'Not done', tone: 'not-done', icon: 'clock' };
}
