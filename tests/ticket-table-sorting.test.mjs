import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Execute the table handlers with deterministic transport/state doubles.
const source = readFileSync(new URL('../resources/js/Pages/Tickets/Index.jsx', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('    const clearTicketFilters ='), source.indexOf('    // Show only the views', source.indexOf('    const clearTicketFilters =')));
const requests = [], state = {};
const filters = { view: 'all', sort: 'created_at', direction: 'desc', sort_active: false };
const { sortTickets, clearTicketFilters } = new Function('filters', 'search', 'router', 'ticketRoute', 'setDateFrom', 'setDateTo', 'setSearch', body + '; return { sortTickets, clearTicketFilters };')(
    filters, 'Printer', { get: (...args) => requests.push(args) }, (name, params) => params,
    value => { state.from = value; }, value => { state.to = value; }, value => { state.search = value; });
for (const key of ['subject', 'created_at']) {
    Object.assign(filters, { sort: 'created_at', direction: 'desc', sort_active: false });
    for (const direction of ['asc', 'desc', '']) {
        sortTickets(key);
        const [query, , options] = requests.at(-1);
        assert.equal(query.sort, direction ? key : ''); assert.equal(query.direction, direction);
        assert.equal(options.preserveState, true); assert.equal(options.preserveScroll, true);
        assert.deepEqual(options.only, ['tickets', 'filters']);
        Object.assign(filters, { sort: query.sort || 'created_at', direction: query.direction || 'desc', sort_active: Boolean(query.sort) });
    }
}
sortTickets('priority', 'desc'); assert.equal(requests.at(-1)[0].direction, 'desc');
clearTicketFilters();
const [query, , options] = requests.at(-1);
assert.equal(query.sort, ''); assert.equal(query.direction, ''); assert.equal(query.search, '');
assert.equal(query.assignee_filter, ''); assert.equal(query.resolver_filter, '');
assert.deepEqual(state, { from: '', to: '', search: '' }); assert.equal(options.preserveState, true);
console.log('PASS: table headers cycle through default, reset clears sorting, and requests preserve page state with partial data');
