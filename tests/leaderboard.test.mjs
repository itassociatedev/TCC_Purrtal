import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLeaderboard,completionDate,completionPie,leaderboardDemoTasks,leaderboardPeriod,leaderboardTeams,leaderboardScope} from '../resources/js/Pages/Tasks/leaderboard.mjs';
const task=(id,assignee='Alex',changes={})=>({id,assignee,department:'IT',branch:'Makati',template:'standard',title:'Real task',status:'Completed',due:'2026-10-25',completedAt:'2026-10-25T04:00:00Z',...changes});
test('rankings count only distinct approved completions without weighted contribution metrics',()=>{
 const tasks=[task(1),task(1),task(2,'Bea',{template:'collaborative'}),task(3,'Alex',{status:'Pending Review'}),task(4,'Alex',{title:'[Sample] Test'}),task(5,'Alex',{template:'narrative-report'}),task(6,'Alex',{template:'intern-weekly-report'})];
 const board=buildLeaderboard(tasks);
 assert.equal(board.total,2);assert.deepEqual(board.rows.map(row=>[row.name,row.rank,row.share]),[['Alex',1,50],['Bea',2,50]]);
});
test('team and branch totals aggregate the same approved work without double counting a record',()=>{
 const tasks=[task(1),task(2,'Bea'),task(3,'Cara',{branch:'Alabang',department:'Inventory'})];
 const teams=buildLeaderboard(tasks,{group:'teams'});
 assert.equal(teams.rows[0].name,'IT · Makati');assert.equal(teams.rows[0].completed,2);assert.equal(teams.rows[0].members,2);
 assert.equal(buildLeaderboard(tasks,{group:'branches'}).total,3);
 assert.equal(buildLeaderboard(tasks,{branch:'Alabang'}).rows[0].name,'Cara');
 assert.equal(buildLeaderboard(tasks,{department:'Inventory'}).total,1);
});
test('departments combine branches while teams remain department and branch pairs',()=>{
 const tasks=[task(1),task(2,'Bea',{branch:'Alabang'}),task(3,'Cara',{department:'Inventory'})];
 const departments=buildLeaderboard(tasks,{group:'departments'});
 assert.equal(departments.rows[0].name,'IT');assert.equal(departments.rows[0].completed,2);
 assert.deepEqual(departments.rows[0].branches,['Alabang','Makati']);
 assert.equal(buildLeaderboard(tasks,{group:'teams'}).rows.length,3);
 assert.equal(buildLeaderboard(tasks,{group:'departments',branch:'Alabang'}).total,1);
});
test('completion date filters use Philippine dates and do not invent dates for older history',()=>{
 assert.equal(completionDate(task(1,'Alex',{completedAt:'2026-10-24T17:00:00Z'})),'2026-10-25');
 assert.equal(completionDate(task(2,'Alex',{completedAt:null,history:[{text:'Real task: approved.',at:'2026-10-25T01:00:00Z'}]})),'2026-10-25');
 const tasks=[task(1),task(2,'Bea',{completedAt:null}),task(3,'Cara',{completedAt:'2026-10-26T01:00:00Z'})];
 const result=buildLeaderboard(tasks,{from:'2026-10-25',to:'2026-10-25'});
 assert.equal(result.total,1);assert.equal(result.undated,1);
 assert.equal(buildLeaderboard(tasks).total,3);
});
test('search and display sorting preserve completion ranks and contribution within the selected scope',()=>{
 const tasks=[task(1,'Zoe'),task(2,'Zoe'),task(3,'Alex',{completedAt:'2026-10-26T00:00:00Z'})];
 const result=buildLeaderboard(tasks,{search:'Alex'});assert.equal(result.rows[0].rank,2);assert.equal(result.rows[0].completed,1);
 assert.equal(buildLeaderboard(tasks,{sort:'name'}).rows[0].name,'Alex');
 assert.equal(buildLeaderboard(tasks,{sort:'completed'}).rows[0].name,'Zoe');
});
test('employees with overdue unfinished work are visible even with zero completed tasks',()=>{
 const tasks=[task(1,'Alex'),task(2,'Bea',{status:'In Progress',due:'2026-10-24'}),task(3,'Cara',{status:'Pending Review',due:'2026-10-23'}),task(4,'Drew',{status:'Pending Approval',due:'2026-10-23'}),task(5,'Eve',{status:'Not Started',due:'2026-10-23',approvalRequired:true}),task(6,'Faye',{status:'In Progress',due:'2026-10-26'})];
 const board=buildLeaderboard(tasks,{today:'2026-10-25'});
 assert.deepEqual(board.rows.map(row=>row.name),['Alex','Bea']);
 assert.equal(board.rows[1].completed,0);assert.equal(board.rows[1].overdue,1);assert.equal(board.rows[1].rank,2);
 assert.equal(board.needsAttention,1);
 assert.deepEqual(buildLeaderboard(tasks,{today:'2026-10-25',attentionOnly:true}).rows.map(row=>row.name),['Bea']);
});
test('active directory employees with no tasks appear at zero within scope',()=>{
 const employees=[{name:'Alex',department:'IT',branch:'Makati'},{name:'Bea',department:'IT',branch:'Alabang'},{name:'Cara',department:'HR',branch:'Makati'}];
 const board=buildLeaderboard([task(1)],{employees});
 assert.equal(board.rows.length,3);assert.deepEqual(board.rows.map(row=>row.rank),[1,2,3]);assert.equal(board.rows.find(row=>row.name==='Bea').completed,0);
 assert.equal(completionPie(board.rows).length,1);
 assert.equal(buildLeaderboard([],{employees,branch:'Alabang'}).rows.length,1);
 assert.equal(buildLeaderboard([],{employees,group:'departments'}).rows.length,2);
});
test('pie counts match the current results and Others preserves the entire total',()=>{
 const tasks=Array.from({length:12},(_,index)=>task(index,`Employee ${index}`));
 const board=buildLeaderboard(tasks),segments=completionPie(board.rows);
 assert.equal(segments.length,8);assert.equal(segments.at(-1).name,'Others');
 assert.equal(segments.reduce((sum,item)=>sum+item.value,0),12);
 const searched=buildLeaderboard(tasks,{search:'Employee 11'});
 assert.equal(searched.rows[0].share,100);assert.equal(searched.total,1);
});

