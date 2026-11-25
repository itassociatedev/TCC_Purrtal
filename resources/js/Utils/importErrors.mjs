export function importErrorMessage(error) {
    const data = error?.response?.data;
    const messages = data?.errors ? [...new Set(Object.values(data.errors).flat().filter(Boolean))] : [];
    return messages.length ? messages.join('\n') : data?.message || error?.message || 'The import could not be completed.';
}
