import { useMemo } from 'react';
import type { Device } from '#/types/schema';

interface DeviceFaceplateProps {
    device: Device;
    isDragging?: boolean;
}

export function DeviceFaceplate({ device, isDragging }: DeviceFaceplateProps) {
    const uHeight = device.uHeight;
    const pxHeight = uHeight * 24 - 2; // Subtract gap

    // Render configuration based on type
    const faceplate = useMemo(() => {
        switch (device.type) {
            case 'network':
                return <NetworkFaceplate uHeight={uHeight} />;
            case 'server':
                return <ServerFaceplate uHeight={uHeight} />;
            case 'pdu':
                return <PDUFaceplate uHeight={uHeight} />;
            default:
                return <GenericFaceplate uHeight={uHeight} />;
        }
    }, [device.type, uHeight]);

    return (
        <svg
            width="100%"
            height="100%"
            viewBox={`0 0 320 ${pxHeight}`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`transition-opacity duration-200 ${isDragging ? 'opacity-40' : 'opacity-100'}`}
        >
            <title>{`${device.type} faceplate for ${device.name}`}</title>
            {/* Base Chassis */}
            <rect
                width="320"
                height={pxHeight}
                rx="2"
                fill="currentColor"
                className="text-zinc-900 dark:text-zinc-950"
            />
            <rect
                x="0.5"
                y="0.5"
                width="319"
                height={pxHeight - 1}
                rx="1.5"
                stroke="#27272A"
                strokeOpacity="0.5"
            />

            {/* Screws / Mounting Ears */}
            <circle cx="5" cy="6" r="1.5" fill="#3F3F46" />
            <circle cx="5" cy={pxHeight - 6} r="1.5" fill="#3F3F46" />
            <circle cx="315" cy="6" r="1.5" fill="#3F3F46" />
            <circle cx="315" cy={pxHeight - 6} r="1.5" fill="#3F3F46" />

            {/* Type-Specific Content */}
            {faceplate}
        </svg>
    );
}

function NetworkFaceplate({ uHeight }: { uHeight: number }) {
    const pxHeight = uHeight * 24 - 2;
    return (
        <g>
            {/* Beveled edge for standard switch look */}
            <rect
                x="12"
                y="4"
                width="296"
                height={pxHeight - 8}
                rx="1"
                fill="currentColor"
                className="text-zinc-900 dark:text-black"
            />

            {/* Port Clusters (Groups of 8) */}
            {[24, 84, 144, 204].map((x) => (
                <g key={`cluster-${x}`} transform={`translate(${x}, 8)`}>
                    {/* Render a block of ports */}
                    {Array.from({ length: 12 }).map((_, j) => (
                        <rect
                            // biome-ignore lint/suspicious/noArrayIndexKey: decorative
                            key={`port-${x}-${(j % 6) * 8}-${Math.floor(j / 6) * 6}`}
                            x={(j % 6) * 8}
                            y={Math.floor(j / 6) * 6}
                            width="6"
                            height="4"
                            rx="0.5"
                            fill="#1F2937"
                        />
                    ))}
                    {/* Activity LEDs */}
                    <circle cx="2" cy="-2" r="0.8" fill="#10B981" />
                    <circle
                        cx="5"
                        cy="-2"
                        r="0.8"
                        fill="#F59E0B"
                        opacity="0.3"
                    />
                </g>
            ))}

            {/* Console Port */}
            <rect
                x="270"
                y={pxHeight / 2 - 4}
                width="10"
                height="8"
                rx="1"
                fill="#3B82F6"
                opacity="0.8"
            />
        </g>
    );
}

function ServerFaceplate({ uHeight }: { uHeight: number }) {
    const pxHeight = uHeight * 24 - 2;
    return (
        <g>
            {/* Airflow Grilles */}
            <pattern
                id="grillePattern"
                x="0"
                y="0"
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
            >
                <circle cx="2" cy="2" r="1" fill="#27272A" />
            </pattern>
            <rect
                x="20"
                y="6"
                width="200"
                height={pxHeight - 12}
                rx="2"
                fill="url(#grillePattern)"
            />

            {/* Drive Bays */}
            {[230, 255, 280].map((x) => (
                <g key={`drive-${x}`} transform={`translate(${x}, 6)`}>
                    <rect
                        width="20"
                        height={pxHeight - 12}
                        rx="1"
                        fill="currentColor"
                        className="text-zinc-700 dark:text-zinc-800"
                    />
                    <rect
                        x="2"
                        y="2"
                        width="16"
                        height="2"
                        rx="0.5"
                        fill="#3F3F46"
                    />
                    <circle
                        cx="4"
                        cy={pxHeight - 16}
                        r="1"
                        fill="#10B981"
                        className="animate-pulse"
                    />
                </g>
            ))}
        </g>
    );
}

function PDUFaceplate({ uHeight }: { uHeight: number }) {
    const pxHeight = uHeight * 24 - 2;
    return (
        <g>
            <rect
                x="15"
                y="4"
                width="290"
                height={pxHeight - 8}
                rx="4"
                fill="#000"
            />
            {/* Outlets */}
            {Array.from({ length: 12 }).map((_, i) => (
                <rect
                    // biome-ignore lint/suspicious/noArrayIndexKey: decorative
                    key={`outlet-${25 + i * 22}`}
                    x={25 + i * 22}
                    y={pxHeight / 2 - 4}
                    width="14"
                    height="8"
                    rx="1.5"
                    fill={i < 4 ? '#EF4444' : i < 8 ? '#3B82F6' : '#10B981'}
                    opacity="0.6"
                />
            ))}
        </g>
    );
}

function GenericFaceplate({ uHeight }: { uHeight: number }) {
    const pxHeight = uHeight * 24 - 2;
    return (
        <rect
            x="40"
            y={pxHeight / 2 - 1}
            width="240"
            height="2"
            rx="1"
            fill="currentColor"
            className="text-zinc-400 dark:text-zinc-700"
        />
    );
}
