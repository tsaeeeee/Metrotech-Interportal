import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Activity, Info, Box, Map as MapIcon, Plus } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import type {
    DataCenter,
    Device,
    Floor,
    Rack,
    Connection,
} from '#/types/schema';
import { BreadcrumbNav } from '../components/breadcrumb-nav';
import {
    getFullRackContext,
    getFullFloorContext,
    upsertDevice,
    getInventory,
    deleteInventoryAsset,
    duplicateInventoryAsset,
} from '../features/database/database-service';
import { RackUGrid } from '../features/racks/components/rack-u-grid';
import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    type DragMoveEvent,
} from '@dnd-kit/core';
import { createSnapToUModifier } from '../features/racks/utils/modifiers';
import { useMemo } from 'react';
import { isRangeOccupied } from '../features/racks/utils/collision';
import { FloorGrid } from '../features/floor/components/floor-grid';
import { Drawer } from '../components/drawer';
import { AssetForm } from '../features/editor/components/asset-form';
import { AssetTray } from '../features/editor/components/asset-palette';

export const Route = createFileRoute('/')({ component: App });

type ViewMode = 'floor' | 'rack';

function App() {
    // 1. DND Global State
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
    );
    const snapToGridModifier = useMemo(() => createSnapToUModifier(24), []);

    const fetchRack = useServerFn(getFullRackContext);
    const fetchFloor = useServerFn(getFullFloorContext);
    const upsertDeviceFn = useServerFn(upsertDevice);
    const fetchInventoryFn = useServerFn(getInventory);
    const duplicateMasterFn = useServerFn(duplicateInventoryAsset);
    const deleteMasterFn = useServerFn(deleteInventoryAsset);

    const [viewMode, setViewMode] = useState<ViewMode>('rack');
    const [rackData, setRackData] = useState<{
        rack: Rack;
        floor: Floor;
        datacenter: DataCenter;
        devices: Device[];
        connections: Connection[];
    } | null>(null);

    const [floorData, setFloorData] = useState<{
        floor: Floor;
        racks: Rack[];
        datacenter: DataCenter;
        allDevices: Device[];
        connections: Connection[];
    } | null>(null);

    const [inventory, setInventory] = useState<Device[]>([]);
    const [loading, setLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const initialLoadRef = useRef(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerMode, setDrawerMode] = useState<'inventory' | 'rack'>('rack');
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [selectedDevice, setSelectedDevice] = useState<Device | undefined>(
        undefined,
    );
    const [projectedPlacement, setProjectedPlacement] = useState<{
        uPosition: number;
        uHeight: number;
        isOccupied: boolean;
    } | null>(null);

    const loadRack = useCallback(
        async (id: string, silent = false) => {
            // Only show full-page loading state if we have ZERO data
            if (!silent && !rackData) {
                setLoading(true);
            }
            setIsRefreshing(true);
            try {
                const result = await fetchRack({ data: id } as never);
                setRackData(result);
                setViewMode('rack');
            } finally {
                if (!silent) setLoading(false);
                setIsRefreshing(false);
            }
        },
        [fetchRack, rackData],
    );

    const loadFloor = useCallback(
        async (id: string, silent = false) => {
            if (!silent && !floorData) {
                setLoading(true);
            }
            setIsRefreshing(true);
            try {
                const result = await fetchFloor({ data: id } as never);
                setFloorData(result);
                setViewMode('floor');
            } finally {
                if (!silent) setLoading(false);
                setIsRefreshing(false);
            }
        },
        [fetchFloor, floorData],
    );

    const loadInventory = useCallback(async () => {
        try {
            const result = await fetchInventoryFn();
            setInventory(result);
        } catch (error) {
            console.error('Failed to load inventory:', error);
        }
    }, [fetchInventoryFn]);

    useEffect(() => {
        if (initialLoadRef.current) return;
        initialLoadRef.current = true;

        if (!rackData && !floorData) {
            setLoading(true);
        }

        loadRack('rk-01');
        loadInventory();
    }, [loadRack, loadInventory, rackData, floorData, initialLoadRef]);

    const handleAddAsset = () => {
        setSelectedDevice(undefined);
        setDrawerMode('inventory');
        setDrawerOpen(true);
    };

    const handleEditAsset = (device: Device) => {
        setSelectedDevice(device);
        setDrawerMode('rack');
        setDrawerOpen(true);
    };

    const handleEditMaster = (asset: Device) => {
        setSelectedDevice(asset);
        setDrawerMode('inventory');
        setDrawerOpen(true);
    };

    const handleDuplicateMaster = async (id: string) => {
        setIsRefreshing(true);
        try {
            await duplicateMasterFn({ data: id } as never);
            await loadInventory();
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleDeleteMaster = async (id: string) => {
        if (!confirm('Remove this blueprint from your library?')) return;
        setIsRefreshing(true);
        try {
            await deleteMasterFn({ data: id } as never);
            await loadInventory();
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleAssetSaved = () => {
        setDrawerOpen(false);
        refreshData(true); // Silent refresh
    };

    const handleMoveDevice = async (deviceId: string, newUPosition: number) => {
        const currentDevices =
            viewMode === 'rack' ? rackData?.devices : floorData?.allDevices;
        const device = currentDevices?.find((d) => d.id === deviceId);
        if (!device) return;

        // Optimistic Update
        const updatedDevice = { ...device, uPosition: newUPosition };
        if (viewMode === 'rack' && rackData) {
            setRackData({
                ...rackData,
                devices: rackData.devices.map((d) =>
                    d.id === deviceId ? updatedDevice : d,
                ),
            });
        }

        try {
            await upsertDeviceFn({ data: updatedDevice } as never);
        } catch (error) {
            console.error('Failed to move device:', error);
            refreshData(); // Revert on error
        }
    };

    const handleDragMove = (event: DragMoveEvent) => {
        const { active, over, delta } = event;
        if (over?.id === 'rack-grid') {
            const activeDevice = (rackData?.devices || []).find(
                (d) => d.id === active.id,
            );
            // Fix height detection for both existing devices and library blueprints
            const height =
                activeDevice?.uHeight ||
                active.data.current?.device?.uHeight ||
                1;
            const currentU = activeDevice?.uPosition || 42;

            const uChange = -Math.round(delta.y / 24);
            const capacity = rackData?.rack.uCapacity || 42;
            const projectedU = Math.max(
                1,
                Math.min(capacity - height + 1, currentU + uChange),
            );

            const isOccupied = isRangeOccupied(
                projectedU,
                height,
                rackData?.devices || [],
                active.id as string,
            );
            setProjectedPlacement({
                uPosition: projectedU,
                uHeight: height,
                isOccupied,
            });
        } else {
            setProjectedPlacement(null);
        }
    };

    const refreshData = useCallback(
        (silent = false) => {
            loadInventory();
            if (viewMode === 'rack' && rackData) {
                loadRack(rackData.rack.id, silent);
            } else if (viewMode === 'floor' && floorData) {
                loadFloor(floorData.floor.id, silent);
            }
        },
        [viewMode, rackData, floorData, loadRack, loadFloor, loadInventory],
    );

    const currentData = viewMode === 'rack' ? rackData : floorData;

    // Initial boundary check for currentData availability
    const datacenterName = currentData?.datacenter.name || '...';
    const floorName = currentData?.floor.name || '...';
    const rackName = viewMode === 'rack' ? rackData?.rack.name : undefined;

    return (
        <DndContext
            sensors={sensors}
            modifiers={
                activeDragId?.toString().startsWith('tpl-')
                    ? []
                    : [snapToGridModifier]
            }
            onDragStart={(event) => setActiveDragId(event.active.id as string)}
            onDragMove={handleDragMove}
            onDragEnd={(event) => {
                const { active, over } = event;
                const finalPos = projectedPlacement;
                const isConflict = projectedPlacement?.isOccupied;

                setActiveDragId(null);
                setProjectedPlacement(null);

                if (
                    !active ||
                    over?.id !== 'rack-grid' ||
                    isConflict ||
                    !finalPos
                )
                    return;

                const finalU = finalPos.uPosition;

                // 1. Dropping an Inventory Blueprint onto the rack grid
                if (active.data.current?.type === 'master') {
                    const blueprint = active.data.current.device;
                    const newId = `new-${Date.now()}`;
                    const newAsset: Device = {
                        ...blueprint,
                        id: newId,
                        uPosition: finalU,
                        rackId: rackData?.rack.id || '',
                        status: 'active',
                    };

                    if (rackData) {
                        setRackData({
                            ...rackData,
                            devices: [...rackData.devices, newAsset],
                        });
                    }

                    upsertDeviceFn({ data: newAsset } as never).catch((err) => {
                        console.error('Failed to save new asset:', err);
                        refreshData(true);
                    });

                    setSelectedDevice(newAsset);
                    setDrawerMode('rack');
                    return;
                }

                // 2. Moving an existing device
                const deviceId = active.id as string;
                const device = (
                    rackData?.devices ||
                    floorData?.allDevices ||
                    []
                ).find((d) => d.id === deviceId);

                if (device && finalU !== device.uPosition) {
                    handleMoveDevice(deviceId, finalU);
                }
            }}
        >
            <main className="page-wrap px-4 pb-12 pt-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                        <div>
                            <BreadcrumbNav
                                datacenter={datacenterName}
                                floor={floorName}
                                rack={rackName}
                            />
                            <h1 className="text-3xl font-bold text-(--sea-ink) tracking-tight flex items-center gap-3">
                                {viewMode === 'rack'
                                    ? `Rack ${rackData?.rack.name}`
                                    : `Floor Plan: ${floorData?.floor.name}`}
                            </h1>
                            <p className="text-(--sea-ink-soft) text-sm mt-1">
                                {viewMode === 'rack'
                                    ? `${rackData?.rack.uCapacity}U Capacity • ${rackData?.devices.length} Active Devices`
                                    : `${floorData?.racks.length} Racks • ${floorData?.allDevices.length} Total Assets`}
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <div className="bg-white/50 p-1 rounded-xl border border-zinc-200 flex gap-1 mr-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        viewMode === 'floor' &&
                                        loadRack('rk-01')
                                    }
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'rack' ? 'bg-white text-(--sea-ink) shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                                >
                                    <Box size={14} />
                                    Rack
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        viewMode === 'rack' &&
                                        loadFloor('fl-01')
                                    }
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'floor' ? 'bg-white text-(--sea-ink) shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                                >
                                    <MapIcon size={14} />
                                    Floor
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddAsset}
                                className="flex items-center gap-2 px-4 py-2 bg-(--lagoon-deep) text-white rounded-lg text-sm font-semibold shadow-md shadow-emerald-900/20 hover:brightness-110 transition-all active:scale-95"
                            >
                                <Plus size={16} />
                                Add Asset
                            </button>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
                        {/* Main Workspace Visualizer */}
                        <section className="island-shell bg-white/60 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-emerald-900/5 min-h-200 flex justify-center items-center overflow-auto border-dashed">
                            {loading && !currentData ? (
                                <div className="flex flex-col items-center gap-3 opacity-30">
                                    <Activity
                                        className="animate-spin text-(--sea-teal)"
                                        size={32}
                                    />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">
                                        Connecting to Infrastructure...
                                    </span>
                                </div>
                            ) : viewMode === 'rack' && rackData ? (
                                <RackUGrid
                                    uCapacity={rackData.rack.uCapacity}
                                    devices={rackData.devices}
                                    connections={rackData.connections}
                                    onMoveDevice={handleMoveDevice}
                                    onEditDevice={handleEditAsset}
                                    projectedPlacement={projectedPlacement}
                                />
                            ) : floorData ? (
                                <FloorGrid
                                    floor={floorData.floor}
                                    racks={floorData.racks}
                                    allDevices={floorData.allDevices}
                                    onRackSelect={loadRack}
                                />
                            ) : (
                                <div className="text-zinc-400 text-xs italic">
                                    Select a rack or floor to view connections
                                </div>
                            )}
                        </section>

                        {/* Sidebar Area */}
                        <aside className="space-y-6">
                            <AssetTray
                                inventory={inventory}
                                onEditMaster={handleEditMaster}
                                onDuplicateMaster={handleDuplicateMaster}
                                onDeleteMaster={handleDeleteMaster}
                            />

                            <StatsCard
                                title={
                                    viewMode === 'rack'
                                        ? 'Rack Utilization'
                                        : 'Floor Utilization'
                                }
                                value={
                                    viewMode === 'rack'
                                        ? `${Math.round(((rackData?.devices.reduce((acc, d) => acc + d.uHeight, 0) || 0) / (rackData?.rack.uCapacity || 1)) * 100)}%`
                                        : `${Math.round(((floorData?.racks.length || 0) / ((floorData?.floor.width || 1) * (floorData?.floor.height || 1))) * 100)}%`
                                }
                                icon={
                                    <Activity
                                        className="text-emerald-500"
                                        size={18}
                                    />
                                }
                            />

                            <div className="island-shell rounded-2xl p-6 bg-(--surface-strong) text-(--sea-ink) shadow-2xl border border-(--line)">
                                <div className="flex items-center gap-2 mb-4 opacity-80">
                                    <Info
                                        size={16}
                                        className="text-(--lagoon-deep)"
                                    />
                                    <span className="text-xs font-bold uppercase tracking-widest text-(--sea-ink-soft)">
                                        {viewMode === 'rack'
                                            ? 'Rack Inventory'
                                            : 'Floor Asset Overview'}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {(viewMode === 'rack'
                                        ? rackData?.devices
                                        : floorData?.allDevices
                                    )?.map((device) => (
                                        <button
                                            key={device.id}
                                            type="button"
                                            onClick={() =>
                                                handleEditAsset(device)
                                            }
                                            className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group text-left"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold">
                                                    {device.name}
                                                </span>
                                                <span className="text-[10px] opacity-50 uppercase">
                                                    {device.type} •{' '}
                                                    {device.status}
                                                </span>
                                            </div>
                                            <div
                                                className={`text-[10px] font-mono px-2 py-1 rounded border ${
                                                    device.status === 'active'
                                                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                        : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                                }`}
                                            >
                                                {device.assetTag || 'NO-TAG'}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>

                <Drawer
                    isOpen={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    title={
                        selectedDevice
                            ? drawerMode === 'inventory'
                                ? 'Edit Master Blueprint'
                                : 'Edit Infrastructure Asset'
                            : drawerMode === 'inventory'
                              ? 'Design New Blueprint'
                              : 'Register New Asset'
                    }
                >
                    <AssetForm
                        mode={drawerMode}
                        device={selectedDevice}
                        allDevices={
                            floorData?.allDevices || rackData?.devices || []
                        }
                        connections={
                            viewMode === 'rack'
                                ? rackData?.connections || []
                                : floorData?.connections || []
                        }
                        rackId={rackData?.rack.id || 'rk-01'}
                        onSave={handleAssetSaved}
                        onDelete={handleAssetSaved}
                        onUpdateConnections={refreshData}
                    />
                </Drawer>
            </main>
        </DndContext>
    );
}

function StatsCard({
    title,
    value,
    icon,
}: {
    title: string;
    value: string;
    icon: React.ReactNode;
}) {
    return (
        <div className="island-shell rounded-2xl p-5 bg-white border border-zinc-100 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                    {title}
                </p>
                <p className="text-2xl font-black text-(--sea-ink) leading-none">
                    {value}
                </p>
            </div>
            <div className="p-3 bg-zinc-50 rounded-xl">{icon}</div>
        </div>
    );
}
