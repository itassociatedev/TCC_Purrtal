import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as inertia from '@inertiajs/react';

// Exercise the actual components and installed Inertia useForm, intercepting only
// network transport. Initial input overrides represent fields filled by the user;
// this catches transform().patch()/post() failures missed by backend-only tests.
const state = { inertia, input: {}, page: {} };
globalThis.__ticketFormTest = state;
const originalPatch = inertia.router.patch;
const originalPost = inertia.router.post;
const originalRoute = globalThis.route;
const requests = [];
inertia.router.patch = (url, data, options) => requests.push({ method: 'patch', url, data, options });
inertia.router.post = (url, data, options) => requests.push({ method: 'post', url, data, options });
globalThis.route = (name, params = {}) => `/test/${name}?${new URLSearchParams(params)}`;
const bundlePath = path.resolve(`tests/.ticket-form-${process.pid}.mjs`);

function nodes(tree, predicate) {
    if (!tree || typeof tree !== 'object') return [];
    if (Array.isArray(tree)) return tree.flatMap(item => nodes(item, predicate));
    return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}

function capture(component, props) {
    let tree;
    function Harness() {
        tree = component(props);
        return React.createElement('div');
    }
    renderToStaticMarkup(React.createElement(Harness));
    return tree;
}

try {
    const output = await build({
        entryPoints: ['resources/js/Pages/Tickets/Index.jsx'], bundle: true, write: false,
        platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external',
        alias: { '@': path.resolve('resources/js') },
        loader: { '.css': 'empty', '.png': 'dataurl', '.jpg': 'dataurl', '.jpeg': 'dataurl', '.svg': 'dataurl' },
        plugins: [{ name: 'real-inertia-hook-with-test-input', setup(builder) {
            builder.onResolve({ filter: /^@inertiajs\/react$/ }, () => ({ path: 'adapter', namespace: 'ticket-test' }));
            builder.onLoad({ filter: /.*/, namespace: 'ticket-test' }, () => ({ contents: `
                const state = globalThis.__ticketFormTest;
                export const useForm = initial => state.inertia.useForm({ ...initial, ...state.input });
                export const router = state.inertia.router;
                export const usePage = () => ({ props: state.page });
                export const Head = () => null;
                export const Link = () => null;
            ` }));
        } }],
    });
    writeFileSync(bundlePath, output.outputFiles[0].text);
    const { TicketEditor, TicketScreen } = await import(pathToFileURL(bundlePath).href);
    const base = { id: 42, creator_id: 1, assigned_to: 3, subject: 'Test issue', employee_name: 'Requester',
        description: 'Description', category: 'Hardware', status: 'in_progress', priority: 'medium',
        sla: { enabled: true }, sla_state: {}, activities: [] };
    const cases = [
        ['save', 'leader', {}, { priority: 'high', priority_reason: 'Service impact increased', assigned_to: 7 }, { action: 'save', priority: 'high', assigned_to: 7 }],
        ['acknowledge', 'member', {}, { assessment: 'Checked service', next_steps: 'Investigate' }, { action: 'acknowledge', assessment: 'Checked service' }],
        ['pause', 'member', {}, { note: 'Waiting for vendor', pause_reason: 'vendor' }, { action: 'pause', pause_reason: 'vendor' }],
        ['resume', 'member', { sla: { enabled: true, paused: true } }, { note: 'Vendor available' }, { action: 'resume', note: 'Vendor available' }],
        ['update', 'member', {}, { note: 'Investigating', vendor: 'Sample vendor' }, { action: 'update', vendor: 'Sample vendor' }],
        ['delay', 'member', {}, { note: 'Revised estimate', delay_reason: 'Parts', actions_taken: 'Contacted vendor', assistance_required: 'Delivery', next_update_at: '2026-10-28T16:00' }, { action: 'delay', delay_reason: 'Parts' }],
        ['restore', 'member', {}, { workaround: 'Backup service', recovery_plan: 'Repair primary' }, { action: 'restore', workaround: 'Backup service' }],
        ['approve_workaround', 'leader', { priority: 'critical' }, { workaround: 'Backup accepted', recovery_plan: 'Repair primary' }, { action: 'approve_workaround' }],
        ['resolve', 'member', {}, { findings: 'Fault found', troubleshooting_performed: 'Tested', corrective_actions: 'Repaired', resolution_details: 'Restored' }, { action: 'save', status: 'resolved' }],
        ['close', 'leader', { status: 'resolved' }, { note: 'Requester confirmed' }, { action: 'save', status: 'closed' }],
        ['reopen', 'member', { status: 'closed' }, { note: 'Issue returned' }, { action: 'reopen', status: 'in_progress' }],
        ['reply', 'employee', {}, { note: 'Still affected' }, { action: 'reply', note: 'Still affected' }],
        ['confirm', 'employee', { status: 'resolved' }, {}, { action: 'confirm' }],
        ['feedback', 'employee', {}, { rating: 4, note: '' }, { action: 'feedback', rating: 4 }],
    ];
    for (const [action, role, ticketOverrides, input, expected] of cases) {
        requests.length = 0;
        state.input = { action, ...input };
        let closed = false;
        const actor = { id: role === 'employee' ? 1 : role === 'leader' ? 2 : 3 };
        const tree = capture(TicketEditor, { ticket: { ...base, ...ticketOverrides }, role,
            members: [{ id: 3, name: 'Member' }, { id: 7, name: 'Other member' }], actor,
            ticketRoute: () => '/tickets/preview/42?preview_user=1', onClose: () => { closed = true; } });
        const form = nodes(tree, node => node.type === 'form')[0];
        assert.ok(form, `${action}: form is rendered`);
        let prevented = false;
        form.props.onSubmit({ preventDefault() { prevented = true; } });
        assert.ok(prevented);
        assert.equal(requests.length, 1, `${action}: exactly one request is sent`);
        assert.equal(requests[0].method, 'patch');
        assert.equal(requests[0].url, '/tickets/preview/42?preview_user=1');
        for (const [key, value] of Object.entries(expected)) assert.equal(requests[0].data[key], value, `${action}: ${key}`);
        if (role !== 'leader') {
            assert.equal(Object.hasOwn(requests[0].data, 'priority'), false);
            assert.equal(Object.hasOwn(requests[0].data, 'assigned_to'), false);
        }
        if (action === 'feedback') assert.equal(nodes(tree, n => n.type === 'textarea')[0].props.required, false);
        await requests[0].options.onSuccess({ props: {} });
        assert.ok(closed, `${action}: successful save closes dialog`);
        console.log(`PASS: ${action} submits through the installed Inertia hook`);
    }

    requests.length = 0;
    state.page = { auth: { user: { id: 1, name: 'Requester', branch_id: 1 } } };
    state.input = { subject: 'Printer issue', description: 'Cannot print', category: 'Hardware', employee_department: 'Operations',
        affected_asset: 'Printer', operational_impact: 'Printing delayed',
        supporting_links: 'https://example.com/one\nhttps://example.com/two' };
    const screen = capture(TicketScreen, { creationPage: true, ticketRole: 'employee',
        tickets: { total: 0, data: [], links: [], last_page: 1 }, filters: { view: 'all', search: '', per_page: '10' },
        categories: ['Hardware'], branches: [{ id: 1, name: 'Makati' }], members: [], reports: null,
        ticketUser: state.page.auth.user, preview: false, canPreview: false, previewUsers: [] });
    const creationForm = nodes(screen, n => n.type === 'form')[0];
    creationForm.props.onSubmit({ preventDefault() {} });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, 'post');
    assert.equal(requests[0].data.subject, 'Printer issue');
    assert.deepEqual(requests[0].data.supporting_links, ['https://example.com/one', 'https://example.com/two']);
    for (const field of ['issue_at', 'issue_time_type', 'affected_users', 'affected_areas', 'error_messages', 'troubleshooting_steps', 'follow_up_contact']) assert.equal(Object.hasOwn(requests[0].data, field), false);
    assert.equal(Object.hasOwn(requests[0].data, 'emergency_received_at'), false);
    assert.equal(Object.hasOwn(requests[0].data, 'emergency_reason'), false);
    console.log('PASS: new employee ticket submits through the installed Inertia hook');
} finally {
    inertia.router.patch = originalPatch;
    inertia.router.post = originalPost;
    globalThis.route = originalRoute;
    delete globalThis.__ticketFormTest;
    try { unlinkSync(bundlePath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
