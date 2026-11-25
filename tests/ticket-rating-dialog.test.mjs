import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as inertia from '@inertiajs/react';
const state = { inertia, rating: 0 };
globalThis.__ratingTest = state;
const requests = [];
const original = inertia.router.patch;
inertia.router.patch = (url, data, options) => requests.push({ url, data, options });
const file = path.resolve(`tests/.rating-${process.pid}.mjs`);
const nodes = (tree, test) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(t => nodes(t, test)) : [...(test(tree) ? [tree] : []), ...nodes(tree.props?.children, test)];
try {
    const result = await build({ entryPoints: ['resources/js/Components/TicketFeedbackQueue.jsx'], bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external', alias: { '@': path.resolve('resources/js') }, plugins: [{ name: 'rating-inertia', setup(b) {
        b.onResolve({ filter: /^@inertiajs\/react$/ }, () => ({ path: 'adapter', namespace: 'rating-test' }));
        b.onLoad({ filter: /.*/, namespace: 'rating-test' }, () => ({ contents: `const s = globalThis.__ratingTest; export const router = s.inertia.router; export const useForm = initial => s.inertia.useForm({...initial, rating: s.rating, note: 'Optional feedback'});` }));
    } }] });
    writeFileSync(file, result.outputFiles[0].text);
    const { TicketRatingDialog } = await import(pathToFileURL(file).href);
    for (let rating = 0; rating <= 5; rating += 0.5) {
        state.rating = rating; requests.length = 0; let tree; const skipped = [];
        function Harness() { tree = TicketRatingDialog({ ticket: { id: 42, subject: 'Printer issue' }, remaining: 2, ticketRoute: () => '/tickets/42', onDone() {}, onSkip: id => skipped.push(id) }); return React.createElement('div'); }
        renderToStaticMarkup(React.createElement(Harness));
        const radios = nodes(tree, n => n.type === 'input' && n.props.type === 'radio');
        assert.equal(radios.length, 10);
        assert.equal(nodes(tree, n => n.type === 'svg' && n.props.className === 'filled').length, Math.floor(rating));
        assert.equal(nodes(tree, n => n.type === 'svg' && n.props.className === 'half-filled').length, rating % 1 ? 1 : 0);
        assert.equal(nodes(tree, n => n.type === 'textarea').length, rating > 0 && rating <= 3 ? 1 : 0);
        assert.ok(nodes(tree, n => n.props?.children === 'How was our service?').length);
        nodes(tree, n => n.type === 'form')[0].props.onSubmit({ preventDefault() {} });
        assert.equal(requests.length, rating ? 1 : 0);
        if (rating) { assert.equal(requests[0].data.rating, rating); assert.equal(requests[0].data.note, rating <= 3 ? 'Optional feedback' : ''); }
        nodes(tree, n => n.type === 'button' && n.props['aria-label'] === 'Skip rating')[0].props.onClick();
        assert.deepEqual(skipped, [42]);
        console.log(`PASS: ${rating} stars, optional comment visibility, submission, and dismissal`);
    }
} finally { inertia.router.patch = original; delete globalThis.__ratingTest; try { unlinkSync(file); } catch {} }
