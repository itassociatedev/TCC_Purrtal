export default function assetPhotoUrl(asset) {
    const value = asset?.image_path;
    if (!value) return null;

    // Older approvals stored Graph's browser webUrl on the asset. Request those
    // files through the authenticated app endpoint instead of using webUrl as <img>.
    if (/^https?:\/\/[^/]*(sharepoint\.com|onedrive\.live\.com|1drv\.ms)/i.test(value)) {
        return asset.id ? route('assets.photo.show', asset.id) : null;
    }

    if (value.startsWith('/') || /^https?:\/\//i.test(value)) return value;
    return `/storage/${value}`;
}
