import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,validCsvDate} from '../resources/js/Utils/csv.mjs';
import {validateCollaborativeSubmission} from '../resources/js/Pages/Tasks/collaborativeTasks.mjs';
import {filterTasks} from '../resources/js/Pages/Tasks/taskFilters.mjs';
import {prepareTaskImport} from '../resources/js/Pages/Tasks/taskCsv.mjs';
import {defaultSettings} from '../resources/js/Pages/Tasks/taskSettings.mjs';
import {assignmentDirectory} from '../resources/js/Pages/Tasks/assignmentDirectory.mjs';
test('bulk task import preserves approval policy, rejects duplicates and never imports claimed approval',()=>{
 const config=defaultSettings(),people=assignmentDirectory(config),leader=people.find(person=>person.baseRole==='Team Leader'),person=people.find(person=>person.baseRole==='Employee');
 const scope={role:'Team Leader',actor:leader.name,department:leader.department};
 const row={title:'Imported work',description:'Do the work',assignee:person.name,department:person.department,branch:person.branch,priority:'Medium',starting_date:'2026-10-25',deadline:'2026-10-26',status:'Completed',submission:'Claimed approval'};
 const imported=prepareTaskImport([row],[],config,scope,'2026-10-25');
 assert.equal(imported[0].status,'Pending Approval');assert.equal(imported[0].submission,'');assert.ok(imported[0].approvalReviewer);
 assert.throws(()=>prepareTaskImport([row,row],[],config,scope,'2026-10-25'));
 assert.throws(()=>prepareTaskImport([row],imported,config,scope,'2026-10-25'));
 assert.throws(()=>prepareTaskImport([{...row,deadline:'2026-02-30'}],[],config,scope,'2026-10-25'));
 assert.throws(()=>prepareTaskImport([row],[],config,{role:'Employee',employee:person.name},'2026-10-25'));
});
test('all collaborative levels require output for submission and completion, reference links do not count as output',()=>{
 for(const task of [{template:'collaborative'},{template:'collaborative',parentId:1},{template:'standard',parentId:2}]){
  for(const status of ['Pending Review','Completed']){
   assert.ok(validateCollaborativeSubmission({...task,link:'https://reference.example'},{status}));
   assert.ok(validateCollaborativeSubmission(task,{status,submission:'  '}));
   assert.equal(validateCollaborativeSubmission(task,{status,submission:'Work completed'}),'');
   assert.equal(validateCollaborativeSubmission({...task,submission:'https://output.example'},{status}),'');
  }
 }
 assert.equal(validateCollaborativeSubmission({template:'standard'},{status:'Completed'}),'');
});
test('completed My Tasks filter shows completed work while default remains active work',()=>{
 const tasks=[{id:1,title:'Active',due:'2026-10-25',status:'Not Started'},{id:2,title:'Done',due:'2026-10-24',status:'Completed'},{id:3,title:'Denied',due:'2026-10-23',status:'Denied'}];
 assert.deepEqual(filterTasks(tasks,{view:'My Tasks'}).map(task=>task.id),[1]);
 assert.deepEqual(filterTasks(tasks,{view:'My Tasks',status:'Completed'}).map(task=>task.id),[2]);
});
test('CSV import parses quoted commas, newlines and escaped quotes and rejects invalid structure',()=>{
 const rows=parseCsv('\uFEFFtitle,description\r\n"Check, stock","Two\nlines and ""quotes"""\r\n');
 assert.deepEqual(rows,[{title:'Check, stock',description:'Two\nlines and "quotes"'}]);
 for(const text of ['title,title\na,b','title,description\na','title\n"unclosed','title\n'])assert.throws(()=>parseCsv(text));
 assert.equal(validCsvDate('2026-02-30'),false);assert.equal(validCsvDate('2026-10-25'),true);
});
