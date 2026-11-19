// The server supplies stable notification IDs. Paging offsets can shift when new alerts arrive.
export function mergeNotificationList(current, incoming, { total, refresh = false } = {}) {
    if (total === 0) return [];
    const result = [];
    const seen = new Set();
    const items = refresh ? [...incoming, ...current] : [...current, ...incoming];
    for (const item of items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        result.push(item);
    }
    return Number.isInteger(total) ? result.slice(0, total) : result;
}
