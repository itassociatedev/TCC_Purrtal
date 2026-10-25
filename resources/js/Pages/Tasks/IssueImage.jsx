import { useEffect, useState } from 'react';
import { loadIssueImage } from './roundImages.mjs';

// Recreate temporary preview URLs from persisted blobs; release them when a thumbnail leaves the screen.
export default function IssueImage({ image, editable, onRemove }) {
    const [url, setUrl] = useState('');
    const [missing, setMissing] = useState(false);
    useEffect(() => {
        let active = true, objectUrl;
        loadIssueImage(image.id).then(record => {
            if (!active) return;
            if (!record?.blob) { setMissing(true); return; }
            objectUrl = URL.createObjectURL(record.blob); setUrl(objectUrl);
        }).catch(() => { if (active) setMissing(true); });
        return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [image.id]);
    return <figure className="tm-issue-image">{url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Issue attachment: ${image.name}`}/></a> : <p>{missing ? 'Image unavailable in this browser.' : 'Loading image…'}</p>}<figcaption>{image.name}</figcaption>{editable && <button type="button" className="tm-text-button" aria-label={`Remove ${image.name}`} onClick={() => onRemove(image.id)}>Remove image</button>}</figure>;
}
