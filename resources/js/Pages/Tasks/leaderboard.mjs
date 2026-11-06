import {matchesSearch} from './search.mjs';
import {approvalBlocksWork} from './taskApproval.mjs';
import {isDailyTemplate} from './dailyTasks.mjs';
import {isWeeklyReport} from './weeklyReports.mjs';
import {isEmailSample} from './serverTasks.mjs';

export function completionDate(task) {
 const value=task.completedAt||task.approvedAt||task.history?.find(event=>/: approved\.$|task approved|main task completed|task completed/i.test(event.text||''))?.at;
 if(!value)return '';
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
 const date=new Date(value);if(Number.isNaN(date.getTime()))return '';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(part=>[part.type,part.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}
export function leaderboardPeople(employees){
 return [...new Map(employees.filter(person=>person.name&&person.active!==false&&!person.disabled&&!['inactive','disabled','terminated'].includes(String(person.status||'').toLowerCase())).map(person=>[person.name,person])).values()];
}
export function leaderboardBranches(person){return [...new Set([person.branch,...(person.availableBranches||[])].filter(Boolean))];}
export function leaderboardTeams(employees,{fixedBranch='',fixedDepartment=''}={}){
 return [...new Map(leaderboardPeople(employees).filter(person=>!fixedDepartment||person.department===fixedDepartment).flatMap(person=>(person.department==='IT'&&!fixedBranch?['All']:leaderboardBranches(person).filter(branch=>!fixedBranch||branch===fixedBranch)).map(branch=>[JSON.stringify([person.department,branch]),{department:person.department,branch}]))).entries()].sort((a,b)=>(a[1].department+' '+a[1].branch).localeCompare(b[1].department+' '+b[1].branch));
}
export function buildLeaderboard(tasks,{group='people',department='All',branch='All',from='',to='',search='',sort='completed',today='',attentionOnly=false,employees=[]}={}) {
 const rows=new Map(),seen=new Set();let undated=0;
 const groupName=(department,branch,name)=>group==='departments'?department:group==='teams'?`${department} · ${branch}`:group==='branches'?branch:name;
 for(const person of leaderboardPeople(employees)){
  if(!person.name||person.active===false||person.disabled||department!=='All'&&person.department!==department||branch!=='All'&&!leaderboardBranches(person).includes(branch))continue;
  const memberships=group==='branches'||group==='teams'?leaderboardBranches(person).filter(value=>branch==='All'||value===branch):[branch==='All'?person.branch:branch];
  for(const memberBranch of memberships){
  const name=groupName(person.department,memberBranch,person.name);
  const row=rows.get(name)||{name,completed:0,onTime:0,overdue:0,stableKey:name,departments:new Set(),branches:new Set(),members:new Set()};
  if(group==='people'||group==='teams')row.stableKey=String(person.id??person.employeeId??person.name);
  row.departments.add(person.department);row.branches.add(memberBranch);row.members.add(person.name);rows.set(name,row);
  }
 }
 for(const task of tasks){
  if(seen.has(task.id)||isEmailSample(task)||isDailyTemplate(task)||isWeeklyReport(task)||!task.assignee)continue;
  seen.add(task.id);

  if(department!=='All'&&task.department!==department||branch!=='All'&&task.branch!==branch)continue;
  const date=task.status==='Completed'?completionDate(task):task.due;
  const overdue=Boolean(today&&!approvalBlocksWork(task)&&task.due<today&&['Not Started','In Progress','Revision Needed'].includes(task.status));
  if(task.status==='Completed'&&!date)undated++;
  if(task.status!=='Completed'&&!overdue)continue;
  if((from||to)&&!date||from&&date<from||to&&date>to)continue;
  const name=group==='departments'?task.department:group==='teams'?`${task.department} · ${task.branch}`:group==='branches'?task.branch:task.assignee;
  const row=rows.get(name)||{name,completed:0,onTime:0,overdue:0,stableKey:name,departments:new Set(),branches:new Set(),members:new Set()};
  if(task.status==='Completed'){
   row.completed++;
   const submittedDate=task.submittedAt?completionDate({completedAt:task.submittedAt}):date;
   if(submittedDate&&task.due&&submittedDate<=task.due)row.onTime++;
  }else row.overdue++;
  row.departments.add(task.department);row.branches.add(task.branch);row.members.add(task.assignee);rows.set(name,row);
 }
 const compare=(a,b)=>b.completed-a.completed||b.onTime-a.onTime||a.overdue-b.overdue||a.stableKey.localeCompare(b.stableKey,'en',{numeric:true})||a.name.localeCompare(b.name);
 const ordered=[...rows.values()].filter(row=>!attentionOnly||row.overdue>0)
  .sort(attentionOnly?(a,b)=>b.overdue-a.overdue||compare(a,b):compare);
 let result=ordered.map((row,index)=>{
  const next=ordered[index+1],previous=ordered[index-1];
  const peer=next?.completed===row.completed?next:previous?.completed===row.completed?previous:null;
  const tieBreak=attentionOnly?'Overdue unfinished tasks':!peer?'Completed tasks':row.onTime!==peer.onTime?'On-time completions':row.overdue!==peer.overdue?'Overdue unfinished tasks':'Stable identifier (administrative order)';
  return {...row,rank:index+1,tieBreak,departments:[...row.departments].sort(),branches:[...row.branches].sort(),memberNames:[...row.members],members:row.members.size};
 });
 result=result.filter(row=>matchesSearch(search,row.name,row.departments,row.branches,row.memberNames));
 const total=result.reduce((sum,row)=>sum+row.completed,0);
 result=result.map(row=>({...row,share:total?Math.round(row.completed/total*1000)/10:0}));
 if (!attentionOnly) result.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='overdue'?b.overdue-a.overdue||b.completed-a.completed||a.name.localeCompare(b.name):sort==='fewest'?a.completed-b.completed||a.name.localeCompare(b.name):compare(a,b));
 return {rows:result,total,undated,needsAttention:result.filter(row=>row.overdue>0).length};
}
export function completionPie(rows,limit=8){
 const ordered=rows.filter(row=>row.completed>0).sort((a,b)=>b.completed-a.completed||a.name.localeCompare(b.name));
 if(ordered.length<=limit)return ordered.map(row=>({name:row.name,value:row.completed}));
 return [...ordered.slice(0,limit-1).map(row=>({name:row.name,value:row.completed})),{name:'Others',value:ordered.slice(limit-1).reduce((sum,row)=>sum+row.completed,0)}];
}

// Display-only fixtures: never saved to the task workspace.
export function leaderboardDemoTasks(employees,today){
 employees=leaderboardPeople(employees);
 const hash=name=>[...name].reduce((value,char)=>(value*31+char.charCodeAt(0))>>>0,0);
 const counts=new Map([...employees].sort((a,b)=>hash(a.name)-hash(b.name)||a.name.localeCompare(b.name)).map((person,index)=>[person.name,index+3]));
 return employees.flatMap((person,index)=>Array.from({length:counts.get(person.name)},(_,n)=>({id:'leaderboard-demo-'+index+'-'+n,assignee:person.name,department:person.department,branch:leaderboardBranches(person)[n%leaderboardBranches(person).length]||person.branch,title:'Demo completed task',template:'standard',status:'Completed',completedAt:today,due:today})));
}
export function leaderboardPeriod(today,period){
 if(period==='all')return {from:'',to:''};
 if(period==='month')return {from:today.slice(0,7)+'-01',to:today};
 const date=new Date(today+'T00:00:00Z');
 date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));
 return {from:date.toISOString().slice(0,10),to:today};
}

export function leaderboardScope({demo=false,fixedBranch='',fixedDepartment=''}={}){return demo?{fixedBranch:'',fixedDepartment:''}:{fixedBranch,fixedDepartment};}
