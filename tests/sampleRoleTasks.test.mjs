import test from 'node:test';
import assert from 'node:assert/strict';
import {addRoleSampleTasks} from '../resources/js/Pages/Tasks/sampleRoleTasks.mjs';
import {defaultSettings} from '../resources/js/Pages/Tasks/taskSettings.mjs';
import {assignmentDirectory} from '../resources/js/Pages/Tasks/assignmentDirectory.mjs';
test('each person across every role receives a distinct department-appropriate practice task',()=>{
 const config=defaultSettings();const people=assignmentDirectory(config);const tasks=addRoleSampleTasks([],config,'2026-10-24');
 assert.equal(tasks.length,people.length);assert.equal(new Set(tasks.map(t=>t.id)).size,tasks.length);
 for(const person of people){const task=tasks.find(t=>t.assignee===person.name);assert.ok(task);assert.equal(task.department,person.department);assert.equal(task.branch,person.branch);assert.equal(task.assigneeRole,person.role);assert.ok(task.title.startsWith('[Sample]'));assert.ok(task.due>'2026-10-24');}
});
test('sample generation is repeat-safe and preserves existing work and statuses',()=>{
 const config=defaultSettings();const existing={id:9000,title:'Actual work',status:'Completed',assignee:'Existing owner'};
 const tasks=addRoleSampleTasks([existing],config,'2026-10-24');assert.equal(tasks[0],existing);assert.ok(tasks[1].id>9000);assert.equal(addRoleSampleTasks(tasks,config,'2026-10-25'),tasks);
});
