import { useMemo } from 'react';
import type { Device } from '#/types/schema';
import { getServerCatalogItem, type ServerFrontProfile } from '../../editor/server-catalog';

interface DeviceFaceplateProps {
    device: Device;
    isDragging?: boolean;
}

export function DeviceFaceplate({ device, isDragging }: DeviceFaceplateProps) {
    const uHeight = device.uHeight;
    const pxHeight = uHeight * 24 - 2; // Subtract gap

    const serverCatalogItem = getServerCatalogItem(device.equipmentType);

    // Render configuration based on type
    const faceplate = useMemo(() => {
        switch (device.type) {
            case 'network':
                return <NetworkFaceplate uHeight={uHeight} />;
            case 'server':
                return (
                    <ServerFaceplate
                        uHeight={uHeight}
                        profile={serverCatalogItem?.profile ?? 'generic'}
                        bayCount={serverCatalogItem?.bayCount ?? 3}
                    />
                );
            case 'pdu':
                return <PDUFaceplate uHeight={uHeight} />;
            case 'cable':
                return <CableFaceplate uHeight={uHeight} />;
            case 'airflow':
                return <AirflowFaceplate uHeight={uHeight} />;
            case 'panel':
                return device.ports.length > 0 ? (
                    <PatchPanelFaceplate
                        uHeight={uHeight}
                        ports={device.ports.length}
                    />
                ) : (
                    <PanelFaceplate />
                );
            default:
                return <GenericFaceplate uHeight={uHeight} />;
        }
    }, [
        device.type,
        uHeight,
        device.ports.length,
        serverCatalogItem?.profile,
        serverCatalogItem?.bayCount,
    ]);

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

function ServerFaceplate({
    uHeight,
    profile,
    bayCount,
}: {
    uHeight: number;
    profile: ServerFrontProfile;
    bayCount: number;
}) {
    const pxHeight = uHeight * 24 - 2;
    const innerHeight = Math.max(8, pxHeight - 8);

    if (profile === 'cricket') {
        const rowHeight = Math.max(4, (innerHeight - 2) / 2);

        return (
            <g>
                <rect
                    x="14"
                    y="4"
                    width="34"
                    height={innerHeight}
                    rx="1.5"
                    fill="#111827"
                    stroke="#475569"
                    strokeWidth="0.6"
                />
                <text
                    x="31"
                    y={Math.max(10, pxHeight / 2 + 2)}
                    textAnchor="middle"
                    fontSize="5"
                    fontWeight="700"
                    fill="#CBD5E1"
                >
                    CIARA
                </text>

                {[0, 1].map((row) => {
                    const y = 4 + row * (rowHeight + 2);
                    return (
                        <g key={`cricket-row-${row}`}>
                            <rect
                                x="54"
                                y={y}
                                width="248"
                                height={rowHeight}
                                rx="1"
                                fill="#273238"
                                stroke="#64748B"
                                strokeOpacity="0.45"
                                strokeWidth="0.5"
                            />
                            {Array.from({ length: 30 }).map((_, index) => (
                                <rect
                                    // biome-ignore lint/suspicious/noArrayIndexKey: decorative grille
                                    key={index}
                                    x={58 + index * 8}
                                    y={y + 1.5}
                                    width="4.5"
                                    height={Math.max(1.5, rowHeight - 3)}
                                    rx="0.5"
                                    fill="#0F172A"
                                    opacity="0.9"
                                />
                            ))}
                            <rect
                                x="126"
                                y={y + rowHeight / 2 - 1}
                                width="106"
                                height="2"
                                rx="1"
                                fill="#111827"
                            />
                            <rect
                                x="295"
                                y={y + 1}
                                width="4"
                                height={Math.max(2, rowHeight - 2)}
                                rx="0.5"
                                fill={row === 0 ? '#EF4444' : '#3B82F6'}
                                opacity="0.85"
                            />
                        </g>
                    );
                })}
            </g>
        );
    }

    const safeBayCount = Math.max(1, Math.min(bayCount, 12));
    const startX =
        profile === 'caribou' || profile === 'capybara' ? 60 : 82;
    const endX = 304;
    const gap = safeBayCount > 8 ? 1.5 : 2.5;
    const bayWidth = Math.max(
        7,
        (endX - startX - gap * (safeBayCount - 1)) / safeBayCount,
    );
    const bayHeight = Math.max(7, innerHeight - 2);

    return (
        <g>
            <rect
                x="14"
                y="4"
                width={profile === 'crow' ? 60 : 40}
                height={innerHeight}
                rx="2"
                fill="#151C20"
                stroke="#334155"
                strokeWidth="0.6"
            />

            {profile === 'crow' ? (
                <>
                    {Array.from({ length: 7 }).map((_, index) => (
                        <circle
                            // biome-ignore lint/suspicious/noArrayIndexKey: decorative vent
                            key={index}
                            cx={20 + (index % 4) * 9}
                            cy={8 + Math.floor(index / 4) * 7}
                            r="1.2"
                            fill="#475569"
                        />
                    ))}
                    <rect
                        x="56"
                        y={pxHeight / 2 - 3}
                        width="12"
                        height="6"
                        rx="1"
                        fill="#1D4ED8"
                        opacity="0.75"
                    />
                </>
            ) : (
                <>
                    <circle
                        cx="24"
                        cy={pxHeight / 2}
                        r="2"
                        fill="#10B981"
                    />
                    <rect
                        x="31"
                        y={pxHeight / 2 - 2}
                        width="12"
                        height="4"
                        rx="1"
                        fill="#334155"
                    />
                </>
            )}

            {profile === 'capybara' && (
                <rect
                    x="50"
                    y="5"
                    width="7"
                    height={Math.max(6, innerHeight - 2)}
                    rx="1"
                    fill="#64748B"
                    opacity="0.35"
                />
            )}

            {Array.from({ length: safeBayCount }).map((_, index) => {
                const x = startX + index * (bayWidth + gap);
                return (
                    <g key={`server-bay-${index}`}>
                        <rect
                            x={x}
                            y="5"
                            width={bayWidth}
                            height={bayHeight}
                            rx="1"
                            fill={
                                profile === 'bison'
                                    ? '#242F35'
                                    : profile === 'crow'
                                      ? '#1E293B'
                                      : '#202A2F'
                            }
                            stroke="#475569"
                            strokeWidth="0.45"
                        />
                        <rect
                            x={x + 1.5}
                            y="6.5"
                            width={Math.max(2, bayWidth - 3)}
                            height="1.5"
                            rx="0.5"
                            fill="#0F172A"
                        />
                        <circle
                            cx={x + 2.2}
                            cy={Math.max(10, pxHeight - 6.5)}
                            r="0.8"
                            fill="#10B981"
                        />
                    </g>
                );
            })}

            {profile === 'bison' && (
                <rect
                    x="54"
                    y={pxHeight / 2 - 2.5}
                    width="20"
                    height="5"
                    rx="1"
                    fill="#0F766E"
                    opacity="0.65"
                />
            )}
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

function AirflowFaceplate({ uHeight }: { uHeight: number }) {
    const pxHeight = uHeight * 24 - 2;

    return (
        <g>
            <rect
                x="18"
                y="5"
                width="284"
                height={Math.max(8, pxHeight - 10)}
                rx="3"
                fill="#172126"
                stroke="#42C9BC"
                strokeOpacity="0.35"
            />
            {Array.from({ length: 14 }).map((_, index) => (
                <line
                    // biome-ignore lint/suspicious/noArrayIndexKey: decorative grille
                    key={index}
                    x1={30 + index * 18}
                    y1="8"
                    x2={30 + index * 18}
                    y2={Math.max(10, pxHeight - 8)}
                    stroke="#64748B"
                    strokeOpacity="0.45"
                    strokeWidth="2"
                />
            ))}
        </g>
    );
}

function CableFaceplate({ uHeight }: { uHeight: number }) {
    const pxHeight = uHeight * 24 - 2;
    return (
        <g>
            {/* Cable management fingers/rings */}
            {Array.from({ length: 12 }).map((_, i) => (
                <rect
                    // biome-ignore lint/suspicious/noArrayIndexKey: decorative
                    key={`ring-${i}`}
                    x={35 + i * 22}
                    y={4}
                    width="3"
                    height={pxHeight - 8}
                    rx="1.5"
                    fill="#3F3F46"
                />
            ))}
            <rect
                x="30"
                y={pxHeight / 2 - 1}
                width="260"
                height="2"
                fill="#27272A"
                rx="1"
            />
        </g>
    );
}

function PatchPanelFaceplate({
    uHeight,
    ports,
}: {
    uHeight: number;
    ports: number;
}) {
    const pxHeight = uHeight * 24 - 2;
    // Layout ports in groups of 6, typical for patch panels
    const portsPerRow = 24;
    const groupsOf = 6;
    const rows = Math.ceil(ports / portsPerRow);

    return (
        <g>
            {Array.from({ length: rows }).map((_, rowIndex) => {
                const rowY =
                    rows === 1
                        ? pxHeight / 2 - 4
                        : (pxHeight / (rows + 1)) * (rowIndex + 1) - 4;

                return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: decorative
                    <g key={`row-${rowIndex}`}>
                        {Array.from({ length: portsPerRow }).map((_, i) => {
                            // Add small gaps between groups of 6
                            const groupOffset = Math.floor(i / groupsOf) * 4;
                            const x = 12 + i * 12 + groupOffset;
                            return (
                                <rect
                                    // biome-ignore lint/suspicious/noArrayIndexKey: decorative
                                    key={`port-${i}`}
                                    x={x}
                                    y={rowY}
                                    width="8"
                                    height="8"
                                    rx="1"
                                    fill="#000"
                                    stroke="#3F3F46"
                                    strokeWidth="0.5"
                                />
                            );
                        })}
                    </g>
                );
            })}
        </g>
    );
}

function PanelFaceplate() {
    return (
        <g>
            {/* Very subtle texture for blank panel */}
            <defs>
                <linearGradient id="panelGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#27272A" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#27272A" stopOpacity="0" />
                </linearGradient>
            </defs>
            <rect
                x="5"
                y="5"
                width="310"
                height="14"
                fill="url(#panelGrad)"
                rx="1"
            />
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
