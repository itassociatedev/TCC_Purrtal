export function pushDetailVisit(history,visit,next){
 if(!visit||visit.modal==='details'&&visit.taskId===next&&!visit.tab)return history;
 return [...history,visit].slice(-50);
}
export function previousDetailVisit(history,tasks){
 const remaining=[...history];
 while(remaining.length){
  const visit=remaining.pop();
  const task=visit.taskId==null?null:tasks.find(task=>task.id===visit.taskId);
  if(visit.modal==='details'&&!task)continue;
  return {visit,task,history:remaining};
 }
 return {visit:null,task:null,history:[]};
}
