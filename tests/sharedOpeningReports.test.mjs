import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureDailyTasks} from '../resources/js/Pages/Tasks/dailyTasks.mjs';
import {defaultSettings} from '../resources/js/Pages/Tasks/taskSettings.mjs';
import {canEditDailyReport, canCorrectITReport} from '../resources/js/Pages/Tasks/taskPolicy.mjs';
import {consolidateOpeningReports} from '../resources/js/Pages/Tasks/sharedOpeningReports.mjs';
test('one opening report per branch and day, independent of staff count or days off',()=>{
 const config=defaultSettings();
 config.employees.forEach(person=>person.branchSchedule={'2026-10-24':'Off'});
 const tasks=ensureDailyTasks([],config,'2026-10-24');
 const openings=tasks.filter(task=>task.template==='it-opening-rounds');
 assert.equal(openings.length,config.branches.length);
 assert.ok(openings.every(task=>task.sharedBranchReport&&task.assignee==='IT team'));
 assert.equal(ensureDailyTasks(tasks,config,'2026-10-24'),tasks);
});
test('IT colleagues and interns can fill shared report, unrelated departments cannot, completion locks it',()=>{
 const config=defaultSettings();const task=ensureDailyTasks([],config,'2026-10-24').find(task=>task.sharedBranchReport);
 const context={role:'Employee',config,employee:{name:'Another IT intern',department:config.itDepartment,branch:task.branch}};
 assert.equal(canEditDailyReport(task,context),true);
 assert.equal(canEditDailyReport(task,{...context,employee:{...context.employee,department:'HR'}}),false);
 assert.equal(canEditDailyReport({...task,status:'Completed',submission:'Done'},context),false);
 assert.equal(canCorrectITReport({...task,status:'Completed',submission:'Done'},context),false);
});
test('submitted legacy copy wins over untouched duplicates and retains author and contents',()=>{
 const base={template:'it-opening-rounds',branch:'Makati',due:'2026-10-24',status:'Not Started'};
 const result=consolidateOpeningReports([{...base,id:1,assignee:'One'},{...base,id:2,assignee:'Two',submission:'Checks complete',rounds:{images:['preserved']},status:'Pending Review'}]);
 assert.equal(result.length,1);assert.equal(result[0].submittedBy,'Two');assert.equal(result[0].status,'Pending Review');assert.equal(result[0].submission,'Checks complete');assert.deepEqual(result[0].rounds.images,['preserved']);
});
