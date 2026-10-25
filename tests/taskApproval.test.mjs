import test from 'node:test';
import assert from 'node:assert/strict';
import {routeTaskApproval,canApproveTaskRequest,approvalBlocksWork,backfillRequestApprovals} from '../resources/js/Pages/Tasks/taskApproval.mjs';
import {defaultSettings} from '../resources/js/Pages/Tasks/taskSettings.mjs';
import {assignmentDirectory} from '../resources/js/Pages/Tasks/assignmentDirectory.mjs';
import {canSubmitAssignedTask} from '../resources/js/Pages/Tasks/taskPolicy.mjs';
import {tasksForPreview} from '../resources/js/Pages/Tasks/taskDirectory.mjs';
const config=defaultSettings();const directory=assignmentDirectory(config);const leader=directory.find(p=>p.baseRole==='Team Leader');const context={role:'Team Leader',actor:leader.name,department:leader.department};
test('a TL-created assignment is a pending request routed to its branch OM',()=>{
 const task=routeTaskApproval({id:1,template:'standard',kind:'Assigned task',status:'Not Started',assignee:leader.name,branch:'Makati',department:leader.department},config,context);
 const reviewer=directory.find(p=>p.name===task.approvalReviewer);assert.equal(task.status,'Pending Approval');assert.equal(reviewer.baseRole,'Operations Manager');assert.equal(reviewer.branch,'Makati');
 assert.equal(canApproveTaskRequest(task,context),false);assert.equal(canSubmitAssignedTask(task,{role:'Team Leader',actor:leader}),false);
 assert.equal(canApproveTaskRequest(task,{actor:reviewer.name}),true);assert.equal(canApproveTaskRequest(task,{actor:'Unrelated reviewer'}),false);
 assert.equal(canSubmitAssignedTask({...task,status:'Not Started',approvalGrantedAt:'2026-10-24T10:00:00Z'},{role:'Team Leader',actor:leader}),true);
 assert.equal(tasksForPreview([task],{role:'Operations Manager',actor:reviewer.name,branch:'Makati'}).length,1);
});
test('self-created work remains blocked across statuses until explicit approval',()=>{
 for(const status of ['Not Started','In Progress','Revision Needed','Pending Approval']){
  const task={kind:'Self-created request',status,assignee:leader.name};
  assert.equal(approvalBlocksWork(task),true);assert.equal(canSubmitAssignedTask(task,{role:'Team Leader',actor:leader}),false);
 }
 assert.equal(approvalBlocksWork({kind:'Self-created request',approvalGrantedAt:'2026-10-24T10:00:00Z'}),false);
});
test('existing unapproved requests are routed without losing draft work',()=>{
 const task={id:22,template:'standard',kind:'Self-created request',status:'In Progress',assignee:leader.name,requestedBy:leader.name,branch:'Makati',submission:'Existing draft'};
 const [request]=backfillRequestApprovals([task],config);assert.equal(request.status,'Pending Approval');assert.ok(request.approvalReviewer);assert.equal(request.submission,'Existing draft');
 const [approved]=backfillRequestApprovals([{...task,history:[{text:'Example: approved.'}]}],config);assert.equal(approved.status,'In Progress');
});
test('OM self-requests route to EVP and direct EVP assignments remain available immediately',()=>{
 const om=directory.find(p=>p.baseRole==='Operations Manager');const draft={template:'standard',kind:'Self-created request',branch:om.branch,assignee:om.name};
 const request=routeTaskApproval(draft,config,{role:'Operations Manager',actor:om.name});assert.equal(directory.find(p=>p.name===request.approvalReviewer).role,'EVP');
 const assignment={...draft,kind:'Assigned task',status:'Not Started'};assert.equal(routeTaskApproval(assignment,config,{role:'EVP'}),assignment);
});
test('missing higher-up prevents silently creating an approved task',()=>{
 const empty={...config,operationsManagers:[],roleHolders:[]};assert.throws(()=>routeTaskApproval({template:'standard',branch:'Makati'},empty,context),/No higher-up/);
});
