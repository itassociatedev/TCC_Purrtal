// Built-in reports retain their specialized forms; new templates use the configurable field form.
export function defaultReportTemplates(config) {
    return [
        { id: 'it-opening-rounds', name: 'Opening Rounds', department: config.itDepartment || 'IT', description: 'Start-of-day IT checklist', enabled: true, fields: [] },
        { id: 'narrative-report', name: 'Narrative Report', department: config.itDepartment || 'IT', description: 'End-of-day summary, accomplishments, and follow-ups', enabled: true, fields: [] },
        { id: 'daily-operations', name: 'Daily Operations Report', department: config.cashierDepartment || 'Cashier', description: 'Doctor loads, procedures, and confinement movements', enabled: true, fields: [] },
    ];
}
export const reportTemplates = config => config.dailyReports || defaultReportTemplates(config);
export function editReportTemplates(config, tasks, { action, original, value }) {
    const reports = structuredClone(reportTemplates(config));
    const index = reports.findIndex(report => report.id === original);
    if (action !== 'add' && index < 0) throw new Error('This report no longer exists.');
    if (action === 'remove') reports.splice(index, 1);
    else {
        const name = value.name?.trim();
        if (!name || !config.departments.includes(value.department)) throw new Error('Enter a report name and choose a department.');
        if (reports.some((report, i) => i !== index && report.name.toLowerCase() === name.toLowerCase())) throw new Error('That report name is already in use.');
        const builtIn = index >= 0 && !reports[index].id.startsWith('daily-custom-');
        if (builtIn && value.department !== reports[index].department) throw new Error('Built-in reports keep their existing department. Create a new report for another department.');
        const fields = (value.fields || []).map(field => ({ ...field, label: field.label.trim() }));
        if (!builtIn && (!fields.length || fields.some(field => !field.label || !['text', 'textarea', 'number', 'status'].includes(field.type)) || new Set(fields.map(field => field.id)).size !== fields.length)) throw new Error('Add at least one field with a label and supported type.');
        const record = { id: index >= 0 ? reports[index].id : `daily-custom-${globalThis.crypto.randomUUID()}`, name, department: value.department, description: value.description?.trim() || '', enabled: value.enabled !== false, fields };
        if (action === 'add') reports.push(record); else reports[index] = record;
    }
    // Existing task snapshots stay available; disabling/removing a template only stops new daily assignments.
    return { config: { ...config, dailyReports: reports }, tasks };
}
export function formatCustomReport(task, report) {
    const definition = task.reportDefinition;
    return `${task.title}\nDate: ${report.date}\nBranch: ${report.branch}\nDepartment: ${task.department}\n\n${definition.fields.map(field => `${field.label}\n${report.values[field.id] ?? ''}`).join('\n\n')}`;
}
