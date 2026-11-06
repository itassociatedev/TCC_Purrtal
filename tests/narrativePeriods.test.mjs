import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettings} from '../resources/js/Pages/Tasks/taskSettings.mjs';
import {ensureDailyTasks,formatNarrative} from '../resources/js/Pages/Tasks/dailyTasks.mjs';
import {ensurePeriodicNarratives,narrativeSummary,narrativeDateMatches,narrativeFrequencyMatches} from '../resources/js/Pages/Tasks/narrativePeriods.mjs';
import {serverTaskIdentity,mergeServerTasks} from '../resources/js/Pages/Tasks/serverTasks.mjs';
test('day week and month reports remain unique and retain submitted content',()=>{
 const config=defaultSettings(),day='2026-10-28',tasks=ensureDailyTasks([],config,day),person=config.employees.find(person=>person.department==='IT');
 for(const recurrence of ['daily','weekly','monthly'])assert.equal(tasks.filter(task=>task.assignee===person.name&&task.template==='narrative-report'&&task.recurrence===recurrence).length,1);
 assert.equal(ensureDailyTasks(tasks,config,day),tasks);
 const monthly=tasks.find(task=>task.assignee===person.name&&task.recurrence==='monthly');monthly.status='Pending Review';monthly.narrative={summary:'Saved summary',issues:'Saved issue'};
 const next=ensureDailyTasks(tasks,config,'2026-10-29');assert.equal(next.find(task=>task.id===monthly.id).narrative.summary,'Saved summary');
 assert.equal(next.filter(task=>task.assignee===person.name&&task.recurrence==='monthly').length,1);
});
test('existing intern weekly report is reused rather than duplicated',()=>{
 const config=defaultSettings(),person=config.employees.find(person=>person.department==='IT');person.employeeType='Intern';
 const tasks=ensureDailyTasks([],config,'2026-10-28');
 assert.equal(tasks.filter(task=>task.assignee===person.name&&task.recurrence==='weekly').length,1);
 assert.equal(tasks.find(task=>task.assignee===person.name&&task.recurrence==='weekly').template,'intern-weekly-report');
});
test('summary counts only own approved tasks completed within Manila reporting dates',()=>{
 const report={id:10,assignee:'Alex',template:'narrative-report',recurrence:'monthly',periodStart:'2026-10-01',periodEnd:'2026-10-31'};
 const completed=(id,title,at,extra={})=>({id,title,completedAt:at,assignee:'Alex',template:'standard',status:'Completed',branch:'Makati',...extra});
 const tasks=[completed(1,'Included','2026-09-30T16:10:00Z'),completed(2,'November','2026-10-31T16:10:00Z'),completed(3,'Other person','2026-10-10T00:00:00Z',{assignee:'Bea'}),completed(4,'Unapproved','2026-10-10T00:00:00Z',{status:'Pending Review'}),completed(5,'Report','2026-10-10T00:00:00Z',{template:'narrative-report'}),completed(6,'Sample','2026-10-10T00:00:00Z',{sample:true}),completed(1,'Included','2026-09-30T16:10:00Z')];
 assert.equal(narrativeSummary(report,tasks),'• Included (Makati)');
 assert.equal(narrativeSummary({...report,recurrence:'daily',periodStart:'2026-10-02',periodEnd:'2026-10-02'},tasks),'No completed tasks recorded for this period.');
});
test('monthly periods cross year boundaries and frequency filters match a date inside the period',()=>{
 const tasks=ensurePeriodicNarratives([],defaultSettings(),'2026-12-31'),monthly=tasks.find(task=>task.recurrence==='monthly');
 assert.equal(monthly.periodStart,'2026-12-01');assert.equal(monthly.periodEnd,'2026-12-31');assert.ok(narrativeDateMatches(monthly,'2026-12-15'));assert.equal(narrativeDateMatches(monthly,'2027-01-01'),false);assert.ok(narrativeFrequencyMatches(monthly,'monthly'));assert.equal(narrativeFrequencyMatches(monthly,'daily'),false);
 const next=ensurePeriodicNarratives(tasks,defaultSettings(),'2027-01-01');assert.ok(next.some(task=>task.periodStart==='2027-01-01'&&task.periodEnd==='2027-01-31'));
});
test('period identities merge across browsers without duplicate assignments',()=>{
 const local={id:1,template:'narrative-report',assignee:'Alex',recurrence:'monthly',periodStart:'2026-10-01'};
 const server={...local,id:99,_serverKey:'period-key',_serverVersion:1};assert.equal(serverTaskIdentity(local),serverTaskIdentity(server));assert.equal(mergeServerTasks([local],[server]).length,1);
 const text=formatNarrative({date:'2026-10-31',branch:'Makati',department:'IT',summary:'Task A',issues:'Problem A',solutions:'Fix A',followUps:'Check A'},{...local,periodEnd:'2026-10-31'});
 assert.match(text,/SUMMARY\n\(Tasks Completed\)\nTask A/);assert.match(text,/ISSUES \/ PROBLEMS\nProblem A/);assert.match(text,/SOLUTIONS\nFix A/);assert.match(text,/FOLLOW-UPS\nCheck A/);
});
