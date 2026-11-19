export function taskIdPrefix(source, department, role) {
    const value = String(source === 'role' ? role : department || '').trim();
    const parts = value.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (parts.length > 1) return parts.slice(0, 2).map(part => Array.from(part)[0] || '').join('').toUpperCase();
    return Array.from(parts[0] || 'TK').slice(0, 2).join('').toUpperCase();
}

export function createLocalTaskCode({ source = 'department', department, role, date = new Date(), format = {} } = {}) {
    const parts = date instanceof Date ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date) : null;
    const iso = parts ? ['year','month','day'].map(type => parts.find(part => part.type === type).value).join('-') : String(date);
    const [year,month,day] = iso.includes('-') ? iso.split('-') : [iso.slice(0,4),iso.slice(4,6),iso.slice(6,8)];
    const dateFormat = format.dateFormat || 'my';
    const period = { my: month + year.slice(-2), mY: month + year, Ym: year + month, Ymd: year + month + day }[dateFormat];
    const digits = Number(format.digits || 5), separator = format.separator || '-';
    const prefix = taskIdPrefix(format.prefixSource || source, department, role);
    const key = `task-module-id-v2:${prefix}:${period}:${digits}:${separator}`;
    const sequence = Number(localStorage.getItem(key) || 0) + 1;
    const max = 10 ** digits - 1;
    if (!Number.isSafeInteger(sequence) || sequence > max) throw new Error(`Task ID limit (${max}) reached for ${prefix}-${period}. Increase the sequence digits in Workspace Setup.`);
    localStorage.setItem(key, String(sequence));
    if (sequence === max && typeof window !== 'undefined') setTimeout(() => window.dispatchEvent(new CustomEvent('tcc-task-id-limit', { detail: `Task ID limit reached for ${prefix}-${period}. Update the ID format in Workspace Setup.` })), 0);
    return `${prefix}${separator}${period}${separator}${String(sequence).padStart(digits, '0')}`;
}
