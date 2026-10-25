import test from 'node:test';
import assert from 'node:assert/strict';
import {canDismissOpeningReport,dismissOpeningReport} from '../resources/js/Pages/Tasks/dismissOpeningReport.mjs';
import {ensureDailyTasks} from '../resources/js/Pages/Tasks/dailyTasks.mjs';
import {defaultSettings} from '../resources/js/Pages/Tasks/taskSettings.mjs';
import {isOverdue} from '../resources/js/Pages/Tasks/taskFilters.mjs';
import {reportSectionTasks} from '../resources/js/Pages/Tasks/taskViews.mjs';
const today='2026-10-25',scope={role:'Team Leader',department:'IT',itDepartment:'IT',actor:'IT lead'};
test('only IT TL may dismiss today’s unfinished opening report without a reason',()=>{
 const task={template:'it-opening-rounds',due:today,status:'Not Started'};
 assert.equal(canDismissOpeningReport(task,scope,today),true);
 const changes=dismissOpeningReport(task,scope,today);
 assert.equal(changes.status,'Dismissed');assert.equal(changes.dismissedBy,'IT lead');assert.ok(changes.dismissedAt);
 for(const context of [{...scope,role:'Employee'},{...scope,role:'EVP'},{...scope,department:'HR'}])assert.throws(()=>dismissOpeningReport(task,context,today));
 for(const status of ['Pending Review','Completed','Denied','Dismissed'])assert.equal(canDismissOpeningReport({...task,status},scope,today),false);
 assert.equal(canDismissOpeningReport({...task,due:'2026-10-24'},scope,today),false);
 assert.equal(canDismissOpeningReport({...task,template:'narrative-report'},scope,today),false);
});
test('dismissal stays archived, is not overdue and does not dismiss tomorrow’s report',()=>{
 const config=defaultSettings(),tasks=ensureDailyTasks([],config,today),task=tasks.find(task=>task.sharedBranchReport);
 Object.assign(task,dismissOpeningReport(task,scope,today));
 const next=ensureDailyTasks(tasks,config,'2026-10-26');
 assert.equal(next.find(item=>item.id===task.id).status,'Dismissed');
 assert.equal(next.find(item=>item.template===task.template&&item.branch===task.branch&&item.due==='2026-10-26').status,'Not Started');
 assert.equal(isOverdue(task,'2026-10-26'),false);
 assert.ok(reportSectionTasks(next,{section:'Archive'}).some(item=>item.id===task.id));
});
