import test from 'node:test';
import assert from 'node:assert/strict';
import {openingWarningLabels} from '../resources/js/Pages/Tasks/openingRounds.mjs';
test('opening warnings use saved system names for drafts and completed reports',()=>{
 const task={template:'it-opening-rounds',status:'In Progress',rounds:{checks:[['router','Branch router'],['printer','Printer']],systems:{router:'warning',printer:'good'}}};
 assert.deepEqual(openingWarningLabels(task),['Branch router']);
 assert.deepEqual(openingWarningLabels({...task,status:'Completed'}),['Branch router']);
 assert.deepEqual(openingWarningLabels({...task,rounds:{systems:{internet:'warning',printers:'warning'}}}),['Internet','Printers']);
});
test('normal systems, empty rounds and other report types have no warning indicator',()=>{
 assert.deepEqual(openingWarningLabels({template:'it-opening-rounds',rounds:{systems:{internet:'good',printers:''}}}),[]);
 assert.deepEqual(openingWarningLabels({template:'it-opening-rounds'}),[]);
 assert.deepEqual(openingWarningLabels({template:'narrative-report',rounds:{systems:{internet:'warning'}}}),[]);
});
