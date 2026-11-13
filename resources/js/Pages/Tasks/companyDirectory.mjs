import rosterReference from './companyRosterReference.json';
const excludedPerson = person => /^(cris araya|sheryl segovia|sherry segovia)$/.test(normalized(person.name));
const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const departmentRules = [
 [/^it\b|information technology/,'IT'], [/procurement/,'Procurement'], [/inventory/,'Inventory'],
 [/audit/,'Internal Audit'], [/operations.*finance|coordination lead/,'Operations & Finance'],
 [/finance|accounting/,'Accounting'], [/human resources|^hr\b/,'HR'], [/marketing|sales/,'Sales & Marketing'],
 [/technician|vet tech/,'Vet Tech'], [/veterinar/,'Veterinary'], [/clinic assistant|groomer/,'Clinic Assistant'],
 [/front desk|reception/,'Reception'], [/cashier|billing/,'Cashier'], [/security/,'Security'],
 [/driver|housekeeping|facilities|utility/,'Facilities'],
 [/operations? manager|executive assistant|^operations$/,'Clinic Operations Manager'],
];
function departmentFor(user) {
    for (const text of [normalized(user.position),normalized(user.department)]) {
        const match=departmentRules.find(([pattern])=>pattern.test(text));
        if(match)return match[1];
    }
    return user.department || 'Operations & Finance';
}
function referenceFor(user) {
    const name = normalized(user.name).replace(/\b(dr|chrp|rpm)\b/g, '').trim();
    const candidates = rosterReference.filter(person => {
        const reference = normalized(person.name).replace(/\b(dr|chrp|rpm)\b/g, '').trim();
        if (reference === name) return true;
        const tokens = reference.split(' ').filter(token => token.length > 2);
        const userTokens = name.split(' ');
        return tokens.length >= 2 && tokens.every(token => userTokens.includes(token));
    });
    return candidates.length === 1 ? candidates[0] : null;
}

export function companySettings(config,directory) {
    if(!directory)return config;
    const savedPeople=['employees','teamLeaders','operationsManagers','roleHolders'].flatMap(key=>config[key]||[]);
    const overrides={380:{hidden:true},...(config.taskPeopleOverrides||{})};
    // Restore the active marketing manager requested for the task directory.
    if (overrides[225]) overrides[225] = { ...overrides[225], hidden: false };
    let people=(directory.users||[]).filter(user=>user.name && !excludedPerson(user) && !overrides[user.id]?.hidden && !/disabled|inactive|terminated/i.test(user.status||'') && !/^(the cat clinic|admin|test|john doe)(\b|$)/i.test(user.name)).map(user=>{
        const saved=savedPeople.find(person=>person.id===user.id || person.accountName===user.name || person.name===user.name);
        const reference = referenceFor(user);
        const currentUser = reference ? {
            ...user,
            position: reference.position,
            department: '',
            branch: reference.branch || user.branch,
        } : user;
        const title=normalized(currentUser.position);
        const role=/executive vice president|^evp$/.test(title)?'EVP'
            : /chief veterinar/.test(title)?'Chief Vet'
            : /operations? manager/.test(title)?'Operations Manager'
            : /hr manager|human resources business partner|internal auditor|coordination lead|marketing manager/.test(title)?'Corporate Services'
            : /team leader|\btl\b|\bsupervisor\b/.test(title)?'Team Leader':'Employee';
        const organizationWide = role === 'EVP' || role === 'Corporate Services'
            || departmentFor(currentUser) === 'IT' && role === 'Team Leader'
            || /procurement supervisor|company driver|reliever/.test(title);
        const availableBranches = organizationWide
            ? [...new Set([...(directory.branches || []).map(branch => typeof branch === 'string' ? branch : branch.name), ...config.branches])]
            : [...new Set([currentUser.branch, ...(user.branches || [])].filter(Boolean))];
        const branch=currentUser.branch||availableBranches[0]||config.branches[0];
        return {id:user.id,name:user.id === 225 ? 'Ma. Sharlhyn Tolentino' : user.name,position:departmentFor(currentUser)==='IT'&&role==='Team Leader'?'IT Supervisor':currentUser.position||'Team member',department:departmentFor(currentUser),branch,team:reference?.team,
            role,accountName:user.name,accountLinked:true,
            previousNames:[...new Set([...(saved?.previousNames||[]),user.name,saved?.name,saved?.accountName].filter(Boolean))],
            ...(saved?.branchSchedule?{branchSchedule:saved.branchSchedule}:{}),
            availableBranches:availableBranches.length?availableBranches:[branch],
            employeeType:/\bintern\b/.test(title)?'Intern':/supervisor/.test(title)?'Supervisor':'Regular',
            ...(overrides[user.id]?.changes||{})};
    });
    people.push(...Object.entries(overrides).filter(([key,value])=>key.startsWith('local:')&&!value.hidden).map(([,value])=>value.changes));
    people = people.filter(person => !excludedPerson(person)).map(person => {
        const department = departmentFor(person);
        if (person.id === 225) return { ...person, name: 'Ma. Sharlhyn Tolentino',
            position: 'Sales & Marketing Manager', department: 'Sales & Marketing',
            role: 'Corporate Services', availableBranches: [...config.branches] };
        return { ...person, department };
    });
    if (directory.authoritative) {
        people = people.map(person => {
            const access = directory.users.find(user => user.id === person.id)?.taskAccess;
            if (!access || access.role === 'Admin') return person;
            return { ...person, role: access.role, position: access.position,
                department: access.department, availableBranches: access.branches,
                branch: access.branches.includes(person.branch) ? person.branch : access.branches[0] };
        });
    }
    return {...config,companyDirectory:true,rosterVersion:'employee-management',organizationStructureVersion:5,
        departments:[...new Set(people.map(person=>person.department))],
        branches:[...new Set(people.flatMap(person=>person.availableBranches))],
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
