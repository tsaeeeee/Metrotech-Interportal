import type { Floor, Rack, Device } from '#/types/schema';
import { RackNode } from './rack-node';

interface FloorGridProps {
    floor: Floor;
    racks: Rack[];
    allDevices: Device[];
    onRackSelect: (rackId: string) => void;
}

export function FloorGrid({
    floor,
    racks,
    allDevices,
    onRackSelect,
}: FloorGridProps) {
    const zoom = 40; // Grid unit size in pixels

    // Generate grid lines for the background
    const gridLines = [];
    for (let x = 0; x <= floor.width; x++) {
        gridLines.push(
            <line
                key={`v-${x}`}
                x1={x * zoom}
                y1={0}
                x2={x * zoom}
                y2={floor.height * zoom}
                className="stroke-white/5"
                strokeWidth={1}
            />,
        );
    }
    for (let y = 0; y <= floor.height; y++) {
        gridLines.push(
            <line
                key={`h-${y}`}
                x1={0}
                y1={y * zoom}
                x2={floor.width * zoom}
                y2={y * zoom}
                className="stroke-white/5"
                strokeWidth={1}
            />,
        );
    }

    return (
        <div className="relative w-full h-full min-h-125 flex items-center justify-center bg-black/20 rounded-xl overflow-hidden border border-white/5 p-8">
            {/* Legend / Info Overlay */}
            <div className="absolute top-6 left-6 p-4 bg-(--sea-ink)/80 backdrop-blur-md rounded-lg border border-white/10 text-xs space-y-2 pointer-events-none z-10 font-mono">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500/80 rounded" />
                    <span className="text-white/60">Over 90% Occupied</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-(--sea-teal) rounded" />
                    <span className="text-white/60">Active Capacity</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-white/10 border border-white/20 rounded" />
                    <span className="text-white/60">Low Usage</span>
                </div>
            </div>

            {/* SVG Grid */}
            <div className="relative overflow-auto max-w-full max-h-full">
                <svg
                    width={floor.width * zoom}
                    height={floor.height * zoom}
                    viewBox={`0 0 ${floor.width * zoom} ${floor.height * zoom}`}
                    className="overflow-visible"
                    aria-label="Data Center Floor Grid"
                >
                    <title>Data Center Floor Layout</title>
                    {/* Background Grid */}
                    {gridLines}

                    {/* Racks */}
                    {racks.map((rack) => {
                        const rackDevices = allDevices.filter((d) =>
                            rack.devices.includes(d.id),
                        );
                        return (
                            <RackNode
                                key={rack.id}
                                rack={rack}
                                devices={rackDevices}
                                onClick={onRackSelect}
                                gridSize={zoom}
                            />
                        );
                    })}
                </svg>
            </div>

            {/* Scale Indicator */}
            <div className="absolute bottom-6 right-6 text-[10px] font-mono text-white/40 uppercase tracking-widest">
                Unit Scale: 1 Block = 1.0m
            </div>
        </div>
    );
}
