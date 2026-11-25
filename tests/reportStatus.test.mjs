import test from 'node:test';
import assert from 'node:assert/strict';
import { reportStatus } from '../resources/js/Pages/Tasks/reportStatus.mjs';

test('author completion and review outcomes have distinct visible cues', () => {
    assert.equal(reportStatus('Not Started').label, 'Not done');
    assert.equal(reportStatus('In Progress').tone, 'in-progress');
    assert.equal(reportStatus('Pending Review').label, 'Done · For review');
    assert.equal(reportStatus('Completed').tone, 'approved');
    assert.equal(reportStatus('Denied').icon, 'close');
    assert.equal(reportStatus('Revision Needed').label, 'Needs revision');
    assert.notEqual(reportStatus('Pending Review').tone, reportStatus('Completed').tone);
});
