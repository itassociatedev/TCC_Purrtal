import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeNotificationList } from '../resources/js/Components/notificationList.mjs';

test('overlapping pagination cannot duplicate a bell notification', () => {
    assert.deepEqual(mergeNotificationList([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]).map(n => n.id), ['a', 'b', 'c']);
});
test('refresh includes new alerts, retains older pages and accepts updated read state', () => {
    const result = mergeNotificationList([{ id: 'a', read_at: null }, { id: 'b' }, { id: 'c' }], [{ id: 'new' }, { id: 'a', read_at: 'read' }], { refresh: true, total: 4 });
    assert.deepEqual(result.map(n => n.id), ['new', 'a', 'b', 'c']);
    assert.equal(result[1].read_at, 'read');
});
test('cleared notifications stay empty and refreshed totals remove stale excess rows', () => {
    assert.deepEqual(mergeNotificationList([{ id: 'a' }], [], { refresh: true, total: 0 }), []);
    assert.equal(mergeNotificationList([{ id: 'a' }, { id: 'b' }], [{ id: 'a' }], { refresh: true, total: 1 }).length, 1);
});
