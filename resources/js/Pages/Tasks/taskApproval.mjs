import {assignmentDirectory} from './assignmentDirectory.mjs';
export const isSelfCreatedRequest=task=>['Self-created request','Turnover request'].includes(task.kind);
export const approvalBlocksWork=task=>(task.approvalRequired||isSelfCreatedRequest(task)&&task.approvalRequired!==false)&&!task.approvalGrantedAt&&!task.history?.some(event=>/: approved\.$|request approved|task approved/i.test(event.text||''));
export function routeTaskApproval(task,config,scope){
 if(task.template==='collaborative')return task;
 const required=isSelfCreatedRequest(task)||scope.role==='Team Leader'&&task.assignee===scope.actor;
 if(!required)return task;
 const people=assignmentDirectory(config).filter(person=>person.name!==scope.actor);
 const creator=assignmentDirectory(config).find(person=>person.name===scope.actor);
 if(scope.role==='Team Leader'&&creator?.department===(config.itDepartment||'IT'))return {...task,status:'Not Started',approvalRequired:false};
 if(scope.role==='EVP'&&creator?.role!=='Corporate Services')return {...task,status:'Not Started',approvalRequired:false};
 const dept=creator?.department||task.department;
 const branchMatch=person=>(person.availableBranches||[person.branch]).includes(task.branch);
 let reviewer;
 if(scope.role==='Employee')reviewer=people.find(person=>person.baseRole==='Team Leader'&&person.department===dept&&branchMatch(person));
 else if(scope.role==='Team Leader'){
  reviewer=people.find(person=>person.baseRole==='Operations Manager'&&person.branch===task.branch);
 }else reviewer=people.find(person=>person.role==='EVP');

 if(!reviewer)throw new Error('No higher-up is available to approve this task. Ask an administrator to configure the branch Operations Manager or EVP in the Task Module.');
 return {...task,status:'Pending Approval',approvalReviewer:reviewer.name,approvalReviewerRole:reviewer.role,requestedBy:scope.actor,approvalRequired:true};
}
export const canApproveTaskRequest=(task,scope)=>task.status==='Pending Approval'&&Boolean(task.approvalReviewer)&&task.approvalReviewer===scope.actor&&task.requestedBy!==scope.actor;
export function backfillRequestApprovals(tasks,config){
 const people=assignmentDirectory(config);
 return tasks.map(task=>{
  if(!isSelfCreatedRequest(task)||!approvalBlocksWork(task)||['Completed','Denied'].includes(task.status)||task.approvalReviewer)return task;
  const creator=people.find(person=>person.name===task.requestedBy);
  if(!creator)return task;
  try{return routeTaskApproval(task,config,{role:creator.baseRole,actor:creator.name});}catch{return task;}
 });
}
