import { useEffect } from 'react';
import './mobile-record-tiles.css';

// Preserve the existing record actions and inputs while presenting each row as a tile.
export default function MobileRecordTiles() {
    useEffect(() => {
        document.querySelectorAll('table.mobile-record-tiles').forEach(table => {
            const headings = Array.from(table.tHead?.rows[0]?.cells || []).map(cell => cell.textContent.trim());
            Array.from(table.tBodies).forEach(body => Array.from(body.rows).forEach(row => {
                Array.from(row.cells).forEach((cell, index) => {
                    cell.dataset.label = cell.colSpan > 1 ? '' : headings[index] || '';
                });
            }));
        });
    });
    return null;
}
