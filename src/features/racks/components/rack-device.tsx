import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '#/lib/utils';
import type { Device } from '#/types/schema';
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
        opacity: isDragging ? 0.2 : 1,
        filter: isDragging ? 'grayscale(1)' : 'none',
        zIndex: isDragging ? 50 : 10,
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
                'absolute left-0 right-0 group transition-all duration-100 active:cursor-grabbing cursor-grab flex items-center shadow-lg rounded-sm overflow-hidden border border-white/10 hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer select-none',
            )}
        >
            {/* The High-Fidelity faceplate */}
            <DeviceFaceplate device={device} isDragging={isDragging} />

            {/* Centered asset label with translucent backing so the faceplate stays readable */}
            <div
                className={cn(
                    'absolute inset-0 pointer-events-none flex items-center justify-center px-9 transition-opacity',
                    isDragging ? 'opacity-0' : 'opacity-100',
                )}
            >
                <span className="max-w-[72%] truncate rounded-md bg-black/50 px-2.5 py-1 text-center text-[10px] font-black uppercase tracking-tight text-white shadow-sm backdrop-blur-[1px]">
                    {device.name}
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
