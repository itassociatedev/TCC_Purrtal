import React, { useEffect, useState } from 'react';

/**
 * Small box showing the current page. Type a page number and press Enter (or click away) to jump there.
 * Numbers outside 1..max snap to the first or last page.
 */
export default function PageNumberInput({ value, max, onChange, className = '' }) {
    const [text, setText] = useState(String(value));

    useEffect(() => { setText(String(value)); }, [value]);

    const commit = () => {
        const number = parseInt(text, 10);
        if (Number.isNaN(number)) {
            setText(String(value));
            return;
        }
        const page = Math.max(1, Math.min(max, number));
        setText(String(page));
        if (page !== value) onChange(page);
    };

    return (
        <input
            type="text"
            inputMode="numeric"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
            onFocus={(e) => e.target.select()}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); e.currentTarget.blur(); } }}
            aria-label="Page number"
            title="Type a page number and press Enter"
            className={`w-14 rounded border-gray-300 px-1 py-0.5 text-center text-xs font-bold ${className}`}
        />
    );
}
