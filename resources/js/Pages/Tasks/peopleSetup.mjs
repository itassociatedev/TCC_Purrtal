import { companySettings,rememberTaskDirectoryChanges } from './companyDirectory.mjs';
export const peopleGroups=['employees','teamLeaders','operationsManagers','roleHolders'];
export function workspacePeople(config,directory){
 const current=peopleGroups.flatMap(entity=>(config[entity]||[]).map(person=>({...person,entity,hidden:false})));
 const ids=new Set(current.map(person=>String(person.id)));
 const baseline=directory?companySettings({...config,taskPeopleOverrides:{380:{hidden:false}}},directory):null;
 const hidden=baseline?peopleGroups.flatMap(entity=>(baseline[entity]||[]).filter(person=>!ids.has(String(person.id))).map(person=>({...person,entity,hidden:true}))):[];
 for(const [id,override] of Object.entries(config.taskPeopleOverrides||{}))if(id.startsWith('local:')&&override.hidden&&override.changes){const person=override.changes;const role=config.roles.find(role=>role.name===person.role)?.baseRole;hidden.push({...person,entity:role==='Team Leader'?'teamLeaders':role==='Operations Manager'?'operationsManagers':role==='Employee'?'employees':'roleHolders',hidden:true});}
 return [...current,...hidden].map(person=>({...person,source:String(person.id).startsWith('local:')?'Task Module only':config.taskPeopleOverrides?.[person.id]||person.hidden?'Task Module override':'Employee Management',overriddenFields:Object.keys(config.taskPeopleOverrides?.[person.id]?.changes||{})})).sort((a,b)=>a.name.localeCompare(b.name));
}
export function resetTaskPerson(config,directory,id){
 const overrides={...(config.taskPeopleOverrides||{})};delete overrides[id];
 // Reset explicitly restores the database state, including earlier task-only exclusions.
 if(String(id)==='380')overrides[id]={hidden:false};
 return companySettings({...config,taskPeopleOverrides:overrides},directory);
}
export function editWorkspacePerson(config,id,value,tasks=[]){
 const all=peopleGroups.flatMap(key=>config[key]||[]);const old=id==null?null:all.find(person=>String(person.id)===String(id));
 const name=String(value.name||'').trim();const position=String(value.position||'').trim();
 if(!name||!position)throw new Error('Enter a name and position.');
 if(all.some(person=>person.id!==old?.id&&person.name.toLowerCase()===name.toLowerCase()))throw new Error('Another person already uses this name.');
 const role=config.roles.find(role=>role.name===value.role);
 if(!role||!config.departments.includes(value.department)||!config.branches.includes(value.branch))throw new Error('Choose a valid role, department and branch.');
 const availableBranches=[...new Set([value.branch,...(value.availableBranches||[])])];
 if(availableBranches.some(branch=>!config.branches.includes(branch)))throw new Error('Choose valid work branches.');
 if(old&&tasks.some(task=>task.assignee===old.name&&!['Completed','Denied'].includes(task.status)&&!availableBranches.includes(task.branch)))throw new Error('Reassign open tasks before removing one of their work branches.');
 if(role.baseRole==='Operations Manager'&&(config.operationsManagers||[]).some(person=>person.id!==old?.id&&person.branch===value.branch))throw new Error('This branch already has an Operations Manager. Edit that person or choose another branch.');
 const next=structuredClone(config);if(old)for(const key of peopleGroups)next[key]=next[key].filter(person=>String(person.id)!==String(id));
 const person={...old,id:old?.id||`local:${name}`,name,position,role:role.name,department:value.department,branch:value.branch,availableBranches,employeeType:value.employeeType||'Regular'};
 const target=role.baseRole==='Employee'?'employees':role.baseRole==='Team Leader'?'teamLeaders':role.baseRole==='Operations Manager'?'operationsManagers':'roleHolders';
 next[target].push(person);return rememberTaskDirectoryChanges(config,next);
}
