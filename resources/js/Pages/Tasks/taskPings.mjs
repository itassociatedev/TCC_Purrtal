const actorName = context => context.role === 'Employee' ? context.employee : context.actor;
// Follow-ups respect the same department/branch boundaries as the manager's task view.
export function canPingTask(task, context) {
    if (!task.assignee || ['Completed', 'Denied'].includes(task.status)) return false;
    return context.role === 'EVP' || context.role === 'Team Leader' && (task.department === context.department || task.originDepartment === context.department)
        || context.role === 'Operations Manager' && (task.branch === context.branch || task.originBranch === context.branch);
}
export const canAcknowledgePing = (task, ping, context) => Boolean(actorName(context))
    && actorName(context) === task.assignee && actorName(context) === ping.assignee && !ping.acknowledgedAt;
export function sendTaskPing(task, context, message) {
    if (!canPingTask(task, context)) throw new Error('Only the responsible Team Leader, branch OM, or EVP can follow up on this task.');
    const text = message.trim();
    if (!text || text.length > 500) throw new Error('Enter a follow-up message of up to 500 characters.');
    return [...(task.pings || []), { id: crypto.randomUUID(), message: text, assignee: task.assignee, sender: context.sender, senderRole: context.role, createdAt: new Date().toISOString(), acknowledgedAt: null }];
}
export function acknowledgeTaskPing(task, pingId, context) {
    const ping = task.pings?.find(item => item.id === pingId);
    if (!ping || !canAcknowledgePing(task, ping, context)) throw new Error('Only the assigned employee can acknowledge this follow-up.');
    return task.pings.map(item => item.id === pingId ? { ...item, acknowledgedAt: new Date().toISOString(), acknowledgedBy: actorName(context) } : item);
}
// Validate writes too: an actor can only append their own ping or acknowledge an existing addressed ping.
export function validPingChange(task, next, context) {
    const previous = task.pings || [];
    if (!Array.isArray(next)) return false;
    if (next.length === previous.length + 1) {
        const added = next.at(-1);
        return canPingTask(task, context) && previous.every((ping, i) => JSON.stringify(ping) === JSON.stringify(next[i]))
            && added.assignee === task.assignee && added.sender === context.sender && added.senderRole === context.role && !added.acknowledgedAt && Boolean(added.message?.trim()) && added.message.length <= 500;
    }
    const changed = previous.filter((ping, i) => JSON.stringify(ping) !== JSON.stringify(next[i]));
    if (next.length !== previous.length || changed.length !== 1) return false;
    const original = changed[0], updated = next.find(ping => ping.id === original.id);
    return Boolean(updated && canAcknowledgePing(task, original, context) && updated.acknowledgedAt && updated.acknowledgedBy === actorName(context)
        && JSON.stringify({ ...updated, acknowledgedAt: original.acknowledgedAt, acknowledgedBy: original.acknowledgedBy }) === JSON.stringify({ ...original, acknowledgedBy: original.acknowledgedBy }));
}
