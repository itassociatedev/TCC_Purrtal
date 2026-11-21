import {completionDay} from './completionDate.mjs';
import {matchesSearch} from './search.mjs';
import {isDailyTemplate} from './dailyTasks.mjs';
import {isWeeklyReport} from './weeklyReports.mjs';
import {isEmailSample} from './serverTasks.mjs';

export function completionDate(task) {
 return completionDay(task) || '';
}
export function leaderboardPeople(employees){
 return [...new Map(employees.filter(person=>person.name&&person.active!==false&&!person.disabled&&!['inactive','disabled','terminated'].includes(String(person.status||'').toLowerCase())).map(person=>[person.name,person])).values()];
}
export function leaderboardBranches(person){return [...new Set([person.branch,...(person.availableBranches||[])].filter(Boolean))];}
export function leaderboardTaskIsOverdue(task,today){
 const waiting=['Pending Approval','Pending Review'].includes(task.status);
 const closed=['Completed','Denied','Dismissed'].includes(task.status);
 // Status is authoritative here. Old approved tasks may retain approvalRequired
 // without an approval timestamp, which must not hide active overdue work.
 return Boolean(today&&task.due&&task.due.slice(0,10)<today&&!waiting&&!closed);
}
export function leaderboardTeams(employees,{fixedBranch='',fixedDepartment=''}={}){
 return [...new Map(leaderboardPeople(employees).filter(person=>!fixedDepartment||person.department===fixedDepartment).flatMap(person=>(person.department==='IT'&&!fixedBranch?['All']:leaderboardBranches(person).filter(branch=>!fixedBranch||branch===fixedBranch)).map(branch=>[JSON.stringify([person.department,branch]),{department:person.department,branch}]))).entries()].sort((a,b)=>(a[1].department+' '+a[1].branch).localeCompare(b[1].department+' '+b[1].branch));
}
export function buildLeaderboard(tasks,{group='people',department='All',branch='All',from='',to='',search='',sort='completed',today='',attentionOnly=false,employees=[],demo=false}={}) {
 const rows=new Map(),seen=new Set();let undated=0;
 const people=leaderboardPeople(employees),peopleById=new Map(people.map(p=>[String(p.id),p])),peopleByName=new Map(people.flatMap(p=>[p.name,p.accountName,...(p.previousNames||[])].filter(Boolean).map(name=>[name,p])));
 const identities = new Map(people.flatMap(person =>
  [person.name, person.accountName, ...(person.previousNames || [])].filter(Boolean).map(name => [name, person.name])));
 const groupName=(department,branch,name)=>group==='departments'?department:group==='teams'?`${department} · ${branch}`:group==='branches'?branch:name;
 for(const person of people){
  if(!person.name||person.active===false||person.disabled||department!=='All'&&person.department!==department||branch!=='All'&&!leaderboardBranches(person).includes(branch))continue;
  const memberships=group==='branches'||group==='teams'?leaderboardBranches(person).filter(value=>branch==='All'||value===branch):[branch==='All'?person.branch:branch];
  for(const memberBranch of memberships){
  const name=groupName(person.department,memberBranch,person.name);
  const row=rows.get(name)||{name,completed:0,pointUnits:0,scoreEntries:[],unscored:0,onTime:0,overdue:0,overdueTasks:[],completedTasks:[],stableKey:name,departments:new Set(),branches:new Set(),members:new Set()};
  if(group==='people'||group==='teams')row.stableKey=String(person.id??person.employeeId??person.name);
  row.departments.add(person.department);row.branches.add(memberBranch);row.members.add(person.name);rows.set(name,row);
  }
 }
 for(const savedTask of tasks){
  const task = {...savedTask, assignee: identities.get(savedTask.assignee) || savedTask.assignee};
  if(employees.length && !identities.has(savedTask.assignee))continue;
  if(seen.has(String(task.id))||isEmailSample(task)||isDailyTemplate(task)||isWeeklyReport(task)||!task.assignee)continue;
  seen.add(String(task.id));

  if(department!=='All'&&task.department!==department||branch!=='All'&&task.branch!==branch)continue;
  const date=task.status==='Completed'?completionDate(task):task.due;
  const overdue=leaderboardTaskIsOverdue(task,today);
  if(task.status==='Completed'&&!date)undated++;
  if(task.status!=='Completed'&&!overdue)continue;
  if((from||to)&&!date||from&&date<from||to&&date>to)continue;
  const name=group==='departments'?task.department:group==='teams'?`${task.department} · ${task.branch}`:group==='branches'?task.branch:task.assignee;
  const row=rows.get(name)||{name,completed:0,pointUnits:0,scoreEntries:[],unscored:0,onTime:0,overdue:0,overdueTasks:[],completedTasks:[],stableKey:name,departments:new Set(),branches:new Set(),members:new Set()};
  if(task.status==='Completed'){
   row.completed++;
   row.scoreEntries.push({task,scoring:task.scoring||{reason:'incomplete_records',eligible:false},awardedUnits:0});
   if(!demo&&!task.scoring?.eligible)row.unscored++;
   row.completedTasks.push({id:task.id,title:task.title||'Untitled task',completedAt:date,due:task.due||'',department:task.department||'',branch:task.branch||'',assignee:task.assignee||''});
   const submittedDate=task.submittedAt?completionDate({completedAt:task.submittedAt}):date;
   if(submittedDate&&task.due&&submittedDate<=task.due)row.onTime++;
  }else {
   row.overdue++;
   row.overdueTasks.push({id:task.id,title:task.title||'Untitled task',due:task.due,status:task.status});
  }
  row.departments.add(task.department);row.branches.add(task.branch);row.members.add(task.assignee);rows.set(name,row);
 }
 // Points are separate from completion counts and come only from the server ledger.
 const scored=new Set();
 for(const task of tasks){
  if(scored.has(String(task.id))||task.status!=='Completed'||isEmailSample(task)||isDailyTemplate(task)||isWeeklyReport(task))continue;
  scored.add(String(task.id));
  const date=completionDate(task);if((from||to)&&!date||from&&date<from||to&&date>to)continue;
  let score=task.scoring;
  if(demo)score={eligible:true,percentage:94,earned_units:940000,scores:{time:30,priority:24,returns:20,ownership:20},return_count:0,return_deduction:0,priority:'High',submission_at:task.completedAt,deadline:task.due,allocations:[{id:task.assignee,name:task.assignee,department:task.department,branch:task.branch,units:1000000,awarded_units:940000}],policy_version:'DEMO'};
  if(!score?.eligible)continue;
  for(const allocation of score.allocations||[]){
   const person=peopleById.get(String(allocation.id))||peopleByName.get(allocation.name);
   if(employees.length&&!person)continue;
   const who=person?.name||allocation.name,dept=allocation.department||task.department,location=allocation.branch||task.branch;
   if(department!=='All'&&dept!==department||branch!=='All'&&location!==branch)continue;
   const name=groupName(dept,location,who);
   const row=rows.get(name)||{name,completed:0,pointUnits:0,scoreEntries:[],unscored:0,onTime:0,overdue:0,overdueTasks:[],completedTasks:[],stableKey:name,departments:new Set(),branches:new Set(),members:new Set()};
   row.pointUnits+=Number(allocation.awarded_units||0);
   let entry=row.scoreEntries.find(entry=>String(entry.task.id)===String(task.id));
   if(!entry){entry={task,scoring:score,awardedUnits:0};row.scoreEntries.push(entry);}entry.scoring=score;entry.awardedUnits+=Number(allocation.awarded_units||0);
   row.departments.add(dept);row.branches.add(location);row.members.add(who);rows.set(name,row);
  }
 }
 const compare=(a,b)=>b.pointUnits-a.pointUnits||a.name.localeCompare(b.name,'en',{numeric:true,sensitivity:'base'})||a.stableKey.localeCompare(b.stableKey);
 const ordered=[...rows.values()].filter(row=>!attentionOnly||row.overdue>0)
  .sort(attentionOnly?(a,b)=>b.overdue-a.overdue||compare(a,b):compare);
 let result=ordered.map((row,index)=>{
  const tieBreak=attentionOnly?'Overdue unfinished tasks':'Leaderboard points, then name A–Z';
  return {...row,rank:index+1,tieBreak,departments:[...row.departments].sort(),branches:[...row.branches].sort(),memberNames:[...row.members],members:row.members.size};
 });
 result=result.filter(row=>matchesSearch(search,row.name,row.departments,row.branches,row.memberNames));
 const total=result.reduce((sum,row)=>sum+row.completed,0),totalUnits=result.reduce((sum,row)=>sum+row.pointUnits,0);
 result=result.map(row=>({...row,points:row.pointUnits/1000000,share:totalUnits?Math.round(row.pointUnits/totalUnits*10000)/100:0}));
 if (!attentionOnly) result.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='overdue'?b.overdue-a.overdue||b.pointUnits-a.pointUnits||a.name.localeCompare(b.name):sort==='fewest'?a.pointUnits-b.pointUnits||a.name.localeCompare(b.name):compare(a,b));
 return {rows:result,total,totalUnits,totalPoints:totalUnits/1000000,undated,needsAttention:result.filter(row=>row.overdue>0).length};
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
