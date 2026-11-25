import test from 'node:test';
import assert from 'node:assert/strict';
import {sortPreviewRoles,groupPreviewPeople,previewMember} from '../resources/js/Pages/Tasks/previewDirectory.mjs';
test('preview hierarchy starts at EVP and ends at Employee, preserving custom role workflows',()=>{
 const roles=['Employee','Team Leader','Chief Vet','EVP','Operations Manager'].map(name=>({name,baseRole:name}));roles.push({name:'Corporate Services',baseRole:'EVP'});
 assert.deepEqual(sortPreviewRoles(roles).map(r=>r.name),['EVP','Corporate Services','Operations Manager','Chief Vet','Team Leader','Employee']);assert.equal(roles[0].name,'Employee');
});
test('people group by department and matching positions stay together across branches',()=>{
 const people=[{name:'Z',department:'IT',position:'IT Team Leader',branch:'Makati'},{name:'B',department:'Inventory',position:'Inventory Team Leader',branch:'Makati'},{name:'A',department:'IT',position:'IT Team Leader',branch:'Alabang'}];
 const groups=groupPreviewPeople(people);assert.deepEqual(groups.map(g=>g.department),['Inventory','IT']);assert.deepEqual(groups[1].people.map(p=>p.name),['A','Z']);assert.equal(people[0].name,'Z');
});
test('selecting a Chief Vet changes branch immediately without a separate location selection',()=>{
 const members=[{name:'Makati Vet',branch:'Makati'},{name:'Alabang Vet',branch:'Alabang'}];
 assert.equal(previewMember(members,'Alabang Vet','Makati').branch,'Alabang');
 assert.equal(previewMember(members,'Removed Vet','Makati').name,'Makati Vet');
 assert.equal(previewMember([],null,'Makati'),undefined);
});
