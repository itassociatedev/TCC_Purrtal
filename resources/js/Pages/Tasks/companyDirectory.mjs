const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const departmentRules = [
 [/^it$|information technology/,'IT'], [/procurement/,'Procurement'], [/inventory/,'Inventory'],
 [/audit/,'Internal Audit'], [/operations.*finance|coordination lead/,'Operations & Finance'],
 [/finance|accounting/,'Accounting'], [/human resources|^hr$/,'HR'], [/marketing|sales/,'Sales & Marketing'],
 [/technician|vet tech/,'Vet Tech'], [/veterinar/,'Veterinary'], [/clinic assistant|groomer/,'Clinic Assistant'],
 [/front desk|reception/,'Reception'], [/cashier|billing/,'Cashier'], [/security/,'Security'],
 [/driver|housekeeping|facilities/,'Facilities'],
];
function departmentFor(user) {
    for (const text of [normalized(user.department),normalized(user.position)]) {
        const match=departmentRules.find(([pattern])=>pattern.test(text));
        if(match)return match[1];
    }
    return user.department || 'Operations & Finance';
}
export function companySettings(config,directory) {
    if(!directory)return config;
    const savedPeople=['employees','teamLeaders','operationsManagers','roleHolders'].flatMap(key=>config[key]||[]);
    const overrides={380:{hidden:true},...(config.taskPeopleOverrides||{})};
    let people=(directory.users||[]).filter(user=>user.name && !overrides[user.id]?.hidden && !/disabled|inactive|terminated/i.test(user.status||'') && !/^(the cat clinic|admin|test|john doe)(\b|$)/i.test(user.name)).map(user=>{
        const saved=savedPeople.find(person=>person.id===user.id || person.accountName===user.name || person.name===user.name);
        const title=normalized(user.position);
        const role=/executive vice president|^evp$/.test(title)?'EVP'
            : /chief veterinar/.test(title)?'Chief Vet'
            : /operations? manager/.test(title)?'Operations Manager'
            : /hr manager|human resources business partner|internal auditor|coordination lead|marketing manager/.test(title)?'Corporate Services'
            : /team leader|\btl\b|^it supervisor$/.test(title)?'Team Leader':'Employee';
        const availableBranches=[...new Set([user.branch,...(user.branches||[])].filter(Boolean))];
        const branch=user.branch||availableBranches[0]||config.branches[0];
        return {id:user.id,name:user.name,position:user.position||'Team member',department:departmentFor(user),branch,
            role,accountName:user.name,accountLinked:true,
            previousNames:[...new Set([...(saved?.previousNames||[]),saved?.name,saved?.accountName].filter(Boolean))],
            ...(saved?.branchSchedule?{branchSchedule:saved.branchSchedule}:{}),
            availableBranches:availableBranches.length?availableBranches:[branch],
            employeeType:/\bintern\b/.test(title)?'Intern':/supervisor/.test(title)?'Supervisor':'Regular',
            ...(overrides[user.id]?.changes||{})};
    });
    people.push(...Object.entries(overrides).filter(([key,value])=>key.startsWith('local:')&&!value.hidden).map(([,value])=>value.changes));
    return {...config,companyDirectory:true,rosterVersion:'employee-management',organizationStructureVersion:5,
        departments:[...new Set([...config.departments,...people.map(person=>person.department)])],
        branches:[...new Set([...config.branches,...people.flatMap(person=>person.availableBranches)])],
        employees:people.filter(person=>person.role==='Employee'),
        operationsManagers:people.filter(person=>person.role==='Operations Manager'),
        teamLeaders:people.filter(person=>person.role==='Team Leader'),
        roleHolders:people.filter(person=>['EVP','Chief Vet','Corporate Services'].includes(person.role))};
}
const directoryGroups=['employees','teamLeaders','operationsManagers','roleHolders'];
export function rememberTaskDirectoryChanges(before,after) {
    const overrides={...(before.taskPeopleOverrides||{})};
    const oldPeople=directoryGroups.flatMap(key=>before[key]||[]);
    const newPeople=directoryGroups.flatMap(key=>after[key]||[]);
    const fields=['name','position','department','branch','availableBranches','role','employeeType'];
    for(const person of newPeople){
        const previous=oldPeople.find(old=>person.id?old.id===person.id:old.name===person.name);
        if(!previous){
            const id=person.id||`local:${person.name}`;person.id=id;
            overrides[id]={changes:{...person,id}};continue;
        }
        const changes={...(overrides[person.id]?.changes||{})};
        for(const key of fields)if(JSON.stringify(person[key])!==JSON.stringify(previous[key]))changes[key]=person[key];
        if(Object.keys(changes).length)overrides[person.id]={...(overrides[person.id]||{}),changes};
    }
    for(const person of oldPeople)if(!newPeople.some(next=>person.id?next.id===person.id:next.name===person.name))overrides[person.id]={...(overrides[person.id]||{}),hidden:true};
    return {...after,taskPeopleOverrides:overrides};
}
export function reconcileRosterTasks(tasks,config) {
    const people=['employees','operationsManagers','teamLeaders','roleHolders'].flatMap(key=>config[key]||[]);
    const aliases=new Map(people.flatMap(person=>[person.accountName,...(person.previousNames||[])].filter(Boolean).map(name=>[name,person.name])));
    const rename=name=>aliases.get(name)||name;
    return tasks.map(task=>({...task,assignee:rename(task.assignee),coordinator:rename(task.coordinator),
        coordinators:task.coordinators?.map(rename),requestedBy:rename(task.requestedBy),
        pings:task.pings?.map(ping=>({...ping,assignee:rename(ping.assignee),sender:rename(ping.sender)}))}));
}
