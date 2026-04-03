import type { Rack, Device } from '#/types/schema';

interface RackNodeProps {
    rack: Rack;
    devices: Device[];
    onClick: (rackId: string) => void;
    gridSize: number;
}

export function RackNode({ rack, devices, onClick, gridSize }: RackNodeProps) {
    // Calculate occupancy percentage
    const usedU = devices.reduce((acc, dev) => acc + dev.uHeight, 0);
    const occupancyRatio = usedU / rack.uCapacity;

    // Choose color based on occupancy
    const getFillColor = () => {
        if (occupancyRatio > 0.9) return 'fill-red-500/80 hover:fill-red-400';
        if (occupancyRatio > 0.5)
            return 'fill-(--sea-teal) hover:fill-(--sea-aqua)';
        return 'fill-white/20 hover:fill-white/40';
    };

    return (
        <g
            transform={`translate(${rack.x * gridSize}, ${rack.y * gridSize})`}
            onClick={() => onClick(rack.id)}
            onKeyDown={(e) => e.key === 'Enter' && onClick(rack.id)}
            className="cursor-pointer transition-colors duration-200 group"
            role="button"
            tabIndex={0}
            aria-label={`Rack ${rack.name}`}
        >
            <rect
                width={gridSize * 0.9} // Slightly smaller than grid unit for spacing
                height={gridSize * 0.9}
                rx={4}
                className={`${getFillColor()} stroke border-white/10`}
            />
            <text
                x={gridSize * 0.45}
                y={gridSize * 1.3}
                textAnchor="middle"
                className="text-[8px] fill-white font-medium opacity-60 group-hover:opacity-100"
            >
                {rack.name}
            </text>
            <text
                x={gridSize * 0.45}
                y={gridSize * 0.55}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[10px] fill-(--sea-ink) font-bold pointer-events-none"
            >
                {usedU}U
            </text>
        </g>
    );
}
