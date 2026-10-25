import {validCsvDate} from '../../Utils/csv.mjs';
import {eligibleAssignees} from './assignmentDirectory.mjs';
import {routeTaskApproval} from './taskApproval.mjs';
export function prepareTaskImport(rows,tasks,config,scope,today,stamp=Date.now()) {
 if(scope.role==='Employee')throw new Error('Only roles that can create tasks may import them.');
 const people=eligibleAssignees(config,scope),keys=new Set(tasks.map(task=>[task.title,task.assignee,task.due,task.branch].join('|')));
 return rows.map((row,index)=>{
  const person=people.find(person=>person.name===row.assignee),line=`Row ${index+2}: `;
  if(!person||person.department!==row.department||!(person.availableBranches||[person.branch]).includes(row.branch))throw new Error(line+'choose an eligible assignee and their department/branch.');
  if(!row.title||!row.description||!config.priorities.includes(row.priority))throw new Error(line+'title, description and a valid priority are required.');
  const startDate=row.starting_date||today;
  if(!validCsvDate(row.deadline)||!validCsvDate(startDate)||startDate>row.deadline)throw new Error(line+'use valid starting dates and deadlines.');
  if(row.reference_link&&!/^https?:\/\//i.test(row.reference_link))throw new Error(line+'use an HTTP or HTTPS reference link.');
  const key=[row.title,person.name,row.deadline,row.branch].join('|');
  if(keys.has(key))throw new Error(line+'duplicate task. Remove duplicate rows before importing.');keys.add(key);
  return routeTaskApproval({id:stamp+index,title:row.title,description:row.description,assignee:person.name,assigneeRole:person.role,department:person.department,branch:row.branch,priority:row.priority,startDate,due:row.deadline,link:row.reference_link||'',template:'standard',kind:'Assigned task',status:'Not Started',requestedBy:scope.actor,submission:'',history:[{text:'Task imported from CSV.',at:new Date().toISOString()}]},config,scope);
 });
}
