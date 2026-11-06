export const rolePreviewStorageKey = userId => `tcc-role-preview-v1-${userId || 'guest'}`;

export function readRolePreview(userId) {
    try {
        const value = localStorage.getItem(rolePreviewStorageKey(userId));
        return value ? JSON.parse(value) : null;
    } catch {
        return null;
    }
}

export function publishRolePreview(userId, preview) {
    try {
        localStorage.setItem(rolePreviewStorageKey(userId), JSON.stringify(preview));
    } catch {
        // Preview display should not interrupt normal page use when storage is unavailable.
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tcc-role-preview-change', { detail: preview }));
    }
}
