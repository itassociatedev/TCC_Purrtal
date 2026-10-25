import test from 'node:test';
import assert from 'node:assert/strict';
import { previewView } from '../resources/js/Pages/Tasks/previewNavigation.mjs';

test('preview switches keep shared pages and map role-specific pages to their equivalents', () => {
    for (const role of ['Employee', 'Team Leader', 'Operations Manager', 'Chief Vet', 'EVP']) {
        for (const view of ['Calendar', 'Dashboard', 'Daily Tasks', 'Activity', 'Task Archive', 'Workspace Setup']) assert.equal(previewView(view, role), view);
    }
    assert.equal(previewView('Team Tasks', 'Employee'), 'My Tasks');
    assert.equal(previewView('My Tasks', 'EVP'), 'My Tasks');
    assert.equal(previewView('Review Queue', 'Employee'), 'Submissions');
    assert.equal(previewView('Submissions', 'Team Leader'), 'Review Queue');
    assert.equal(previewView('Weekly Reports', 'Employee', true), 'Weekly Reports');
    assert.equal(previewView('Weekly Reports', 'Employee', false), 'My Tasks');
});
