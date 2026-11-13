import { routeTaskApproval } from './taskApproval.mjs';
import { assignmentDirectory } from './assignmentDirectory.mjs';

export default function SelfTaskApprover({ config, scope, branch }) {
    let request;
    try {
        request = routeTaskApproval({
            template: 'standard', kind: 'Self-created request',
            assignee: scope.actor, branch, department: scope.department,
        }, config, scope);
    } catch {
        return <div className="tm-self-approver" role="status">
            <strong>Approver unavailable</strong>
            <span>No higher-up is configured for this department and branch. Ask Admin to check Workspace Setup before submitting.</span>
        </div>;
    }
    const reviewer = assignmentDirectory(config).find(person => person.name === request.approvalReviewer);
    return <div className="tm-self-approver" role="status" aria-live="polite">
        <small>Approval before starting</small>
        <strong>{request.approvalRequired ? request.approvalReviewer : 'No approval required'}</strong>
        {request.approvalRequired && <span>{reviewer?.position || request.approvalReviewerRole} · {branch}</span>}
    </div>;
}
