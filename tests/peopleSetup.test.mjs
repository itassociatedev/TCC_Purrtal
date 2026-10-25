import test from 'node:test';
import assert from 'node:assert/strict';
import {workspacePeople,resetTaskPerson,editWorkspacePerson} from '../resources/js/Pages/Tasks/peopleSetup.mjs';
import {companySettings} from '../resources/js/Pages/Tasks/companyDirectory.mjs';
import {defaultSettings} from '../resources/js/Pages/Tasks/taskSettings.mjs';
const directory={users:[{id:10,name:'Leader Person',position:'IT Team Leader',department:'IT',branch:'Makati',status:'Active'},{id:11,name:'Employee Person',position:'IT Associate',department:'IT',branch:'Makati',status:'Active'}]};
test('one people list contains all roles, field overrides and hidden employees without duplication',()=>{
 const base=defaultSettings();base.taskPeopleOverrides={10:{changes:{position:'Custom position'}},11:{hidden:true}};
 const config=companySettings(base,directory);const rows=workspacePeople(config,directory);
 assert.equal(rows.length,2);assert.equal(rows.find(p=>p.id===10).entity,'teamLeaders');assert.equal(rows.find(p=>p.id===10).source,'Task Module override');assert.deepEqual(rows.find(p=>p.id===10).overriddenFields,['position']);assert.equal(rows.find(p=>p.id===11).hidden,true);
});
test('reset removes only the selected override and restores current Employee Management data',()=>{
 const base=defaultSettings();base.taskPeopleOverrides={10:{changes:{position:'Custom position'}},11:{hidden:true}};
 const config=companySettings(base,directory);const reset=resetTaskPerson(config,directory,10);
 assert.equal(reset.teamLeaders[0].position,'IT Team Leader');assert.equal(reset.employees.length,0);assert.equal(config.teamLeaders[0].position,'Custom position');
});
test('hidden local people remain discoverable for restoration',()=>{
 const config=companySettings(defaultSettings(),directory);config.taskPeopleOverrides={'local:Person':{hidden:true,changes:{id:'local:Person',name:'Local Person',role:'Employee',department:'IT',branch:'Makati'}}};
 assert.equal(workspacePeople(config,directory).find(p=>p.id==='local:Person').hidden,true);
});
test('the unified editor moves a person between role groups and preserves the override on refresh',()=>{
 const config=companySettings(defaultSettings(),directory);const person=config.employees[0];
 const updated=editWorkspacePerson(config,person.id,{...person,position:'IT Team Leader',role:'Team Leader'});
 const refreshed=companySettings(updated,directory);
 assert.equal(refreshed.teamLeaders.find(p=>p.id===person.id).role,'Team Leader');assert.equal(refreshed.employees.some(p=>p.id===person.id),false);
 const reset=resetTaskPerson(refreshed,directory,person.id);assert.equal(reset.employees.find(p=>p.id===person.id).role,'Employee');
});
test('adding local people preserves existing people and rejects duplicate names',()=>{
 const config=companySettings(defaultSettings(),directory);const value={name:'Local Example',position:'IT Associate',role:'Employee',department:'IT',branch:'Makati',availableBranches:['Makati']};
 const updated=editWorkspacePerson(config,null,value);const refreshed=companySettings(updated,directory);assert.equal(workspacePeople(refreshed,directory).length,3);
 assert.throws(()=>editWorkspacePerson(updated,null,value),/already/);
});
test('People edits protect open assignments and existing branch managers',()=>{
 const config=companySettings(defaultSettings(),directory);const person=config.employees[0];
 assert.throws(()=>editWorkspacePerson(config,person.id,{...person,branch:'Alabang',availableBranches:['Alabang']},[{assignee:person.name,branch:'Makati',status:'In Progress'}]),/Reassign open tasks/);
 config.operationsManagers=[{id:99,name:'Existing Manager',branch:'Makati',role:'Operations Manager'}];
 assert.throws(()=>editWorkspacePerson(config,person.id,{...person,role:'Operations Manager'}),/already has/);
});
