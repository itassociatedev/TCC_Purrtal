import test from 'node:test';
import assert from 'node:assert/strict';
import { canRequestTask, pageTitle } from '../resources/js/Pages/Tasks/taskPolicy.mjs';
import { tasksForPreview } from '../resources/js/Pages/Tasks/taskDirectory.mjs';
import { defaultSettings, eligibleEmployees } from '../resources/js/Pages/Tasks/taskSettings.mjs';
import { validateIssueImages, imageLimit } from '../resources/js/Pages/Tasks/roundImages.mjs';
import { emptyRounds, formatRounds } from '../resources/js/Pages/Tasks/openingRounds.mjs';

test('only TL and OM workflows can create self-requested tasks', () => {
    assert.equal(canRequestTask('Team Leader'), true);
    assert.equal(canRequestTask('Operations Manager'), true);
    assert.equal(canRequestTask('Employee'), false);
    for (const role of ['Chief Vet','EVP']) assert.equal(canRequestTask(role), true);
});
test('EVP titles stay simple and Chief Vet titles carry the selected branch', () => {
    assert.equal(pageTitle({ view: 'Dashboard', role: 'EVP', roleLabel: 'EVP', scope: 'All departments & branches' }), 'EVP Dashboard');
    assert.equal(pageTitle({ view: 'Team Tasks', role: 'EVP', roleLabel: 'EVP' }), 'Team Tasks');
    assert.equal(pageTitle({ view: 'Dashboard', role: 'Chief Vet', roleLabel: 'Chief Vet', scope: 'Makati' }), 'Makati · Chief Vet Dashboard');
});
test('Chief Vet sees only tasks in the selected branch and can assign branch-eligible employees', () => {
    const tasks = [{ id: 1, branch: 'Alabang' }, { id: 2, branch: 'Makati' }, { id: 3, branch: 'Greenhills' }];
    assert.deepEqual(tasksForPreview(tasks, { role: 'Chief Vet', branch: 'Greenhills' }).map(task => task.id), [3]);
    assert.ok(eligibleEmployees(defaultSettings(), { role: 'Chief Vet', branch: 'Makati' }).every(employee => employee.availableBranches.includes('Makati')));
});
test('image uploads reject unsupported files, oversized images, and excess attachments', () => {
    const image = { name: 'Lorem.png', type: 'image/png', size: 1000 };
    assert.equal(validateIssueImages([image], 0), '');
    assert.match(validateIssueImages([{ ...image, type: 'image/svg+xml' }]), /JPG, PNG/);
    assert.match(validateIssueImages([{ ...image, size: 4 * 1024 * 1024 }]), /3 MB/);
    assert.match(validateIssueImages([image], imageLimit), /up to/);
});
test('copyable rounds reports list attachment names without embedding local file paths', () => {
    const rounds = { ...emptyRounds('2026-10-23', 'Makati'), images: [{ id: 'sample-id', name: 'Lorem.png' }] };
    assert.ok(formatRounds(rounds).includes('ISSUE IMAGES\n• Lorem.png'));
    assert.ok(!formatRounds(rounds).includes('sample-id'));
});
