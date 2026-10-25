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
export const canAssignAcrossRoles = role => ['EVP', 'Operations Manager'].includes(role);
export function eligibleAssignees(config, scope) {
    const people = assignmentDirectory(config);
    if (canAssignAcrossRoles(scope.role)) return people;
    if (scope.role === 'Employee') return people.filter(person => person.name === scope.employee);
    if (scope.role === 'Team Leader') return people.filter(person => person.baseRole === 'Employee' || person.name === scope.actor);
    return config.employees.filter(person => (person.availableBranches || [person.branch]).includes(scope.branch));
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
