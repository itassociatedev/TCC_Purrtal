import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTasks, taskMatchesDateRange, isOverdue } from '../resources/js/Pages/Tasks/taskFilters.mjs';

// Exercise workflow boundaries with sample identities, without touching the portal database.
const today = '2026-10-22';
const tasks = [
    { id: 1, title: 'Update inventory tracker', assignee: 'John Doe', description: 'Lorem ipsum.', priority: 'Medium', due: '2026-10-21', status: 'In Progress' },
    { id: 2, title: 'Prepare daily clinic summary', assignee: 'John Doe 2', description: 'Lorem ipsum.', priority: 'High', due: today, status: 'Pending Review', submission: 'Lorem ipsum.' },
    { id: 3, title: 'Check medical supplies', assignee: 'John Doe', description: 'Lorem ipsum.', priority: 'High', due: '2026-10-20', status: 'Completed', submission: 'Lorem ipsum.' },
    { id: 4, title: 'Prepare staff meeting agenda', assignee: 'John Doe 2', description: 'Lorem ipsum.', priority: 'Low', due: today, status: 'Denied' },
    { id: 5, title: 'Review client follow-ups', assignee: 'John Doe', description: 'Lorem ipsum.', priority: 'High', due: '2026-10-23', status: 'Pending Approval' },
];
const select = (options) => filterTasks(tasks, { today, view: 'Team Tasks', ...options });

test('active work and the archive are disjoint, including denied requests', () => {
    assert.deepEqual(select({}).map(t => t.id), [1, 2, 5]);
    assert.deepEqual(select({ view: 'Task Archive' }).map(t => t.id), [3, 4]);
    assert.equal(isOverdue(tasks[2], today), false);
    assert.deepEqual(select({ due: 'Overdue' }).map(t => t.id), [1]);
});
test('review queue includes both request approvals and work submissions', () => {
    assert.deepEqual(select({ view: 'Review Queue' }).map(t => t.id), [2, 5]);
    assert.deepEqual(select({ view: 'Review Queue', status: 'Pending Approval' }).map(t => t.id), [5]);
});
test('search, owner, priority, and date filters intersect instead of replacing each other', () => {
    assert.deepEqual(select({ search: '  CLINIC  ', assignee: 'John Doe 2', priority: 'High', due: 'Today' }).map(t => t.id), [2]);
    assert.deepEqual(select({ assignee: 'John Doe', selectedDay: today }), []);
});
test('sorting prioritizes urgent work without mutating stored task order', () => {
    assert.deepEqual(select({ sort: 'priority' }).map(t => t.id), [2, 5, 1]);
    assert.deepEqual(tasks.map(t => t.id), [1, 2, 3, 4, 5]);
});
test('employee submission history includes closed work but excludes unsubmitted requests', () => {
    assert.deepEqual(select({ view: 'Submissions' }).map(t => t.id), [3, 2]);
});


test('date range applies inclusively to task lists, reviews, submissions, archive and calendar',()=>{
 for(const view of ['My Tasks','Team Tasks','Review Queue','Submissions','Task Archive','Calendar']){
  const status=view==='Task Archive'?'Completed':view==='Review Queue'?'Pending Review':'In Progress';
  const records=['2026-10-01','2026-10-15','2026-10-31'].map((due,index)=>({id:index+1,title:'Task',assignee:'Alex',department:'IT',branch:'Makati',priority:'Medium',status,due,submission:'Output'}));
  assert.deepEqual(filterTasks(records,{view,today:'2026-10-29',from:'2026-10-15',to:'2026-10-31'}).map(task=>task.id),[2,3]);
 }
});
test('report ranges include overlapping weekly and monthly periods and supersede daily default',()=>{
 const monthly={id:1,title:'Monthly',template:'narrative-report',assignee:'Alex',department:'IT',branch:'Makati',recurrence:'monthly',periodStart:'2026-10-01',periodEnd:'2026-10-31',due:'2026-10-31',status:'Not Started',priority:'Medium'};
 assert.ok(taskMatchesDateRange(monthly,'2026-10-10','2026-10-12'));
 assert.equal(taskMatchesDateRange(monthly,'2026-11-01','2026-11-30'),false);
 const daily={...monthly,id:2,title:'Daily',recurrence:'daily',periodStart:undefined,periodEnd:undefined,due:'2026-10-10',scheduledDate:'2026-10-10'};
 assert.equal(filterTasks([daily],{view:'Daily Tasks',today:'2026-10-29',dailyDate:'2026-10-29',from:'2026-10-01',to:'2026-10-15'}).length,1);
 assert.ok(taskMatchesDateRange({template:'intern-weekly-report',weekStart:'2026-10-24',weekEnd:'2026-10-30',due:'2026-10-30'},'2026-10-25','2026-10-26'));
});
test('one-sided date ranges work and reversed ranges match nothing',()=>{
 assert.ok(taskMatchesDateRange({due:'2026-10-20'},'2026-10-20',''));
 assert.ok(taskMatchesDateRange({due:'2026-10-20'},'','2026-10-20'));
 assert.equal(taskMatchesDateRange({due:'2026-10-20'},'2026-10-21',''),false);
 assert.equal(taskMatchesDateRange({due:'2026-10-20'},'2026-10-25','2026-10-01'),false);
});
