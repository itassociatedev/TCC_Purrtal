import { assignmentDirectory } from './assignmentDirectory.mjs';
const work = {
 IT:['Check clinic workstation readiness','Check assigned workstations, printers and network access. Submit a short checklist with any issues found.'],
 Inventory:['Verify the inventory count sheet','Compare the latest count sheet against the recorded quantities. List discrepancies and attach the checked sheet.'],
 Accounting:['Verify product price records','Compare the product price records with the approved reference list. Submit a summary of differences.'],
 Procurement:['Prepare the purchasing follow-up list','Review pending purchase items and record supplier updates, expected delivery dates and outstanding issues.'],
 Reception:['Check appointment and client records','Review the sample appointment list for missing details or duplicate entries. Submit the corrected checklist.'],
 Cashier:['Reconcile the sample collection sheet','Check the sample collection totals against the supporting entries. Record discrepancies and submit the checked sheet.'],
 Veterinary:['Review the patient-record checklist','Check that the sample patient records contain the required administrative fields. Submit a list of incomplete records.'],
 'Vet Tech':['Check equipment and supply readiness','Review the equipment and supply checklist for the assigned area. Record missing items and maintenance follow-ups.'],
 'Clinic Assistant':['Complete the clinic readiness checklist','Check the assigned clinic areas and supplies using the readiness checklist. Submit the completed checklist.'],
 HR:['Check employee onboarding records','Review the sample onboarding checklist for missing documents and record the required follow-ups.'],
 'Sales & Marketing':['Prepare the campaign progress summary','Summarize the sample campaign deliverables, completed items and pending approvals.'],
 Facilities:['Check facility readiness','Inspect the assigned areas using the facility checklist. Submit any maintenance or housekeeping follow-ups.'],
 Security:['Review the branch access checklist','Check the sample visitor and access logs for missing entries. Submit a summary of any issues.'],
 'Internal Audit':['Review the supporting-document checklist','Check the sample supporting documents for completeness. Submit an exception list for follow-up.'],
};
const offset={EVP:7,'Operations Manager':5,'Chief Vet':4,'Team Leader':3,Employee:2};
function dueDate(day,days){const [y,m,d]=day.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+days)).toISOString().slice(0,10);}
export function addRoleSampleTasks(tasks,config,day){
 const keys=new Set(tasks.map(task=>task.sampleKey).filter(Boolean));
 const result=[...tasks];let id=Math.max(1000,...tasks.map(task=>Number(task.id)||0));
 const seen=new Set();
 for(const person of assignmentDirectory(config)){
  const key=`role-sample-v1:${person.id||person.name}`;
  if(keys.has(key)||seen.has(key))continue;seen.add(key);
  const role=person.baseRole;
  let [title,description]=work[person.department]||['Review the department action list','Review the assigned action list, record progress and submit the outstanding follow-ups.'];
  if(role==='EVP') [title,description]=person.role==='Corporate Services'
   ? [`Review ${person.department} deliverables`,'Review the department progress summary, identify missing deliverables and submit the next actions.']
   : ['Review the organization task summary','Review the branch and department progress summary. Record priorities and confirm the required next actions.'];
  else if(role==='Operations Manager') [title,description]=[`Review ${person.branch} branch readiness`,'Review the branch department checklists, consolidate outstanding issues and submit the branch action summary.'];
  else if(role==='Chief Vet') [title,description]=[`Review ${person.branch} clinical-team readiness`,'Review the clinical team readiness checklists and incomplete administrative records. Submit the follow-up summary.'];
  else if(role==='Team Leader') [title,description]=[`Review ${person.department} team progress`,'Review the team action list, confirm completed work and list overdue or blocked items. Submit a short progress summary.'];
  result.push({id:++id,title:`[Sample] ${title}`,description:`Practice task for ${person.name} (${person.position||person.role}) at ${person.branch}. ${description}`,assignee:person.name,assigneeRole:person.role,
   department:person.department,branch:person.branch,template:'standard',kind:'Assigned task',status:'Not Started',priority:config.priorities[role==='EVP'?0:Math.min(1,config.priorities.length-1)],
   due:dueDate(day,offset[role]||2),submission:'',remarks:'',link:'',sample:true,sampleKey:key});
 }
 return result.length===tasks.length?tasks:result;
}
