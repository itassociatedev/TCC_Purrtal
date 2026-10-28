import MemberAvatar from '@/Components/MemberAvatar';
import { useRef } from 'react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const SIZE = 224;

// Drag the photo to reposition it inside the circle and use the slider to zoom.
// Values are percentages (position) and a multiplier (zoom), saved per member.
export default function MemberPhotoAdjuster({ name, src, x, y, zoom, onChange }) {
    const dragRef = useRef(null);

    const startDrag = (e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = { startX: e.clientX, startY: e.clientY, x, y };
    };

    const drag = (e) => {
        if (!dragRef.current) return;
        // Pixels needed to move the photo by 1% grows with the zoom level
        const pixelsPerPercent = (SIZE * Math.max(zoom - 1, 0.5)) / 100;
        const start = dragRef.current;
        onChange({
            x: clamp(start.x - (e.clientX - start.startX) / pixelsPerPercent, 0, 100),
            y: clamp(start.y - (e.clientY - start.startY) / pixelsPerPercent, 0, 100),
            zoom,
        });
    };

    const endDrag = () => {
        dragRef.current = null;
    };

    return (
        <div className="flex flex-col items-center">
            <div
                className="cursor-grab touch-none active:cursor-grabbing"
                onPointerDown={startDrag}
                onPointerMove={drag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                <MemberAvatar
                    key={src}
                    member={{ name, image_position_x: x, image_position_y: y, image_zoom: zoom }}
                    src={src}
                    className="h-56 w-56"
                    initialsClassName="text-5xl"
                />
            </div>

            <div className="mt-4 flex w-full max-w-xs items-center gap-3">
                <span className="text-xs font-semibold text-gray-500">Zoom</span>
                <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => onChange({ x, y, zoom: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                />
                <button
                    type="button"
                    onClick={() => onChange({ x: 50, y: 50, zoom: 1 })}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                    Reset
                </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">Drag the photo to move it. Zoom in to fit the face in the circle.</p>
        </div>
    );
}
