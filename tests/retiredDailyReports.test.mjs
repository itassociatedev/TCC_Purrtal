import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureDailyTasks} from '../resources/js/Pages/Tasks/dailyTasks.mjs';
import {defaultSettings} from '../resources/js/Pages/Tasks/taskSettings.mjs';
import {reportSectionTasks} from '../resources/js/Pages/Tasks/taskViews.mjs';
test('removed employees lose untouched daily assignments; submitted history stays in archive',()=>{
 const config=defaultSettings(),day='2026-10-24';
 const base={template:'narrative-report',assignee:'Former IT intern',department:config.itDepartment,branch:'Makati',due:day,scheduledDate:day,recurrence:'daily'};
 const result=ensureDailyTasks([{...base,id:1,status:'Not Started'},{...base,id:2,status:'Completed',submission:'Preserve this report'}],config,day);
 assert.equal(result.some(task=>task.id===1),false);
 assert.equal(result.find(task=>task.id===2).submission,'Preserve this report');
 assert.equal(reportSectionTasks(result).some(task=>task.id===2),false);
 assert.equal(reportSectionTasks(result,{section:'Archive'}).some(task=>task.id===2),true);
 assert.equal(ensureDailyTasks(result,config,day),result);
});
