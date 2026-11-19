// Module lifetime spans page remounts and browser Back/Forward within the SPA.
const displayedEvents = new Set();
export function claimFlashEvent(id) {
    if (!id) return true; // Compatibility with pages that do not yet provide event IDs.
    if (displayedEvents.has(id)) return false;
    displayedEvents.add(id);
    return true;
}
