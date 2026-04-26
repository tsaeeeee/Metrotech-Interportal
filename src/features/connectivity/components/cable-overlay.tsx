import { useMemo } from 'react';
import type { Connection, Device } from '#/types/schema';

interface CableOverlayProps {
    devices: Device[];
    connections: Connection[];
    uHeight: number; // Height of a single U in pixels (e.g., 40)
    rackPadding?: number;
}

export function CableOverlay({
    devices,
    connections,
    uHeight,
}: CableOverlayProps) {
    // 1. Map all ports to their global (rack-relative) coordinates
    const portCoords = useMemo(() => {
        const coords: Record<string, { x: number; y: number }> = {};

        for (const device of devices) {
            // Device Y is calculated from the bottom up in racks usually,
            // but in our SVG U-grid it might be top-down.
            // In RackUGrid, we render U 1 at the bottom.
            const deviceTopY =
                (42 - (device.uPosition + device.uHeight - 1)) * uHeight;

            // For now, assume ports are centered horizontally on the device
            // and spread out slightly. Real implementations would use a
            // more sophisticated faceplate mapping.
            device.ports.forEach((port, idx) => {
                const portX = 40 + idx * 16; // offset from left
                const portY = deviceTopY + uHeight / 2;
                coords[port.id] = { x: portX, y: portY };
            });
        }
        return coords;
    }, [devices, uHeight]);

    return (
        <svg
            className="absolute inset-0 pointer-events-none z-10 overflow-visible"
            width="100%"
            height="100%"
            aria-label="Cable Connectivity Overlay"
        >
            <title>Active cable connections between networking assets</title>
            <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite
                        in="SourceGraphic"
                        in2="blur"
                        operator="over"
                    />
                </filter>
            </defs>
            {connections.map((conn) => {
                const start = portCoords[conn.portAId];
                const end = portCoords[conn.portBId];

                if (!start || !end) return null;

                // Create a smooth Bezier curve
                // Control points are pulled outwards to create "cable sag" or "neat routing"
                const cp1x = start.x - 40; // pull left
                const cp1y = start.y;
                const cp2x = end.x - 40; // pull left
                const cp2y = end.y;

                const pathData = `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;

                return (
                    <g
                        key={conn.id}
                        className="transition-opacity duration-300"
                    >
                        <path
                            d={pathData}
                            fill="none"
                            stroke={conn.color || '#3b82f6'}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            className="opacity-60 hover:opacity-100 transition-opacity"
                            filter="url(#glow)"
                        />
                        {/* Hidden thick path for easier hovering if we add events later */}
                        <path
                            d={pathData}
                            fill="none"
                            stroke="transparent"
                            strokeWidth="10"
                            className="pointer-events-auto cursor-pointer"
                        />
                    </g>
                );
            })}
        </svg>
    );
}
