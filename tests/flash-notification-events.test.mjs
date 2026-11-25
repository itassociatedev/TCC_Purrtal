import test from 'node:test';
import assert from 'node:assert/strict';
import { claimFlashEvent } from '../resources/js/Components/flashEvents.mjs';

test('polling and page remounts cannot replay a consumed success event', () => {
    const response = { id: 'polling-regression-1', success: 'SLA priority saved.' };
    assert.equal(claimFlashEvent(response.id), true);
    assert.equal(claimFlashEvent({ ...response }.id), false);
    assert.equal(claimFlashEvent(JSON.parse(JSON.stringify(response)).id), false);
});

test('a second successful save with identical wording still displays', () => {
    assert.equal(claimFlashEvent('separate-save-1'), true);
    assert.equal(claimFlashEvent('separate-save-2'), true);
    assert.equal(claimFlashEvent('separate-save-1'), false);
});


test('submission receipt does not reopen from a retained history snapshot', () => {
    assert.equal(claimFlashEvent('ticket-receipt:regression'), true);
    assert.equal(claimFlashEvent('ticket-receipt:regression'), false);
    assert.equal(claimFlashEvent('ticket-receipt:next-ticket'), true);
});


test('validation events do not replay but a repeated failed submission can notify again', () => {
    assert.equal(claimFlashEvent('validation:request-one'), true);
    assert.equal(claimFlashEvent('validation:request-one'), false);
    assert.equal(claimFlashEvent('validation:request-two'), true);
});
