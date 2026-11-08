export function taskIdPrefix(source, department, role) {
    const value = String(source === 'role' ? role : department || '').trim();
    const parts = value.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (parts.length > 1) return parts.slice(0, 2).map(part => Array.from(part)[0] || '').join('').toUpperCase();
    return Array.from(parts[0] || 'TK').slice(0, 2).join('').toUpperCase();
}

export function createLocalTaskCode({ source = 'department', department, role, date = new Date() } = {}) {
    const day = date instanceof Date
        ? [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('')
        : String(date).replaceAll('-', '').slice(0, 8);
    const prefix = taskIdPrefix(source, department, role);
    const key = `task-module-id-sequence:${prefix}:${day}`;
    let sequence = 1;
    try {
        sequence = Number(localStorage.getItem(key) || 0) + 1;
        localStorage.setItem(key, String(sequence));
    } catch {
        sequence = Date.now() % 1_000_000;
    }
    return `${prefix}-${day}-${String(sequence).padStart(6, '0')}`;
}
