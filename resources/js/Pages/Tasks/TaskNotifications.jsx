import { createNotificationSoundPlayer } from './notificationSounds.mjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tasksForPreview } from './taskDirectory.mjs';
import { notificationStorageKey, clearNotificationHistory, notificationPresentation, pendingPreviewNotifications } from './taskNotifications.mjs';
import PagedList from './PagedList.jsx';

function AlertIcon({ action }) {
    return <span className={`tm-alert-icon ${/denied|overdue/i.test(action) ? 'tm-alert-danger' : /approved/i.test(action) ? 'tm-alert-success' : 'tm-alert-info'}`} aria-hidden="true">{/denied/i.test(action) ? '×' : /approved/i.test(action) ? '✓' : /overdue|revision/i.test(action) ? '!' : '↗'}</span>;
}
function SideAlert({ event, onDismiss, onOpen }) {
    const [paused, setPaused] = useState(false);
    useEffect(() => { if (paused) return; const timer = setTimeout(() => onDismiss(event.id), 7000); return () => clearTimeout(timer); }, [paused, event.id, onDismiss]);
    return <article className="tm-side-alert" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}><AlertIcon action={event.action} /><div><p className="tm-alert-action">{event.action}</p><h3>{event.title}</h3><p>{event.description}</p>{event.action !== 'Task deleted' && <button type="button" onClick={() => onOpen(event)}>View task</button>}</div><button type="button" className="tm-alert-close" aria-label="Dismiss notification" onClick={() => onDismiss(event.id)}>×</button></article>;
}
// This center uses the same local workspace as tasks. Preview read states are separate for each role/scope.
export default function TaskNotifications({ storageKey, scope, onOpen, taskLookup, portalNotifications = [], portalUnreadCount = 0, onPortalRead, onPortalReadAll, onPortalClear, onPortalLoadMore, portalHasMore = false, portalLoading = false }) {
    const key = notificationStorageKey(storageKey);
    // Access-policy metadata must not reset an existing person's read/dismissal history.
    const { roleName, itDepartment, ...recipientScope } = scope;
    const identity = JSON.stringify(recipientScope);
    const load = () => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
    const [notifications, setNotifications] = useState(load);
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState('Tasks');
    const [confirmClear, setConfirmClear] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [clearError, setClearError] = useState('');
    const [alerts, setAlerts] = useState([]);
    const root = useRef(null);
    // Track push delivery per preview identity, independently from the bell's unread state.
    const previewDelivery = useRef({ key, baseline: new Set(notifications.map(item => item.id)), shown: new Map() });
    const soundPlayer = useRef(null);
    useEffect(() => {
        const player = createNotificationSoundPlayer();
        soundPlayer.current = player;
        window.addEventListener('pointerdown', player.unlock);
        window.addEventListener('keydown', player.unlock);
        return () => {
            window.removeEventListener('pointerdown', player.unlock);
            window.removeEventListener('keydown', player.unlock);
            player.destroy();
            soundPlayer.current = null;
        };
    }, []);
    const relevant = events => tasksForPreview(events.map(event => { const task = taskLookup?.get(event.taskId); return task ? { ...event, template: task.template } : event; }), scope).filter(item => !item.clearedBy?.includes(identity)).map(item => notificationPresentation(item, scope));
    useEffect(() => {
        const refresh = event => {
            if (event.type === 'storage' && event.key !== key || event.type !== 'storage' && event.detail?.key !== key) return;
            const next = load(); setNotifications(next);
            // Storage events carry no custom payload; compare IDs to identify only newly added records.
            let fresh = event.detail?.events || [];
            if (event.type === 'storage') {
                try {
                    const previousIds = new Set(JSON.parse(event.oldValue || '[]').map(item => item.id));
                    fresh = next.filter(item => !previousIds.has(item.id));
                } catch { fresh = []; }
            }
            const delivered = previewDelivery.current.shown.get(identity) || new Set();
            const incoming = pendingPreviewNotifications(relevant(fresh), new Set(), delivered, identity);
            incoming.forEach(item => delivered.add(item.id));
            previewDelivery.current.shown.set(identity, delivered);
            if (incoming.length) setAlerts(previous => [...incoming, ...previous].slice(0, 3));
            soundPlayer.current?.play(incoming);
        };
        window.addEventListener('task-notifications-updated', refresh); window.addEventListener('storage', refresh);
        return () => { window.removeEventListener('task-notifications-updated', refresh); window.removeEventListener('storage', refresh); };
    }, [key, identity, taskLookup, roleName, itDepartment]);
    useEffect(() => {
        const current = load();
        setNotifications(current);
        if (previewDelivery.current.key !== key) {
            previewDelivery.current = { key, baseline: new Set(current.map(item => item.id)), shown: new Map() };
        }
        const delivery = previewDelivery.current;
        const delivered = delivery.shown.get(identity) || new Set();
        const pending = pendingPreviewNotifications(relevant(current), delivery.baseline, delivered, identity);
        pending.forEach(item => delivered.add(item.id));
        delivery.shown.set(identity, delivered);
        setAlerts(pending.slice(0, 3));
        setOpen(false);
        setConfirmClear(false);
        soundPlayer.current?.play(pending);
    }, [key, identity, roleName, itDepartment]);
    useEffect(() => {
        if (!open) return;
        const close = event => { if (event.key === 'Escape' || event.type === 'pointerdown' && !root.current?.contains(event.target)) setOpen(false); };
        document.addEventListener('pointerdown', close); document.addEventListener('keydown', close);
        return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
    }, [open]);
    const items = useMemo(() => relevant(notifications), [notifications, identity, taskLookup, roleName, itDepartment]);
    const taskUnread = items.filter(item => !item.readBy?.includes(identity)).length;
    const unread = taskUnread + portalUnreadCount;
    const displayed = tab === 'Tasks' ? items : portalNotifications.map(item => ({ id: item.id, action: 'Portal notification', title: item.data?.message || 'Notification', description: item.data?.user_email || item.data?.details || '', createdAt: item.created_at, portal: true, isRead: Boolean(item.read_at), url: item.data?.action_url }));
    const markRead = ids => {
        const next = load().map(item => ids.includes(item.id) ? { ...item, readBy: [...new Set([...(item.readBy || []), identity])] } : item);
        try { localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new CustomEvent('task-notifications-updated', { detail: { key, events: [] } })); } catch {}
        setNotifications(next);
    };
    const clearCurrentTab = async () => {
        setClearing(true); setClearError('');
        try {
            if (tab === 'Others') await onPortalClear();
            else {
                const next = clearNotificationHistory(load(), items.map(item => item.id), identity);
                localStorage.setItem(key, JSON.stringify(next));
                setNotifications(next); setAlerts([]);
                window.dispatchEvent(new CustomEvent('task-notifications-updated', { detail: { key, events: [] } }));
            }
            setConfirmClear(false);
        } catch { setClearError('Could not clear notifications. Please try again.'); }
        finally { setClearing(false); }
    };
    const show = event => { if (event.portal) { setOpen(false); onPortalRead?.(event.id, event.url); return; } markRead([event.id]); setOpen(false); setAlerts(previous => previous.filter(item => item.id !== event.id)); if (event.action !== 'Task deleted') onOpen(event.taskId); };
    const dismiss = useCallback(id => setAlerts(previous => previous.filter(item => item.id !== id)), []);
    return <div className="tm-notification-root" ref={root}><button type="button" className="tm-notification-bell" aria-label={`Notifications: ${taskUnread} tasks and ${portalUnreadCount} others unread`} aria-expanded={open} onClick={() => setOpen(!open)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg></button><div className="tm-notification-counts" aria-label="Unread notifications by category"><button type="button" className="tm-task-count" aria-label={`${taskUnread} unread task notifications`} onClick={() => { setTab('Tasks'); setOpen(true); }}><span>Tasks</span><b>{taskUnread}</b></button><button type="button" className="tm-other-count" aria-label={`${portalUnreadCount} unread other notifications`} onClick={() => { setTab('Others'); setOpen(true); }}><span>Others</span><b>{portalUnreadCount}</b></button></div>
        {open && <section className="tm-notification-panel" aria-label="Notifications"><header><div><h2>Notifications</h2><small>{unread} unread</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Close notifications">×</button></header>
            <div className="tm-notification-tabs" role="tablist" aria-label="Notification categories">{['Tasks', 'Others'].map(name => <button type="button" role="tab" aria-selected={tab === name} key={name} onClick={() => { setTab(name); setConfirmClear(false); setClearError(''); }}>{name}<span>{name === 'Tasks' ? taskUnread : portalUnreadCount}</span></button>)}</div>
            {(tab === 'Tasks' ? taskUnread : portalUnreadCount) > 0 && <button type="button" className="tm-notification-read-all" onClick={event => { if (tab === 'Tasks') markRead(items.map(item => item.id)); else onPortalReadAll?.(event); }}>Mark {tab.toLowerCase()} as read</button>}
            {(displayed.length > 0 || tab === 'Others' && portalHasMore) && <div className="tm-notification-clear"><button type="button" disabled={clearing} onClick={() => { setConfirmClear(!confirmClear); setClearError(''); }}>Clear notifications</button>{confirmClear && <div><p>Clear all {tab.toLowerCase()} notifications? Tasks and task history will remain.</p><button type="button" disabled={clearing} onClick={clearCurrentTab}>{clearing ? 'Clearing…' : 'Clear all'}</button><button type="button" disabled={clearing} onClick={() => setConfirmClear(false)}>Cancel</button></div>}{clearError && <p role="alert">{clearError}</p>}</div>}
            <PagedList items={displayed} label="notifications" resetKey={identity + tab}>{page => <div className="tm-notification-items">{page.map(event => <button type="button" className={(event.portal ? event.isRead : event.readBy?.includes(identity)) ? '' : 'tm-notification-unread'} key={event.id} onClick={() => show(event)}><AlertIcon action={event.action} /><div><span className="tm-alert-action">{event.action}</span><strong>{event.title}</strong><p>{event.description}</p>{event.createdAt && <time>{new Date(event.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>}</div></button>)}{!page.length && <p className="tm-notification-empty">{tab === 'Tasks' ? 'No task notifications yet. New assignments and updates will appear here.' : 'No other notifications yet.'}</p>}</div>}</PagedList>
            {tab === 'Others' && portalHasMore && <button type="button" className="tm-notification-load-more" disabled={portalLoading} onClick={onPortalLoadMore}>{portalLoading ? 'Loading…' : 'Load older notifications'}</button>}
        </section>}

        {createPortal(<div className="tm-side-alerts" role="status" aria-live="polite" aria-label="Task updates">{alerts.map(event => <SideAlert key={event.id} event={event} onDismiss={dismiss} onOpen={show} />)}</div>, document.body)}
    </div>;
}
