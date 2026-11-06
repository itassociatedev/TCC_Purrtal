import test from 'node:test';
import assert from 'node:assert/strict';
import {submissionTimestamp,formatSubmissionTime} from '../resources/js/Pages/Tasks/submissionTime.mjs';
test('uses recorded submission instead of later approval',()=>assert.equal(submissionTimestamp({submittedAt:'2026-10-28T01:00:00Z',history:[{text:'Approved',at:'2026-10-28T05:00:00Z'}]}),'2026-10-28T01:00:00Z'));
test('legacy history selects latest actual submission',()=>assert.equal(submissionTimestamp({history:[{text:'Work submitted',at:'2026-10-27T01:00:00Z'},{text:'Approved',at:'2026-10-29T01:00:00Z'},{text:'Submitted for review',at:'2026-10-28T01:00:00Z'}]}),'2026-10-28T01:00:00Z'));
test('missing or invalid times remain empty',()=>{assert.equal(submissionTimestamp({submittedAt:'bad'}),'');assert.equal(formatSubmissionTime('bad'),'');});
test('formats submission in Philippine time across date boundary',()=>{const label=formatSubmissionTime('2026-10-27T17:05:00Z');assert.match(label,/Oct 28, 2026/);assert.match(label,/1:05 AM/);});
