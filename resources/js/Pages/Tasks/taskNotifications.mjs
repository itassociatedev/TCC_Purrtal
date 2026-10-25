import { isOverdue } from './taskFilters.mjs';

export const notificationStorageKey = key => `${key}-notifications`;
// Keep hidden records for other preview recipients and to prevent old overdue alerts from reappearing.
export function clearNotificationHistory(notifications, ids, identity) {
    const selected = new Set(ids);
    return notifications.map(item => selected.has(item.id) ? { ...item, readBy: [...new Set([...(item.readBy || []), identity])], clearedBy: [...new Set([...(item.clearedBy || []), identity])] } : item);
}
export function notificationForTask(task, action, description) {
    return { id: crypto.randomUUID(), taskId: task.id, template: task.template, coordinator: task.coordinator, coordinators: task.coordinators, originDepartment: task.originDepartment, originBranch: task.originBranch, title: task.title, action, description, assignee: task.assignee, department: task.department, branch: task.branch, createdAt: new Date().toISOString(), readBy: [] };
}
// Compare saved state instead of button clicks, so generated assignments and every report form share one path.
export function taskNotificationChanges(previous, current, actor = {}) {
    const before = new Map(previous.map(task => [task.id, task]));
    const events = [];
    for (const task of current) {
        const old = before.get(task.id);
        if (old) {
            const oldPings = new Map((old.pings || []).map(ping => [ping.id, ping]));
            for (const ping of task.pings || []) {
                const previousPing = oldPings.get(ping.id);
                if (!previousPing) events.push(notificationForTask(task, 'Follow-up · Acknowledgement requested', `${ping.sender} (${ping.senderRole}): ${ping.message}`));
                else if (!previousPing.acknowledgedAt && ping.acknowledgedAt) events.push(notificationForTask(task, 'Follow-up acknowledged', `${ping.acknowledgedBy} acknowledged the follow-up from ${ping.sender}.`));
            }
        }
        let action, description;
        if (!old) {
            action = task.status === 'Pending Approval' ? 'Task requested' : 'New task';
            description = `Assigned to ${task.assignee} · Due ${task.due} · ${task.branch}.`;
        } else if (task.status !== old.status) {
            const statuses = { 'Pending Review': 'Submitted for review', 'Pending Approval': 'Task requested', Completed: 'Task approved', Denied: 'Task denied', 'Revision Needed': 'Revision requested', 'Not Started': 'Task approved', 'In Progress': task.correcting ? 'Report reopened' : 'Task started' };
            // Draft saves are intentionally quiet; actual submissions and reviewer decisions notify.
            if (task.status === 'In Progress' && /draft saved/i.test(task.history?.[0]?.text || '')) continue;
            action = statuses[task.status] || 'Task updated';
            description = task.remarks?.trim() || `${task.assignee} · ${task.department} · ${task.branch}.`;
        } else if (task.assignee !== old.assignee || task.branch !== old.branch) {
            action = 'Assignment updated'; description = `Assigned to ${task.assignee} at ${task.branch}.`;
        } else if (task.due !== old.due) {
            action = 'Deadline updated'; description = `New due date: ${task.due}.`;
        } else if (task.title !== old.title || task.description !== old.description || task.priority !== old.priority) {
            action = 'Task updated'; description = `${task.assignee} · ${task.priority} priority · Due ${task.due}.`;
        }
        if (action) events.push(notificationForTask(task, action, description));
    }
    return events.map(event => ({ ...event, actor: actor.name, actorRole: actor.role }));
}
export function publishTaskNotifications(storageKey, events) {
    if (!events.length) return;
    const key = notificationStorageKey(storageKey);
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    const existing = new Set(saved.map(item => item.dedupeKey).filter(Boolean));
    const fresh = events.filter(item => !item.dedupeKey || !existing.has(item.dedupeKey));
    if (!fresh.length) return;
    localStorage.setItem(key, JSON.stringify([...fresh.reverse(), ...saved].slice(0, 500)));
    window.dispatchEvent(new CustomEvent('task-notifications-updated', { detail: { key, events: fresh } }));
}
export function overdueNotifications(tasks, today) {
    return tasks.filter(task => isOverdue(task, today)).map(task => ({ ...notificationForTask(task, 'Task overdue', `${task.assignee} · Due ${task.due} · ${task.branch}.`), dedupeKey: `overdue:${task.id}:${task.due}` }));
}

// Describe the action relative to the viewer, rather than presenting feedback as praise for everyone.
export function notificationPresentation(event, scope) {
    const viewer = scope.role === 'Employee' ? scope.employee : scope.actor;
    const ownAction = Boolean(viewer && event.actor === viewer);
    const ownsTask = Boolean(viewer && event.assignee === viewer);
    const subject = ownAction ? 'You' : event.actor ? `${event.actor}${event.actorRole ? ` (${event.actorRole})` : ''}` : null;
    const target = ownsTask ? 'your task' : `the task assigned to ${event.assignee || 'the assignee'}`;
    const verbs = {
        'Task approved': 'approved', 'Task denied': 'denied', 'Revision requested': 'requested revisions to',
        'Submitted for review': 'submitted', 'Task requested': 'requested', 'Task started': 'started',
        'Report reopened': 'reopened', 'Assignment updated': 'updated the assignment for',
        'Deadline updated': 'updated the deadline for', 'Task updated': 'updated', 'New task': 'created',
    };
    const verb = verbs[event.action];
    if (!verb) return event;
    const decisions = ['Task approved', 'Task denied', 'Revision requested'].includes(event.action);
    const description = subject ? `${subject} ${verb} ${target}${event.action === 'Submitted for review' ? ' for review' : ''}.` : `${event.action}: ${target}.`;
    const detail = event.description?.trim();
    return { ...event,
        action: ownAction ? `${event.action} · By you` : event.action,
        description: `${description}${detail ? ` ${decisions ? 'Reviewer remarks: ' : 'Details: '}${detail}` : ''}`,
    };
}

// Preview users can receive events created while a different role was selected in this session.
// Historical alerts present when the page opened must not all appear as new push notifications.
export function pendingPreviewNotifications(events, baselineIds, deliveredIds, identity) {
    return events.filter(event => !baselineIds.has(event.id) && !deliveredIds.has(event.id)
        && !event.readBy?.includes(identity) && !event.clearedBy?.includes(identity));
}
