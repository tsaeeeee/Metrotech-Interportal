import { GripVertical } from 'lucide-react';
import type { Device } from '#/types/schema';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '#/lib/utils';
import { DeviceFaceplate } from './device-faceplate';

interface RackDeviceProps {
    device: Device;
    rackCapacity: number;
    onEdit?: (device: Device) => void;
}

export function RackDevice({ device, rackCapacity, onEdit }: RackDeviceProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({
            id: device.id,
        });

    const U_HEIGHT_PX = 24;

    // Position calculation (U-01 is bottom, so U-Capacity is top)
    const top =
        (rackCapacity - device.uPosition - device.uHeight + 1) * U_HEIGHT_PX;
    const height = device.uHeight * U_HEIGHT_PX;

    const style = {
        top: `${top}px`,
        height: `${height}px`, // Pixel-perfect fit
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 50 : 10,
    };

    const typeColors: Record<string, string> = {
        server: 'text-emerald-500 font-extrabold',
        network: 'text-sky-500 font-extrabold',
        pdu: 'text-amber-500 font-extrabold',
        storage: 'text-indigo-500 font-extrabold',
    };

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={(e) => {
                e.stopPropagation();
                if (!isDragging) onEdit?.(device);
            }}
            type="button"
            aria-label={`Edit ${device.name}`}
            className={cn(
                'absolute left-0 right-0 group transition-all duration-100 active:cursor-grabbing cursor-grab flex items-center shadow-lg rounded-sm overflow-hidden border border-white/10 hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer',
            )}
        >
            {/* The High-Fidelity faceplate */}
            <DeviceFaceplate device={device} isDragging={isDragging} />

            {/* Label Overlay (shows on hover or if space exists) */}
            <div
                className={cn(
                    'absolute inset-0 pointer-events-none flex items-center justify-between px-10 transition-opacity',
                    isDragging ? 'opacity-0' : 'group-hover:opacity-100 opacity-90',
                )}
            >
                <span
                    className={cn(
                        'text-[10px] font-black uppercase tracking-tighter truncate max-w-35 drop-shadow-sm',
                        typeColors[device.type] || 'text-(--sea-ink)',
                    )}
                >
                    {device.name}
                </span>
                <span className="text-[9px] font-mono opacity-60 text-(--sea-ink-soft) truncate max-w-[60px] bg-white/40 px-1 rounded">
                    {device.assetTag}
                </span>
            </div>

            {/* Handle / Grip indicator */}
            {!isDragging && (
                <div className="absolute left-1 top-0 bottom-0 flex items-center group-hover:opacity-100 opacity-0 transition-opacity">
                    <GripVertical size={10} className="text-zinc-500/40" />
                </div>
            )}
        </button>
    );
}
