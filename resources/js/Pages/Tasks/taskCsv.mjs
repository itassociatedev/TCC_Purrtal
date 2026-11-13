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
  if(row.title.length>40)throw new Error(line+'task titles can be up to 40 characters.');
  const kind = row.task_purpose || 'Assigned task';
  if (!['Assigned task','Self-created request'].includes(kind)) throw new Error(line+'task_purpose must be Assigned task or Self-created request.');
  if (kind === 'Assigned task' && person.name === scope.actor) throw new Error(line+'use Self-created request for your own tasks.');
  if (kind === 'Self-created request' && person.name !== scope.actor) throw new Error(line+'self-created tasks must be assigned to you.');
  const frequency = row.frequency || 'once';
  if (!['once','daily','weekly','monthly'].includes(frequency)) throw new Error(line+'frequency must be once, daily, weekly or monthly.');
  const workCategory = row.work_type || '';
  if (workCategory && workCategory !== 'reportorial') throw new Error(line+'work_type must be reportorial. Send support requests through IT ticketing.');
  const creator = people.find(item => item.name === scope.actor);
  if (scope.role === 'Team Leader' && creator?.department !== config.itDepartment && person.department === config.itDepartment && person.baseRole === 'Team Leader' && workCategory !== 'reportorial') throw new Error(line+'assignments to the IT Supervisor require work_type reportorial.');
  const startDate=row.starting_date||today;
  if(!validCsvDate(row.deadline)||!validCsvDate(startDate)||startDate>row.deadline||row.deadline<today)throw new Error(line+'use valid starting dates and deadlines.');
  if(row.reference_link&&!/^https?:\/\//i.test(row.reference_link))throw new Error(line+'use an HTTP or HTTPS reference link.');
  const key=[row.title,person.name,row.deadline,row.branch].join('|');
  if(keys.has(key))throw new Error(line+'duplicate task. Remove duplicate rows before importing.');keys.add(key);
  return routeTaskApproval({id:stamp+index,title:row.title,description:row.description,assignee:person.name,assigneeRole:person.role,department:person.department,branch:row.branch,priority:row.priority,startDate,due:row.deadline,link:row.reference_link||'',template:'standard',kind,frequency,workCategory,status:'Not Started',requestedBy:scope.actor,submission:'',history:[{text:'Task imported from XLSX.',at:new Date().toISOString()}]},config,scope);
 });
}
