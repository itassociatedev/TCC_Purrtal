import { useState } from 'react';

const getInitials = (name = '') => {
    const words = name
        .replace(/^(dr|ma|mr|ms|mrs)\.?\s+/i, '')
        .replace(/,.*$/, '')
        .split(/\s+/)
        .filter((word) => /^[a-zñ]/i.test(word));

    if (words.length === 0) return '?';
    if (words.length === 1) return words[0][0].toUpperCase();

    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

// Saved framing for a member photo: which point of the photo sits in the middle (percent)
// and how far it is zoomed in. Defaults keep the photo centred and unzoomed.
export const photoFrameStyle = (member) => {
    const x = Number(member?.image_position_x ?? 50);
    const y = Number(member?.image_position_y ?? 50);
    const zoom = Number(member?.image_zoom ?? 1);

    return {
        objectPosition: `${x}% ${y}%`,
        transform: zoom !== 1 ? `scale(${zoom})` : undefined,
        transformOrigin: `${x}% ${y}%`,
    };
};

// Round staff photo with a soft frame; falls back to initials when there is no photo
// or the photo file cannot be loaded
export default function MemberAvatar({ member, src = null, className = 'h-24 w-24', initialsClassName = 'text-2xl' }) {
    const [failed, setFailed] = useState(false);
    const photoSrc = src || (member?.image_path ? `/storage/${member.image_path}` : null);
    const showPhoto = photoSrc && !failed;

    return (
        <div className={`shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-slate-50 to-indigo-100/70 ring-1 ring-slate-200 shadow-[0_6px_16px_-8px_rgba(30,41,59,0.45)] ${className}`}>
            {showPhoto ? (
                <img
                    loading="lazy"
                    decoding="async"
                    src={photoSrc}
                    alt={member?.name || 'Member'}
                    onError={() => setFailed(true)}
                    className="h-full w-full object-cover pointer-events-none select-none"
                    draggable={false}
                    style={photoFrameStyle(member)}
                />
            ) : (
                <div className={`flex h-full w-full items-center justify-center font-semibold tracking-wide text-indigo-500 select-none ${initialsClassName}`}>
                    {getInitials(member?.name)}
                </div>
            )}
        </div>
    );
}