test('quick periods use Monday weeks and month boundaries',()=>{
 assert.deepEqual(leaderboardPeriod('2026-11-01','week'),{from:'2026-10-26',to:'2026-11-01'});
 assert.deepEqual(leaderboardPeriod('2026-11-01','month'),{from:'2026-11-01',to:'2026-11-01'});
 assert.deepEqual(leaderboardPeriod('2026-11-01','all'),{from:'',to:''});
});
test('demo fixtures do not modify employees or real task records',()=>{
 const employees=[{name:'Alex',department:'IT',branch:'Makati'},{name:'Bea',department:'IT',branch:'Alabang'}];
 const original=JSON.stringify(employees),demo=leaderboardDemoTasks(employees,'2026-10-25');
 assert.equal(JSON.stringify(employees),original);
 assert.ok(demo.every(task=>task.id.startsWith('leaderboard-demo-')&&task.completedAt==='2026-10-25'));
 const board=buildLeaderboard(demo,{employees});assert.equal(board.rows.length,2);assert.equal(board.total,demo.length);
});

test('equal completions resolve by on-time count then overdue work then stable ID',()=>{
 const employees=[{id:2,name:'Alex',department:'IT',branch:'Makati'},{id:1,name:'Bea',department:'IT',branch:'Makati'},{id:3,name:'Cara',department:'IT',branch:'Makati'}];
 const tasks=[task(1,'Alex'),task(2,'Bea'),task(3,'Cara',{due:'2026-10-24'}),task(4,'Alex',{status:'In Progress',due:'2026-10-24'})];
 const board=buildLeaderboard(tasks,{employees,today:'2026-10-25'});
 assert.deepEqual(board.rows.map(row=>row.name),['Bea','Alex','Cara']);
 assert.deepEqual(board.rows.map(row=>row.rank),[1,2,3]);
 const exact=buildLeaderboard([task(1,'Alex'),task(2,'Bea')],{employees:employees.slice(0,2)});
 assert.equal(exact.rows[0].name,'Bea');assert.match(exact.rows[0].tieBreak,/administrative/);
});
test('demo employees have distinct completed counts and team scope lists individual people',()=>{
 const employees=Array.from({length:30},(_,index)=>({name:'Employee '+index,department:'IT',branch:index%2?'Alabang':'Makati'}));
 const demo=leaderboardDemoTasks(employees,'2026-10-25');
 const board=buildLeaderboard(demo,{employees});
 assert.equal(new Set(board.rows.map(row=>row.completed)).size,30);
 const team=buildLeaderboard(demo,{employees,group:'people',department:'IT',branch:'Alabang'});
 assert.equal(team.rows.length,15);assert.ok(team.rows.every(row=>row.branches[0]==='Alabang'));
});

