// Structured counts keep the copyable report totals consistent with its individual entries.
export const operationGroups = [['doctors', 'DOCTOR LOAD (Today)'], ['offDoctors', 'Doctor(s) Off'], ['surgeries', 'Surgery'], ['wellness', 'Wellness Total'], ['promos', 'ECU/Promo'], ['procedures', 'OTHER PROCEDURES']];
export const totalCats = rows => rows.reduce((sum, row) => sum + Number(row.count || 0), 0);
export function validateOperations(report, branches, day) {
    if (!branches.includes(report.branch) || report.date !== day) return 'Choose an allowed branch and use the scheduled report date.';
    if (!report.reportedBy?.trim()) return 'Enter the reporter’s name.';
    for (const [key] of operationGroups) {
        if (report[key].some(row => !row.name.trim() || !Number.isInteger(Number(row.count)) || row.count === '' || Number(row.count) < 0)) return 'Each entry needs a name and a whole-number count of zero or more.';
    }
    if ([report.nonVet, report.newConfinement, report.discharged].some(value => value === '' || !Number.isInteger(Number(value)) || Number(value) < 0)) return 'Enter whole-number counts of zero or more.';
    return '';
}
export function formatOperations(report) {
    const groups = operationGroups.map(([key, label]) => {
        const total = ['surgeries', 'wellness', 'promos'].includes(key) ? `: ${totalCats(report[key])} Cats` : '';
        const entries = report[key].map(row => `- ${row.name} - ${row.count}${key === 'procedures' ? '' : ' Cats'}`).join('\n') || 'None';
        return `${label}${total}\n${entries}${key === 'doctors' ? `\n- Non-vet sales - ${report.nonVet} Cats` : ''}`;
    });
    return `🐾 TCC DAILY OPERATIONS REPORT\nDate: ${report.date}\nBranch: ${report.branch}\n\n${groups.join('\n\n————————————————\n\n')}\n\n————————————————\nCONFINEMENT MOVEMENT\n- New Confinement: ${report.newConfinement} Cats\n- Discharged: ${report.discharged} Cats\n\nNOTES: ${report.notes?.trim() || 'N/a'}\nReported by: ${report.reportedBy}`;
}
