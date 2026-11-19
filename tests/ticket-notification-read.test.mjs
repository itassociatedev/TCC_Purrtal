import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../resources/js/Layouts/SidebarLayout.jsx', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('    const markAsRead = async'), source.indexOf('    const user =', source.indexOf('    const markAsRead = async')));
for (const fail of [false, true]) {
    let feed = null, calls = 0, visits = 0, errors = 0, release;
    const gate = new Promise(resolve => { release = resolve; });
    const pending = { current: new Set() }, revision = { current: 0 };
    const notices = [{ id: 'ticket', read_at: null, data: { ticket_id: 42 } }];
    const read = new Function('pendingNotificationReads', 'ticketFeedRevision', 'itNotifications', 'localNotifications', 'itUnreadCount', 'ticketFeedParams', 'axios', 'route', 'setTicketFeed', 'setLocalNotifications', 'setLocalUnreadCount', 'window', 'CustomEvent', 'router', body + '; return markAsRead;')(
        pending, revision, notices, [], 1, {},
        { post: async () => { calls++; await gate; if (fail) throw Error('offline'); } }, (...args) => args,
        update => { feed = update(feed); }, () => { throw Error('Regular list changed'); }, () => { throw Error('Regular badge changed'); },
        { dispatchEvent() { errors++; } }, class {}, { visit(target) { visits++; assert.deepEqual(target, ['tickets.all', { selected_ticket: 42 }]); } });
    const first = read('ticket', '/tickets/all');
    await read('ticket', '/tickets/all');
    assert.equal(calls, 1, 'Repeated in-flight read sends one request');
    release(); await first;
    assert.equal(pending.current.size, 0); assert.equal(revision.current, 2);
    if (fail) {
        assert.equal(feed, null); assert.equal(visits, 0); assert.equal(errors, 1);
    } else {
        assert.equal(feed.unread, 0); assert.ok(feed.notifications[0].read_at); assert.equal(visits, 1);
    }
}
console.log('PASS: ticket reads before first poll update only IT state, deduplicate clicks, invalidate stale polls, and preserve retry state on failure');
