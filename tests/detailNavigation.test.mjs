import test from 'node:test';
import assert from 'node:assert/strict';
import {pushDetailVisit,previousDetailVisit} from '../resources/js/Pages/Tasks/detailNavigation.mjs';

test('workflow task navigation returns to the parent and its saved section',()=>{
 const tasks=[{id:1},{id:2}];
 const visits=pushDetailVisit([],{modal:'details',taskId:1,tab:'Workflow',scrollTop:180},2);
 const back=previousDetailVisit(visits,tasks);
 assert.equal(back.task.id,1);assert.equal(back.visit.tab,'Workflow');assert.equal(back.visit.scrollTop,180);
 assert.deepEqual(back.history,[]);
});
test('section history within one task and calendar history both remain navigable',()=>{
 let visits=pushDetailVisit([],{modal:'calendar-employee',calendarEmployee:{name:'Alex',date:'2026-10-28'}},1);
 visits=pushDetailVisit(visits,{modal:'details',taskId:1,tab:'Overview',scrollTop:40},1);
 const section=previousDetailVisit(visits,[{id:1}]);
 assert.equal(section.visit.tab,'Overview');
 assert.equal(previousDetailVisit(section.history,[{id:1}]).visit.modal,'calendar-employee');
});
test('deleted or no-longer-visible tasks are skipped safely',()=>{
 const back=previousDetailVisit([{modal:'details',taskId:1},{modal:'details',taskId:2}],[{id:1}]);
 assert.equal(back.task.id,1);
 assert.equal(previousDetailVisit([{modal:'details',taskId:2}],[]).visit,null);
});
test('reopening the same task does not create a loop and history remains bounded',()=>{
 assert.deepEqual(pushDetailVisit([],{modal:'details',taskId:1},1),[]);
 let visits=[];for(let i=0;i<80;i++)visits=pushDetailVisit(visits,{modal:'details',taskId:i},i+1);
 assert.equal(visits.length,50);
});
