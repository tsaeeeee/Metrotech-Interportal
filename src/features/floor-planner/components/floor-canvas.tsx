import { useMemo } from 'react';
import { cn } from '#/lib/utils';
import type {
    PlannerCell, PlannerFloor, PlannerLayer, PlannerRack,
} from '../types';

export type FloorTool =
    | 'select'
    | 'new-rack'
    | 'place-rack'
    | 'erase'
    | PlannerLayer;

export interface FloorCanvasProps {
    floor: PlannerFloor;
    racks: PlannerRack[];
    show: {
        grid: boolean;
        racks: boolean;
        runners: boolean;
        perforated: boolean;
        walls: boolean;
        blocked: boolean;
        entries: boolean;
    };
    selectedRackId: string;
    sourceId: string;
    destinationId: string;
    route: PlannerCell[];
    editMode: boolean;
    tool: FloorTool;
    zoom: number;
    onCell: (cell: PlannerCell) => void;
    onRack: (id: string) => void;
}

const TILE = 22;
const PAD = 24;

export function FloorCanvas({
    floor, racks, show, selectedRackId, sourceId, destinationId,
    route, editMode, tool, zoom, onCell, onRack,
}: FloorCanvasProps) {
    const width = floor.gridWidth * TILE;
    const height = floor.gridHeight * TILE;
    const totalWidth = width + PAD * 2;
    const totalHeight = height + PAD * 2;
    const presentRacks = racks.filter((rack) =>
        rack.x !== null && rack.y !== null,
    );
    const positions = useMemo(
        () => new Set(presentRacks.map((rack) => String(rack.x) + ',' + String(rack.y))),
        [racks],
    );
    const points = (cells: PlannerCell[]) => cells.map((cell) =>
        String((cell.x + 0.5) * TILE) + ',' + String((cell.y + 0.5) * TILE),
    ).join(' ');
    const runnerPoints = useMemo(
        () => new Set(floor.layout.runners.map((cell) => String(cell.x) + ',' + String(cell.y))),
        [floor.layout.runners],
    );

    return (
        <div className="relative overflow-auto rounded-xl border border-(--line) bg-[#f8fbff] shadow-inner dark:bg-[#17212b]">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox={'0 0 ' + totalWidth + ' ' + totalHeight}
                width={totalWidth * zoom}
                height={totalHeight * zoom}
                role="img"
                aria-label={'Floor plan for ' + floor.name}
                className="block max-w-none select-none"
                style={{ touchAction: editMode ? 'none' : 'auto' }}
            >
                <defs>
                    <pattern id="floor-dot-tile" width="5" height="5" patternUnits="userSpaceOnUse">
                        <circle cx="1.5" cy="1.5" r="0.7" fill="#60a5fa" fillOpacity="0.75" />
                    </pattern>
                    <pattern id="floor-blocked-tile" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <path d="M0 0 V6" stroke="#64748b" strokeWidth="1.4" strokeOpacity="0.75" />
                    </pattern>
                    <pattern
                        id="floor-grid-tile"
                        width={TILE}
                        height={TILE}
                        patternUnits="userSpaceOnUse"
                    >
                        <rect width={TILE} height={TILE} fill="none" stroke="#b8c7db" strokeWidth=".48" strokeOpacity=".8" />
                    </pattern>
                </defs>
                <g transform={'translate(' + PAD + ',' + PAD + ')'}>
                    <rect width={width} height={height} fill="#f3f7fd" className="dark:fill-[#1e2a36]" />
                    {show.grid && <rect width={width} height={height} fill="url(#floor-grid-tile)" />}

                    {Array.from({ length: Math.ceil(floor.gridWidth / 2) + 1 }, (_, index) => (
                        <text
                            key={'column-' + index}
                            x={index * 2 * TILE}
                            y="-8"
                            textAnchor="middle"
                            fill="#7589a4"
                            fontSize="7"
                            fontWeight="700"
                        >
                            {index * 2}
                        </text>
                    ))}
                    {Array.from({ length: Math.ceil(floor.gridHeight / 2) + 1 }, (_, index) => (
                        <text
                            key={'row-' + index}
                            x="-10"
                            y={index * 2 * TILE + 3}
                            textAnchor="middle"
                            fill="#7589a4"
                            fontSize="7"
                            fontWeight="700"
                        >
                            {index * 2}
                        </text>
                    ))}

                    {show.perforated && floor.layout.perforated.map((cell) => (
                        <rect
                            key={'perforated-' + cell.x + '-' + cell.y}
                            x={cell.x * TILE}
                            y={cell.y * TILE}
                            width={TILE}
                            height={TILE}
                            fill="url(#floor-dot-tile)"
                            stroke="#93c5fd"
                            strokeOpacity=".55"
                            strokeWidth=".4"
                        />
                    ))}

                    {show.blocked && floor.layout.blocked.map((cell) => (
                        <rect
                            key={'blocked-' + cell.x + '-' + cell.y}
                            x={cell.x * TILE}
                            y={cell.y * TILE}
                            width={TILE}
                            height={TILE}
                            fill="url(#floor-blocked-tile)"
                            stroke="#64748b"
                            strokeOpacity=".45"
                            strokeWidth=".4"
                        />
                    ))}

                    {show.walls && floor.layout.walls.map((cell) => (
                        <rect
                            key={'wall-' + cell.x + '-' + cell.y}
                            x={cell.x * TILE + 1}
                            y={cell.y * TILE + 1}
                            width={TILE - 2}
                            height={TILE - 2}
                            rx="1"
                            fill="#1e293b"
                        />
                    ))}

                    {show.runners && floor.layout.runners.map((cell) => (
                        <g key={'runner-' + cell.x + '-' + cell.y}>
                            {[
                                { x: cell.x + 1, y: cell.y },
                                { x: cell.x, y: cell.y + 1 },
                            ].filter((next) =>
                                runnerPoints.has(String(next.x) + ',' + String(next.y)),
                            ).map((next) => (
                                <line
                                    key={'edge-' + next.x + '-' + next.y}
                                    x1={(cell.x + .5) * TILE}
                                    y1={(cell.y + .5) * TILE}
                                    x2={(next.x + .5) * TILE}
                                    y2={(next.y + .5) * TILE}
                                    stroke="#eebc58"
                                    strokeWidth="5"
                                    strokeLinecap="round"
                                    strokeOpacity=".78"
                                />
                            ))}
                            <rect
                                x={(cell.x + .5) * TILE - 2.2}
                                y={(cell.y + .5) * TILE - 2.2}
                                width="4.4"
                                height="4.4"
                                rx=".75"
                                fill="#fbbf24"
                            />
                        </g>
                    ))}

                    {show.entries && floor.layout.entries.map((cell) => (
                        <g key={'entry-' + cell.x + '-' + cell.y}>
                            <path
                                d={'M ' + ((cell.x + .5) * TILE) + ' ' + (cell.y * TILE + 3) +
                                   ' l 6 12 h -12 z'}
                                fill="#16a34a"
                                stroke="#fff"
                                strokeWidth="1"
                            />
                        </g>
                    ))}

                    {route.length > 1 && (
                        <g pointerEvents="none">
                            <polyline
                                points={points(route)}
                                fill="none"
                                stroke="white"
                                strokeOpacity=".95"
                                strokeWidth="7"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                            <polyline
                                points={points(route)}
                                fill="none"
                                stroke="#1558d6"
                                strokeWidth="4"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                            {route.slice(1, -1).map((cell, index) => (
                                <circle
                                    key={'route-node-' + index}
                                    cx={(cell.x + .5) * TILE}
                                    cy={(cell.y + .5) * TILE}
                                    r="1.8"
                                    fill="#dbeafe"
                                />
                            ))}
                        </g>
                    )}

                    {editMode && tool !== 'select' &&
                        Array.from({ length: floor.gridHeight * floor.gridWidth }, (_, index) => {
                            const x = index % floor.gridWidth;
                            const y = Math.floor(index / floor.gridWidth);
                            return (
                                <rect
                                    key={'editable-' + index}
                                    x={x * TILE}
                                    y={y * TILE}
                                    width={TILE}
                                    height={TILE}
                                    fill="transparent"
                                    className="cursor-crosshair hover:fill-emerald-400/25"
                                    onPointerDown={(event) => {
                                        event.preventDefault();
                                        if (event.button === 0 || event.pointerType === 'touch') onCell({ x, y });
                                    }}
                                    onPointerEnter={(event) => {
                                        if ((event.buttons & 1) && !['new-rack', 'place-rack'].includes(tool)) {
                                            onCell({ x, y });
                                        }
                                    }}
                                />
                            );
                        })
                    }

                    {show.racks && presentRacks.map((rack) => {
                        const x = rack.x! * TILE;
                        const y = rack.y! * TILE;
                        const source = rack.id === sourceId;
                        const destination = rack.id === destinationId;
                        const selected = rack.id === selectedRackId;
                        const occupied = rack.deviceCount > 0;
                        const stroke = source ? '#047857' : destination ? '#2563eb' : selected ? '#0891b2' : occupied ? '#059669' : '#94a3b8';
                        const fill = occupied ? '#dcfce7' : '#475569';
                        return (
                            <g
                                key={rack.id}
                                role="button"
                                tabIndex={0}
                                aria-label={'Rack ' + rack.name}
                                onClick={() => onRack(rack.id)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        onRack(rack.id);
                                    }
                                }}
                                className="cursor-pointer"
                            >
                                {(source || destination || selected) && (
                                    <rect
                                        x={x - 2}
                                        y={y - 2}
                                        width={TILE + 4}
                                        height={TILE + 4}
                                        rx="3"
                                        stroke={stroke}
                                        strokeWidth="2.1"
                                        fill="none"
                                    />
                                )}
                                <rect
                                    x={x + 1}
                                    y={y + 3}
                                    width={TILE - 2}
                                    height={TILE - 6}
                                    rx="2"
                                    fill={fill}
                                    stroke={stroke}
                                    strokeWidth=".9"
                                />
                                <text
                                    x={x + TILE / 2}
                                    y={y + TILE / 2 + 2.3}
                                    textAnchor="middle"
                                    fontSize="6.8"
                                    fontWeight="800"
                                    fill={occupied ? '#065f46' : '#fff'}
                                    pointerEvents="none"
                                >
                                    {rack.name.slice(0, 6)}
                                </text>
                            </g>
                        );
                    })}
                    <rect width={width} height={height} fill="none" stroke="#b6c4d6" strokeWidth="1" pointerEvents="none" />
                </g>
            </svg>
            {editMode && (
                <div className="absolute bottom-3 left-3 rounded-md bg-(--surface) px-3 py-1.5 text-xs font-medium text-(--sea-ink) shadow-sm border border-(--line)">
                    {tool === 'select' ? 'Choose a rack' : 'Editing: ' + tool.replaceAll('-', ' ')}
                    {positions.size > 0 ? ' · ' + positions.size + ' positioned racks' : ''}
                </div>
            )}
        </div>
    );
}
