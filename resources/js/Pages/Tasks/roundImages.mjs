// Store image blobs outside localStorage so photos do not exhaust the task JSON quota.
export const imageLimit = 6;
export const imageSizeLimit = 3 * 1024 * 1024;
export function validateIssueImages(files, existing = 0) {
    if (files.length + existing > imageLimit) return `Attach up to ${imageLimit} images per report.`;
    for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose JPG, PNG, or WebP images.';
        if (!file.size || file.size > imageSizeLimit) return 'Each image must be non-empty and no larger than 3 MB.';
    }
    return '';
}
function openImages() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('purrtal-task-issue-images', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('images', { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('Image storage is unavailable in this browser.'));
    });
}
async function imageTransaction(mode, operation) {
    const database = await openImages();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction('images', mode);
        const request = operation(transaction.objectStore('images'));
        transaction.oncomplete = () => { database.close(); resolve(request.result); };
        transaction.onerror = transaction.onabort = () => { database.close(); reject(new Error('Could not access local issue images.')); };
    });
}
export const loadIssueImage = id => imageTransaction('readonly', store => store.get(id));
export const deleteIssueImage = id => imageTransaction('readwrite', store => store.delete(id));
export async function storeIssueImages(files, taskId) {
    const message = validateIssueImages(files);
    if (message) throw new Error(message);
    const saved = [];
    try {
        for (const file of files) {
            const image = { id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size, taskId };
            await imageTransaction('readwrite', store => store.put({ ...image, blob: file }));
            saved.push(image);
        }
        return saved;
    } catch (error) {
        await Promise.allSettled(saved.map(image => deleteIssueImage(image.id)));
        throw error;
    }
}
