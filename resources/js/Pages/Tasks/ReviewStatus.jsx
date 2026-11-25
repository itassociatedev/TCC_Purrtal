import './review-status.css';

const states = {
    'Not Started': { tone: 'idle', symbol: '→', label: 'Not started' },
    'In Progress': { tone: 'progress', symbol: '→', label: 'In progress' },
    'Dismissed': { tone: 'idle', symbol: '−', label: 'Dismissed' },
    'Pending Review': { tone: 'pending', symbol: '↻', label: 'Pending review' },
    'Pending Approval': { tone: 'pending', symbol: '↻', label: 'Pending approval' },
    'Denied': { tone: 'denied', symbol: '×', label: 'Denied' },
    'Revision Needed': { tone: 'revision', symbol: '↶', label: 'Return for revision' },
    'Completed': { tone: 'approved', symbol: '✓', label: 'Approved' },
    'Approved': { tone: 'approved', symbol: '✓', label: 'Approved' },
};

export const isReviewStatus = status => Object.hasOwn(states, status);

export default function ReviewStatus({ status }) {
    const state = states[status];
    if (!state) return <span>{status}</span>;

    return (
        <span className={`tm-review-arrow tm-review-arrow--${state.tone}`}>
            <span className="tm-review-arrow-symbol" aria-hidden="true">{state.symbol}</span>
            <span>{state.label}</span>
        </span>
    );
}
