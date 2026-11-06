import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeServerTasks,isEmailSample,serverTaskIdentity} from '../resources/js/Pages/Tasks/serverTasks.mjs';
test('server snapshots replace the same shared branch report without making a duplicate',()=>{
 const local={id:1001,template:'it-opening-rounds',recurrence:'daily',sharedBranchReport:true,branch:'Makati',due:'2026-10-25',status:'Not Started'};
 const saved={...local,id:1002,status:'Pending Review',_serverKey:'shared-key',_serverVersion:2};
 assert.deepEqual(mergeServerTasks([local],[saved]),[saved]);
 assert.equal(serverTaskIdentity(local),serverTaskIdentity(saved));
});
test('sync preserves browser-only samples and respects server deletions',()=>{
 const sample={id:1,title:'[Sample] Task'},saved={id:2,title:'Real task',_serverKey:'task:2'};
 assert.deepEqual(mergeServerTasks([sample,saved],[{_serverKey:'task:2',_deleted:true}]),[sample]);
 assert.equal(isEmailSample(sample),true);assert.equal(isEmailSample(saved),false);
});

test('a polling response cannot overwrite a more recent successful save',()=>{
 const saved={id:7,title:'Current',_serverKey:'task:7',_serverVersion:3};
 const stale={...saved,title:'Outdated',_serverVersion:2};
 assert.deepEqual(mergeServerTasks([saved],[stale]),[saved]);
 assert.equal(mergeServerTasks([saved],[{...saved,title:'Newest',_serverVersion:4}])[0].title,'Newest');
});
