import test from 'node:test';
import assert from 'node:assert/strict';
import {companySettings,reconcileRosterTasks,rememberTaskDirectoryChanges} from '../resources/js/Pages/Tasks/companyDirectory.mjs';
import {defaultSettings} from '../resources/js/Pages/Tasks/taskSettings.mjs';
const user=(id,name,position='IT Associate',department='Information Technology',status='Active')=>({id,name,position,department,status,branch:'Makati',branches:['Makati']});
const all=c=>['employees','teamLeaders','operationsManagers','roleHolders'].flatMap(key=>c[key]);
test('new employees appear directly from Employee Management without a chart card',()=>{
 const data={users:[user(1,'New Employee')],members:[],excludedMemberIds:[1]};
 const first=companySettings(defaultSettings(),data);assert.equal(first.employees[0].id,1);
 data.users.push(user(2,'Another Employee'));assert.equal(all(companySettings(first,data)).length,2);
});
test('disabled and removed employees disappear while other statuses remain available',()=>{
 const config=defaultSettings();const data={users:[user(1,'First Employee'),user(2,'Onboarding Employee','IT Intern','Information Technology','Pending Setup'),user(3,'Reset Employee','IT Associate','Information Technology','Password Reset')]};
 assert.equal(all(companySettings(config,data)).length,3);
 data.users[0].status='Disabled';assert.equal(all(companySettings(config,data)).length,2);
 data.users.splice(1,1);assert.deepEqual(all(companySettings(config,data)).map(p=>p.name),['Reset Employee']);
});
test('employee positions and branches override stale organization chart data without mutating either',()=>{
 const data={users:[{...user(1,'Example Person','Inventory Supervisor','Inventory'),branch:'Alabang',branches:['Alabang','Makati']}],members:[{id:1,name:'Example Person',position:'IT Team Leader',branch:'Makati'}]};
 const original=structuredClone(data);const config=companySettings(defaultSettings(),data);
 assert.equal(config.employees[0].department,'Inventory');assert.equal(config.employees[0].employeeType,'Supervisor');assert.equal(config.employees[0].branch,'Alabang');assert.deepEqual(data,original);
});
test('roles come from employee positions, including TL abbreviations and corporate positions',()=>{
 const config=companySettings(defaultSettings(),{users:[user(1,'Example TL','Clinic Assistant TL','Clinic Assistants'),user(2,'Example OM','Operations Manager','Operations'),user(3,'Example HR','Human Resources Business Partner','Human Resources'),user(4,'Example EVP','Executive Vice President','Executive'),user(5,'Example Auditor','Internal Auditor','Audit')]});
 assert.equal(config.teamLeaders[0].department,'Clinic Assistant');assert.equal(config.operationsManagers[0].id,2);
 assert.equal(config.roleHolders.find(p=>p.id===3).role,'Corporate Services');assert.equal(config.roleHolders.find(p=>p.id===4).role,'EVP');assert.equal(config.roleHolders.find(p=>p.id===5).employeeType,'Regular');
});
test('renames preserve schedules and task identity by stable employee ID',()=>{
 const config=defaultSettings();config.employees=[{id:5,name:'Previous Name',accountName:'Previous Name',branchSchedule:{'2026-10-26':'Greenhills'}}];
 const updated=companySettings(config,{users:[user(5,'Updated Name')]});
 const tasks=[{id:99,assignee:'Previous Name',coordinator:'Previous Name',history:[{text:'Original approval'}],submission:'Original result'}];
 const migrated=reconcileRosterTasks(tasks,updated)[0];assert.equal(migrated.assignee,'Updated Name');assert.equal(migrated.coordinator,'Updated Name');assert.deepEqual(migrated.history,tasks[0].history);assert.deepEqual(updated.employees[0].branchSchedule,{'2026-10-26':'Greenhills'});
});
test('service accounts and sample placeholders are excluded without hiding real staff with admin permissions',()=>{
 const config=companySettings(defaultSettings(),{users:[user(1,'The Cat Clinic','IT Admin'),user(2,'John Doe'),user(3,'Example Administrator','IT Associate')]});assert.deepEqual(all(config).map(p=>p.id),[3]);
});
test('Task-only edits survive directory refresh while unrelated database changes still flow through',()=>{
 const data={users:[user(50,'Employee One'),user(51,'Employee Two')]};
 const before=companySettings(defaultSettings(),data);const after=structuredClone(before);
 after.employees.find(p=>p.id===50).position='IT Specialist';
 const saved=rememberTaskDirectoryChanges(before,after);
 data.users[1].branch='Greenhills';
 const refreshed=companySettings(saved,data);
 assert.equal(refreshed.employees.find(p=>p.id===50).position,'IT Specialist');
 assert.equal(refreshed.employees.find(p=>p.id===51).branch,'Greenhills');
 assert.equal(data.users[0].position,'IT Associate');
});
test('Task-only hiding preserves saved task records and excludes Nicolai as confirmed by user',()=>{
 const config=defaultSettings();config.taskPeopleOverrides={50:{hidden:true}};
 const data={users:[user(50,'Hidden Person'),user(380,'Nicolai Mark Caniedo'),user(51,'Current Person')]};
 assert.deepEqual(all(companySettings(config,data)).map(p=>p.id),[51]);
});
