// Stable system keys allow checklist drafts and reviewed reports to survive browser refreshes.
export const systemChecks = [
    ['internet', 'Internet'], ['printers', 'Printers'], ['frontDesk', 'Computers (Front desk)'],
    ['laboratory', 'Computers (Laboratory)'], ['labSystems', 'Lab Systems'], ['tvMachines', 'TV / Machines'],
];
// Use the saved checklist snapshot, including custom systems and draft warnings.
export function openingWarningLabels(task) {
    if (task?.template !== 'it-opening-rounds' || !task.rounds?.systems) return [];
    const labels = Object.fromEntries(task.rounds.checks || systemChecks);
    return Object.entries(task.rounds.systems).filter(([,value]) => value === 'warning').map(([key]) => labels[key] || key);
}
export function emptyRounds(date, branch, checks = systemChecks, department = 'IT') {
    return { date, branch, department, checks: checks.map(row => [...row]), headcount: '', leave: '', off: '', systems: Object.fromEntries(checks.map(([key]) => [key, ''])), issues: '', helpNeeded: '' };
}
export function validateRounds(rounds, { branches = ['Alabang', 'Makati', 'Greenhills'], itDepartment = 'IT' } = {}) {
    const checks = rounds.checks || systemChecks;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rounds.date || '') || Number.isNaN(Date.parse(rounds.date)) || new Date(rounds.date).toISOString().slice(0, 10) !== rounds.date) return 'Choose a valid rounds date.';
    if (!branches.includes(rounds.branch) || rounds.department !== itDepartment) return 'Choose a supported branch allowed for this IT checklist.';
    if (['headcount', 'leave', 'off'].some(key => rounds[key] == null || String(rounds[key]).trim() === '' || !Number.isSafeInteger(Number(rounds[key])) || Number(rounds[key]) < 0)) return 'Enter a whole number of zero or more for each manpower field.';
    if (checks.some(([key]) => !['good', 'warning'].includes(rounds.systems?.[key]))) return 'Mark every system as Good or Warning before submitting.';
    if (checks.some(([key]) => rounds.systems[key] === 'warning') && (!rounds.issues?.trim() || /^(none|n\/a|no issues)\.?$/i.test(rounds.issues.trim()))) return 'Describe the issue or maintenance needed for the systems marked Warning.';
    return '';
}
// Match the requested Daily Rounds Update format for review and clipboard sharing.
export function formatRounds(rounds) {
    const checks = rounds.checks || systemChecks;
    const [year, month, day] = rounds.date.split('-');
    return `Daily Rounds Update\n\nDate : ${month}/${day}/${year}\nBranch : ${rounds.branch}\nDepartment : ${rounds.department || 'IT'}\n\nMANPOWER\n• Headcount: ${rounds.headcount}\n• Leave: ${rounds.leave}\n• Off: ${rounds.off}\n\nSYSTEM STATUS\n${checks.map(([key, label]) => `• ${label}: ${rounds.systems[key] === 'good' ? '✅' : rounds.systems[key] === 'warning' ? '⚠️' : 'Not checked'}`).join('\n')}\n\nISSUES / MAINTENANCE\n• ${rounds.issues?.trim() || 'None'}\n\nHELP NEEDED\n• ${rounds.helpNeeded?.trim() || 'None'}${rounds.images?.length ? '\n\nISSUE IMAGES\n' + rounds.images.map(image => '• ' + image.name).join('\n') : ''}`;
}
