// Assignment identities are people, including leadership members; a role label itself is not an assignee.
export function defaultRoleHolders(config) {
    const offset = Math.max(0, ...[...config.employees, ...config.operationsManagers, ...config.teamLeaders, ...(config.roleHolders || [])].map(person => Number(person.name.match(/^John Doe (\d+)$/)?.[1]) || 0));
    const department = config.departments.includes('Operations & Finance') ? 'Operations & Finance' : config.departments[0];
    let number = offset;
    return config.roles.filter(role => ['Chief Vet', 'EVP'].includes(role.baseRole)).flatMap(role => (role.baseRole === 'Chief Vet' ? config.branches : [config.branches[0]]).map(branch => ({ name: `John Doe ${++number}`, role: role.name, department: role.baseRole === 'Chief Vet' && config.departments.includes('Veterinary') ? 'Veterinary' : department, branch, availableBranches: [...config.branches], position: role.name })));
}
export function assignmentDirectory(config) {
    const roleName = base => config.roles.find(role => role.baseRole === base)?.name || base;
    const people = [
        ...config.employees,
        ...config.teamLeaders.map(person => ({ ...person, role: person.role || roleName('Team Leader'), branch: person.branch || config.branches[0], availableBranches: person.availableBranches || [...config.branches], position: person.position || 'Team Leader' })),
        ...config.operationsManagers.map(person => ({ ...person, role: roleName('Operations Manager'), department: person.department || (config.departments.includes('Operations & Finance') ? 'Operations & Finance' : config.departments[0]), availableBranches: person.availableBranches || [...config.branches], position: person.position || 'Operations Manager' })),
        ...(config.roleHolders || defaultRoleHolders(config)),
    ];
    return people.map(person => ({ ...person, baseRole: config.roles.find(role => role.name === person.role)?.baseRole || 'Employee', roleGroup: config.roles.find(role => role.name === person.role)?.group }));
}
export const isEvpDirectReport=person=>['Operations Manager','Team Leader'].includes(person?.baseRole)||person?.role==='Corporate Services'||person?.roleGroup==='Corporate Services';
export const canAssignAcrossRoles = role => ['EVP', 'Operations Manager', 'Corporate Services'].includes(role);
export function eligibleAssignees(config, scope) {
    const people = assignmentDirectory(config);
    const actor = people.find(person => person.name === scope.actor)
        || (scope.role === 'Employee' ? people.find(person => person.name === scope.employee) : undefined);
    const branches = actor?.availableBranches || [actor?.branch || scope.branch];
    const sameBranch = person => (person.availableBranches || [person.branch]).some(branch => branches.includes(branch));
    const corporateDepartments = actor?.department === 'Operations & Finance'
        ? ['Accounting', 'Procurement', 'Internal Audit', 'IT', 'Operations & Finance'] : [actor?.department];
    return people.filter(person => {
        if (person.name === actor?.name) return true;
        if (scope.role === 'Admin') return true;
        if (person.baseRole === 'Team Leader') {
            if (scope.role === 'Operations Manager') return true;
            if (scope.collaborative && ['Team Leader','Chief Vet'].includes(scope.role)) return true;
            if ((actor?.role === 'Corporate Services' || scope.roleName === 'Corporate Services')
                && (scope.collaborative || ['Internal Audit','Operations & Finance'].includes(actor?.department))) return true;
        }
        if (actor?.department === 'Operations & Finance' && actor?.role === 'Corporate Services'
            && person.department === (config.itDepartment || 'IT') && person.baseRole === 'Employee') return false;
        if (actor?.role === 'Corporate Services' || scope.roleName === 'Corporate Services')
            return ['Team Leader','Employee'].includes(person.baseRole) && corporateDepartments.includes(person.department);
        if (scope.role === 'EVP') return ['Operations Manager','Chief Vet','Team Leader'].includes(person.baseRole) || person.role === 'Corporate Services';
        if (scope.role === 'Operations Manager' && scope.collaborative && person.baseRole === 'Operations Manager') return true;
        if (scope.role === 'Operations Manager')
            return ['Team Leader','Employee'].includes(person.baseRole) && sameBranch(person);
        if (scope.role === 'Chief Vet')
            return ['Team Leader','Employee'].includes(person.baseRole) && ['Veterinary','Vet Tech','Clinic Assistant'].includes(person.department) && sameBranch(person);
        if (scope.role === 'Team Leader' && actor?.department === (config.itDepartment || 'IT')
            && person.role === 'Corporate Services') return true;
        if (scope.role === 'Team Leader')
            return (person.baseRole === 'Team Leader'
                && (actor?.department === (config.itDepartment || 'IT') || person.department === (config.itDepartment || 'IT')))
                || (person.baseRole === 'Employee' && person.department === actor?.department && sameBranch(person));
        return false;
    });
}

// Editing preserves the saved owner even when that role cannot be assigned from a new-task form.
// This adds only the existing owner; it does not expand the viewer's reassignment permissions.
export function taskEditAssignees(config, scope, task) {
    const choices = eligibleAssignees(config, scope);
    if (!task?.assignee) return choices;
    const owner = assignmentDirectory(config).find(person => person.name === task.assignee);
    const current = { ...(owner || {}), name: task.assignee, role: task.assigneeRole || owner?.role || 'Employee',
        department: task.department, branch: task.branch,
        availableBranches: [...new Set([...(owner?.availableBranches || []), task.branch])] };
    return [...choices.filter(person => person.name !== task.assignee), current];
}
