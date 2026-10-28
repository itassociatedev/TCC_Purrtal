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

// Round staff photo with a soft frame; falls back to initials when there is no photo
// or the photo file cannot be loaded
export default function MemberAvatar({ member, className = 'h-24 w-24', initialsClassName = 'text-2xl' }) {
    const [failed, setFailed] = useState(false);
    const showPhoto = member?.image_path && !failed;

    return (
        <div className={`shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-slate-50 to-indigo-100/70 ring-1 ring-slate-200 shadow-[0_6px_16px_-8px_rgba(30,41,59,0.45)] ${className}`}>
            {showPhoto ? (
                <img
                    loading="lazy"
                    decoding="async"
                    src={`/storage/${member.image_path}`}
                    alt={member?.name || 'Member'}
                    onError={() => setFailed(true)}
                    className="h-full w-full object-cover object-top pointer-events-none"
                />
            ) : (
                <div className={`flex h-full w-full items-center justify-center font-semibold tracking-wide text-indigo-500 select-none ${initialsClassName}`}>
                    {getInitials(member?.name)}
                </div>
            )}
        </div>
    );
}
