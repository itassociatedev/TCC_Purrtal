// Positions come from the supplied chart; a department does not automatically have a TL.
export const departmentLeadership = {
    Veterinary: { role: 'Team Leader', position: 'Senior Veterinarian Assistant Team Leader', branch: 'Makati' },
    'Vet Tech': { role: 'Team Leader', position: 'Veterinary Technician Team Leader', branch: 'Makati' },
    'Clinic Assistant': { role: 'Team Leader', position: 'Clinic Assistant Team Leader', branch: 'Makati' },
    Cashier: { role: 'Team Leader', position: 'Cashier Team Leader', branch: 'Makati' },
    Inventory: { role: 'Supervisor', position: 'Inventory Supervisor' },
    IT: { role: 'Supervisor', position: 'IT Supervisor' },
    Accounting: { role: 'Supervisor', position: 'Finance Supervisor' },
    Procurement: { role: 'Supervisor', position: 'Procurement Supervisor' },
};
export const corporatePositions = {
    HR: 'HR Manager', 'Internal Audit': 'Internal Auditor',
    'Operations & Finance': 'Operations & Finance Coordination Lead',
    'Sales & Marketing': 'Sales & Marketing Manager',
};

// The directory shows more than one leadership position within Veterinary and Vet Tech.
export const additionalTeamLeaderPositions = [
    { department: 'Veterinary', role: 'Team Leader', position: 'Junior Veterinarian Team Leader', branch: 'Alabang' },
    { department: 'Vet Tech', role: 'Team Leader', position: 'Veterinary Technician Assistant Team Leader', branch: 'Makati' },
    { department: 'IT', role: 'Team Leader', position: 'IT Team Leader', branch: 'Makati' },
];

// Upgrade saved sample identities once; tasks continue pointing to the same people.
export function applyOrganizationStructure(config) {
    if (config.organizationStructureVersion >= 5) return config;
    const next = structuredClone(config);
    const addRole = role => { if (!next.roles.some(item => item.name === role.name)) next.roles.push(role); };
    addRole({ name: 'Corporate Services', baseRole: 'EVP', departments: Object.keys(corporatePositions) });
    const leaders = [];
    for (const person of next.teamLeaders) {
        const extraPosition = additionalTeamLeaderPositions.find(item => item.department === person.department && item.position === person.position);
        if (extraPosition) { leaders.push({ ...person, ...extraPosition }); continue; }
        const position = departmentLeadership[person.department];
        if (position?.role === 'Team Leader') { const existing = additionalTeamLeaderPositions.find(item => item.department === person.department && item.position === person.position); leaders.push({ ...person, ...(existing || position) }); continue; }
        const role = corporatePositions[person.department];
        const branch = person.branch || next.branches[0];
        const converted = { ...person, role: role ? 'Corporate Services' : 'Employee', position: position?.position || role || ({ Reception: 'Receptionist', Security: 'Security Guard', Facilities: 'Company Driver', 'Customer Service': 'Customer Service Associate' }[person.department] || person.position), branch, availableBranches: [...next.branches], employeeType: position?.role === 'Supervisor' ? 'Supervisor' : 'Regular' };
        const target = role ? next.roleHolders : next.employees;
        if (!target.some(item => item.name === person.name)) target.push(converted);
    }
    next.teamLeaders = leaders;
    // Corporate is one access category; HR, Audit, Finance and Sales are positions inside it.
    const positions = new Set(Object.values(corporatePositions));
    const aliases = new Set(next.roles.filter(role => (positions.has(role.name) || role.name === 'Sales & Marketing') && (role.group === 'Corporate Services' || role.baseRole === 'EVP')).map(role => role.name));
    next.roleHolders = next.roleHolders.map(person => aliases.has(person.role) ? { ...person, position: person.role, role: 'Corporate Services' } : person);
    next.roles = next.roles.filter(role => !aliases.has(role.name));
    // Supervisor is an Employee subtype, with its position retained and no separate preview role.
    next.employees = next.employees.map(person => person.role === 'Supervisor' ? { ...person, role: 'Employee', employeeType: 'Supervisor' } : person);
    const supervisorMembers = next.roleHolders.filter(person => person.role === 'Supervisor');
    for (const person of supervisorMembers) if (!next.employees.some(item => item.name === person.name)) next.employees.push({ ...person, role: 'Employee', employeeType: 'Supervisor' });
    next.roleHolders = next.roleHolders.filter(person => person.role !== 'Supervisor');
    next.roles = next.roles.filter(role => role.name !== 'Supervisor');
    next.roleHolders = next.roleHolders.map(person => person.role === 'Corporate Services' && person.position === 'Sales & Marketing' ? { ...person, position: 'Sales & Marketing Manager' } : person);
    const names = new Set([...next.employees, ...next.roleHolders, ...next.operationsManagers, ...next.teamLeaders].map(person => person.name));
    let number = Math.max(0, ...[...names].map(name => Number(name.match(/^John Doe (\d+)$/)?.[1]) || 0));
    for (const position of additionalTeamLeaderPositions) {
        if (!next.departments.includes(position.department)) continue;
        if (!next.teamLeaders.some(person => person.department === position.department && person.position === position.position)) {
            while (names.has(`John Doe ${++number}`)) {}
            const name = `John Doe ${number}`;
            names.add(name);
            next.teamLeaders.push({ ...position, name });
        }
    }
    // Inventory has separate supervisors at Makati and Alabang, both inside Employee.
    if (next.departments.includes('Inventory') && next.branches.includes('Makati') && !next.employees.some(person => person.department === 'Inventory' && person.employeeType === 'Supervisor' && person.branch === 'Makati')) {
        while (names.has(`John Doe ${++number}`)) {}
        next.employees.push({ name: `John Doe ${number}`, department: 'Inventory', role: 'Employee', employeeType: 'Supervisor', position: 'Inventory Supervisor', branch: 'Makati', availableBranches: [...next.branches] });
    }
    next.employees = next.employees.map(person => person.position === 'Accounting Supervisor' ? { ...person, position: 'Finance Supervisor' } : person);
    next.organizationStructureVersion = 5;
    return next;
}
