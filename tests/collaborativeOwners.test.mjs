import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettings} from '../resources/js/Pages/Tasks/taskSettings.mjs';
import {assignmentDirectory} from '../resources/js/Pages/Tasks/assignmentDirectory.mjs';
import {canOwnCollaborative,createCollaborativeMain,canCompleteMainTask} from '../resources/js/Pages/Tasks/collaborativeTasks.mjs';
test('EVP, OM, Corporate and Team Leaders can own and close their own final deliverable',()=>{
 const config=defaultSettings(),people=assignmentDirectory(config),creator=people.find(person=>person.role==='EVP'),monitor=people.find(person=>person.baseRole==='Team Leader');
 for(const role of ['EVP','Operations Manager','Corporate Services','Team Leader']){
  const owner=people.find(person=>person.role===role);
  assert.ok(owner,role);assert.equal(canOwnCollaborative(owner),true);
  const [main,child]=createCollaborativeMain({id:1,title:'Final outcome',description:'Deliver results',branch:monitor.branch,due:'2026-11-02'},[],config,{role:'EVP',actor:creator.name},{mainOwner:owner.name,assignee:monitor.name,title:'Coordinate work',description:'Check team submissions',due:'2026-11-01'});
  const context={role:owner.baseRole,actor:owner.name};
  assert.equal(main.assignee,owner.name);
  assert.equal(canCompleteMainTask(main,[main,child],context),false);
  assert.equal(canCompleteMainTask(main,[main,{...child,status:'Completed'}],context),true);
  assert.equal(canCompleteMainTask(main,[main,{...child,status:'Completed'}],{...context,actor:'Other person'}),false);
 }
 assert.equal(canOwnCollaborative({baseRole:'Employee'}),false);
 assert.equal(canOwnCollaborative({baseRole:'Chief Vet'}),false);
});
