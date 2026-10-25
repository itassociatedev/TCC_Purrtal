import {assignmentDirectory} from './assignmentDirectory.mjs';
export const isSelfCreatedRequest=task=>['Self-created request','Turnover request'].includes(task.kind);
export const approvalBlocksWork=task=>(task.approvalRequired||isSelfCreatedRequest(task))&&!task.approvalGrantedAt&&!task.history?.some(event=>/: approved\.$|request approved|task approved/i.test(event.text||''));
export function routeTaskApproval(task,config,scope){
 if(task.template==='collaborative')return task;
 const required=scope.role==='Team Leader'||isSelfCreatedRequest(task);
 if(!required)return task;
 const people=assignmentDirectory(config).filter(person=>person.name!==scope.actor);
 const reviewer=(scope.role==='Team Leader'?people.find(person=>person.baseRole==='Operations Manager'&&person.branch===task.branch):null)
  ||people.find(person=>person.role==='EVP')||people.find(person=>person.baseRole==='EVP');
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
