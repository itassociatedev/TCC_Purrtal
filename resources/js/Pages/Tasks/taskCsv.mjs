import {validCsvDate} from '../../Utils/csv.mjs';
import {eligibleAssignees} from './assignmentDirectory.mjs';
import {routeTaskApproval} from './taskApproval.mjs';
export function prepareTaskImport(rows,tasks,config,scope,today,stamp=Date.now()) {
 if(scope.role==='Employee')throw new Error('Only roles that can create tasks may import them.');
 const people=eligibleAssignees(config,scope),keys=new Set(tasks.map(task=>[task.title,task.assignee,task.due,task.branch].join('|')));
 const errors=[];
 const imported=rows.map((row,index)=>{
  const rowErrors=[];
  row=Object.fromEntries(Object.entries(row).map(([key,value])=>[key,key==='_sheet_row'?value:String(value??'').trim()]));
  const line=`Row ${row._sheet_row || index+2}: `;
  for (const field of ['title','description','assignee','department','branch','priority','deadline']) {
    if (!String(row[field] ?? '').trim()) rowErrors.push(line+field.replaceAll('_',' ')+' is missing.');
  }
  const person=people.find(person=>person.name===row.assignee);
  if(row.assignee && !person)rowErrors.push(line+`assignee "${row.assignee}" is not available within your assignment permissions.`);
  if(person && row.department && person.department!==row.department)rowErrors.push(line+`department "${row.department}" does not match ${person.name}'s department (${person.department}).`);
  if(person && row.branch && !(person.availableBranches||[person.branch]).includes(row.branch))rowErrors.push(line+`branch "${row.branch}" is not an allowed work branch for ${person.name}.`);
  if(row.priority && !config.priorities.includes(row.priority))rowErrors.push(line+`priority "${row.priority}" is invalid. Choose ${config.priorities.join(', ')}.`);
  if((row.title||'').length>40)rowErrors.push(line+'task title exceeds 40 characters.');
  const kind = row.task_purpose || 'Assigned task';
  if (!['Assigned task','Self-created request'].includes(kind)) rowErrors.push(line+'task_purpose must be Assigned task or Self-created request.');
  if (kind === 'Assigned task' && person?.name === scope.actor) rowErrors.push(line+'use Self-created request for your own tasks.');
  if (kind === 'Self-created request' && person && person.name !== scope.actor) rowErrors.push(line+'self-created tasks must be assigned to you.');
  const frequency = row.frequency || 'once';
  if (!['once','daily','weekly','monthly'].includes(frequency)) rowErrors.push(line+'frequency must be once, daily, weekly or monthly.');
  const workCategory = row.work_type || '';
  if (workCategory && workCategory !== 'reportorial') rowErrors.push(line+'work_type must be reportorial. Send support requests through IT ticketing.');
  const creator = people.find(item => item.name === scope.actor);
  if (scope.role === 'Team Leader' && creator?.department !== config.itDepartment && person?.department === config.itDepartment && person.baseRole === 'Team Leader' && workCategory !== 'reportorial') rowErrors.push(line+'assignments to the IT Supervisor require work_type reportorial.');
  const startDate=row.starting_date||today;
  if(!validCsvDate(startDate))rowErrors.push(line+'starting date must be a real date in YYYY-MM-DD format.');
  if(row.deadline && !validCsvDate(row.deadline))rowErrors.push(line+'deadline must be a real date in YYYY-MM-DD format.');
  if(validCsvDate(startDate)&&validCsvDate(row.deadline)&&startDate>row.deadline)rowErrors.push(line+'deadline is earlier than the starting date.');
  if(validCsvDate(row.deadline)&&row.deadline<today)rowErrors.push(line+'deadline has already passed. Choose today or a later date.');
  if(row.reference_link&&!/^https?:\/\//i.test(row.reference_link))rowErrors.push(line+'use an HTTP or HTTPS reference link.');
  const key=[row.title,row.assignee,row.deadline,row.branch].join('|');
  if(keys.has(key))rowErrors.push(line+'duplicate task. Remove duplicate rows before importing.');keys.add(key);
  if(rowErrors.length){errors.push(...rowErrors);return null;}
  try { return routeTaskApproval({id:stamp+index,title:row.title,description:row.description,assignee:person.name,assigneeRole:person.role,department:person.department,branch:row.branch,priority:row.priority,startDate,due:row.deadline,link:row.reference_link||'',template:'standard',kind,frequency,workCategory,status:'Not Started',requestedBy:scope.actor,submission:'',history:[{text:'Task imported from XLSX.',at:new Date().toISOString()}]},config,scope); } catch(error) { errors.push(line+error.message); return null; }
 });
 if(errors.length) { const error=new Error(`${errors.length} import error${errors.length===1?'':'s'} found. No tasks were imported.\n\n${errors.join('\n')}`); error.validationErrors=errors; throw error; }
 return imported;
}
