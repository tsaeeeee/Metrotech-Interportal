import type { Device, Connection } from '#/types/schema';
import { RackDevice } from './rack-device.tsx';
import { CableOverlay } from '#/features/connectivity/components/cable-overlay';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '#/lib/utils';

interface RackUGridProps {
    uCapacity: number;
    devices: Device[];
    connections: Connection[];
    onMoveDevice?: (deviceId: string, newUPosition: number) => void;
    onEditDevice?: (device: Device) => void;
    projectedPlacement?: {
        uPosition: number;
        uHeight: number;
        isOccupied: boolean;
    } | null;
}

export function RackUGrid({
    uCapacity,
    devices,
    connections,
    projectedPlacement,
    onEditDevice,
}: RackUGridProps) {
    const { setNodeRef } = useDroppable({
        id: 'rack-grid',
    });

    // Generate array of U positions from top to bottom (uCapacity down to 1)
    const uSlots = Array.from({ length: uCapacity }, (_, i) => uCapacity - i);

    return (
        <div ref={setNodeRef} className="relative flex flex-col items-center">
            {/* The Rack Frame */}
            <div
                className="relative bg-(--bg-base) border-12 border-(--lagoon-deep)/20 rounded-lg shadow-2xl overflow-hidden"
                style={{
                    width: '340px',
                    height: `${uCapacity * 24}px`,
                }}
            >
                {/* Visual "Rail" Accents */}
                <div className="absolute inset-y-0 left-2 w-1 bg-zinc-300 dark:bg-white/10" />
                <div className="absolute inset-y-0 right-2 w-1 bg-zinc-300 dark:bg-white/10" />

                {/* Collision / Projected Highlight */}
                {projectedPlacement && (
                    <div
                        className={cn(
                            'absolute left-1 right-1 z-0 transition-all duration-75 rounded-sm',
                            projectedPlacement.isOccupied
                                ? 'bg-red-500/20 border border-red-500/40'
                                : 'bg-emerald-500/20 border border-emerald-500/40',
                        )}
                        style={{
                            top: `${(uCapacity - projectedPlacement.uPosition - projectedPlacement.uHeight + 1) * 24}px`,
                            height: `${projectedPlacement.uHeight * 24}px`,
                        }}
                    >
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span
                                className={cn(
                                    'text-[10px] font-black uppercase tracking-widest',
                                    projectedPlacement.isOccupied
                                        ? 'text-red-400'
                                        : 'text-emerald-400',
                                )}
                            >
                                {projectedPlacement.isOccupied
                                    ? 'Conflict'
                                    : 'Drop Here'}
                            </span>
                        </div>
                    </div>
                )}

                {/* U-Slot Grid Lines */}
                <div className="absolute inset-0 pointer-events-none flex flex-col">
                    {uSlots.map((u) => (
                        <div
                            key={`slot-${u}`}
                            style={{ height: '24px', flexShrink: 0 }}
                            className="relative shadow-[0_1px_0_rgba(0,0,0,0.1)] dark:shadow-[0_1px_0_rgba(39,39,42,0.5)]"
                        >
                            <span className="absolute -left-10 top-1 text-[10px] font-mono text-zinc-500 select-none">
                                {u}U
                            </span>
                        </div>
                    ))}
                </div>

                {/* Device Overlay Layer */}
                <div className="absolute inset-0 z-10 pointer-events-none">
                    <div className="relative w-full h-full pointer-events-auto px-1">
                        {devices.map((device) => (
                            <RackDevice
                                key={device.id}
                                device={device}
                                rackCapacity={uCapacity}
                                onEdit={onEditDevice}
                            />
                        ))}
                        <CableOverlay
                            devices={devices}
                            connections={connections}
                            uHeight={24} // Match the U slot height
                        />
                    </div>
                </div>
            </div>

            {/* Rack Footers */}
            <div className="flex justify-between w-85 px-8">
                <div className="w-8 h-4 bg-zinc-800 rounded-b-md shadow-inner" />
                <div className="w-8 h-4 bg-zinc-800 rounded-b-md shadow-inner" />
            </div>
        </div>
    );
}
