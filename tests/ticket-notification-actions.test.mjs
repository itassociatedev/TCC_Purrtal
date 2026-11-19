import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Execute the shared handlers with state setters and HTTP replaced by deterministic doubles.
const source = readFileSync(new URL('../resources/js/Layouts/SidebarLayout.jsx', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('    const clearPortalNotifications = async'), source.indexOf('    return (', source.indexOf('    const clearPortalNotifications = async')));
for (const preview of [null, 'Preview Employee']) {
    let feed = { unread: 1, notifications: [{ id: 'a', read_at: null }] };
    let local = feed.notifications, unread = 1, total = 1, fail = false;
    const revision = { current: 0 };
    const handlers = new Function('axios', 'route', 'ticketFeedRevision', 'ticketPreviewPerson', 'localUnreadCount', 'setLocalNotifications', 'setLocalUnreadCount', 'setTotalNotificationsCount', 'setTicketFeed', 'console', body + '; return { clearPortalNotifications, markAllAsRead };')(
        { post: async () => { if (fail) throw Error('offline'); } }, x => x, revision, preview, 1,
        value => { local = typeof value === 'function' ? value(local) : value; },
        value => { unread = value; }, value => { total = value; },
        value => { feed = typeof value === 'function' ? value(feed) : value; }, { error() {} });
    const event = { preventDefault() {}, stopPropagation() {} };
    fail = true; await handlers.markAllAsRead(event);
    assert.equal(unread, 1); assert.equal(feed.unread, 1);
    fail = false; await handlers.markAllAsRead(event);
    assert.equal(unread, 0); assert.ok(local[0].read_at);
    assert.equal(feed.unread, 1);
    await handlers.clearPortalNotifications();
    assert.equal(local.length, 0); assert.equal(total, 0);
    assert.equal(feed.notifications.length, 1);
    assert.equal(revision.current, 6);
}
console.log('PASS: shared notification actions preserve the separate ticket feed for real and preview users, and remain retryable after failures');