test('on-time tie breaker credits timely submission even when approval arrives late',()=>{
 const board=buildLeaderboard([task(1,'Alex',{due:'2026-10-24',submittedAt:'2026-10-24T08:00:00Z'}),task(2,'Bea',{due:'2026-10-24',submittedAt:'2026-10-25T01:00:00Z'})]);
 assert.equal(board.rows[0].name,'Alex');assert.equal(board.rows[0].onTime,1);assert.equal(board.rows[1].onTime,0);
});


test('team choices include allowed work branches and branch scope includes their employees',()=>{
 const employees=[{id:1,name:'Alex',department:'IT',branch:'Makati',availableBranches:['Makati','Greenhills']},{id:2,name:'Bea',department:'HR',branch:'Alabang'}];
 assert.deepEqual(leaderboardTeams(employees,{fixedBranch:'Greenhills'}).map(([,team])=>team),[{department:'IT',branch:'Greenhills'}]);
 const board=buildLeaderboard([task(10,'Alex',{branch:'Greenhills'})],{employees,branch:'Greenhills'});
 assert.equal(board.rows.length,1);assert.equal(board.rows[0].completed,1);assert.deepEqual(board.rows[0].branches,['Greenhills']);
});
test('demo includes each active employee once even when directory repeats leaders',()=>{
 const people=Array.from({length:116},(_,i)=>({id:i,name:'Employee '+i,department:i%2?'IT':'HR',branch:'Makati',availableBranches:['Makati','Greenhills']}));
 const employees=[...people,people[0],{name:'Inactive',active:false,department:'IT',branch:'Makati'}];
 const demo=leaderboardDemoTasks(employees,'2026-10-28'),board=buildLeaderboard(demo,{employees});
 assert.equal(board.rows.length,116);assert.equal(new Set(board.rows.map(row=>row.completed)).size,116);
 assert.equal(buildLeaderboard(demo,{employees,department:'IT',branch:'Greenhills'}).rows.length,58);
 assert.ok(buildLeaderboard(demo,{employees,department:'IT',branch:'Greenhills'}).rows.every(row=>row.completed>0));
 assert.equal(buildLeaderboard(demo,{employees,group:'departments'}).total,board.total);
 assert.equal(buildLeaderboard(demo,{employees,group:'branches'}).total,board.total);
});


test('company-wide demo removes IT leader restrictions but real mode preserves them',()=>{
 const employees=[{name:'Alex',department:'IT',branch:'Makati'},{name:'Bea',department:'HR',branch:'Alabang'},{name:'Cara',department:'Finance',branch:'Greenhills'}];
 const tasks=leaderboardDemoTasks(employees,'2026-10-28');
 for(const demo of [false,true]){
  const scope=leaderboardScope({demo,fixedDepartment:'IT',fixedBranch:'Makati'});
  const options={employees,department:scope.fixedDepartment||'All',branch:scope.fixedBranch||'All'};
  assert.equal(buildLeaderboard(tasks,options).rows.length,demo?3:1);
  assert.equal(buildLeaderboard(tasks,{...options,group:'departments'}).rows.length,demo?3:1);
  assert.equal(buildLeaderboard(tasks,{...options,group:'branches'}).rows.length,demo?3:1);
  assert.equal(leaderboardTeams(employees,scope).length,demo?3:1);
 }
});


test('IT team combines branches while other teams keep branch choices',()=>{
 const employees=[{name:'Alex',department:'IT',branch:'Makati',availableBranches:['Makati','Alabang','Greenhills']},{name:'Bea',department:'IT',branch:'Alabang'},{name:'Cara',department:'HR',branch:'Makati'},{name:'Drew',department:'HR',branch:'Alabang'}];
 const teams=leaderboardTeams(employees);
 assert.deepEqual(teams.filter(([,team])=>team.department==='IT').map(([,team])=>team),[{department:'IT',branch:'All'}]);
 assert.equal(teams.filter(([,team])=>team.department==='HR').length,2);
 const team=teams.find(([,team])=>team.department==='IT')[1];
 assert.equal(buildLeaderboard([],{employees,department:team.department,branch:team.branch}).rows.length,2);
 assert.deepEqual(leaderboardTeams(employees,{fixedBranch:'Makati'}).find(([,team])=>team.department==='IT')[1],{department:'IT',branch:'Makati'});
});
