import {
    DndContext,
    type DragMoveEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Activity, Box, Info, Plus } from 'lucide-react';
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { cn } from '#/lib/utils';
import type { Connection, Device, Floor, Rack, Room } from '#/types/schema';
import { BreadcrumbNav } from '../../../components/breadcrumb-nav';
import { Drawer } from '../../../components/drawer';
import {
    createRack,
    createRoom,
    deleteInventoryAsset,
    deleteRack,
    deleteRoom,
    duplicateInventoryAsset,
    getFullRackContext,
    getFullRoomContext,
    getInfrastructureSummary,
    getInventory,
    updateEntityOrder,
    updateRack,
    updateRackPosition,
    updateRoom,
    upsertDevice,
} from '../../../features/database/database-service';
import { getDatacenterById } from '../../../features/datacenters/datacenter-service';
import { AssetForm } from '../../../features/editor/components/asset-form';
import { AssetTray } from '../../../features/editor/components/asset-palette';
import { InfrastructureNavigator } from '../../../features/navigation/components/infrastructure-navigator';
import { RackUGrid } from '../../../features/racks/components/rack-u-grid';
import { isRangeOccupied } from '../../../features/racks/utils/collision';
import { createSnapToUModifier } from '../../../features/racks/utils/modifiers';

export const Route = createFileRoute('/_protected/dc/$dcId')({
    loader: async ({ params }) => {
        const dc = await getDatacenterById({ data: params.dcId } as never);
        if (!dc) throw redirect({ to: '/' });
        return { dc };
    },
    component: App,
});

type ViewMode = 'room' | 'rack';

function App() {
    const { dc } = Route.useLoaderData();
    // 1. DND Global State
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
    );
    const snapToGridModifier = useMemo(() => createSnapToUModifier(24), []);

    const fetchRack = useServerFn(getFullRackContext);
    const fetchRoom = useServerFn(getFullRoomContext);
    const upsertDeviceFn = useServerFn(upsertDevice);
    const fetchInventoryFn = useServerFn(getInventory);
    const duplicateMasterFn = useServerFn(duplicateInventoryAsset);
    const deleteMasterFn = useServerFn(deleteInventoryAsset);
    const _createRoomFn = useServerFn(createRoom);
    const _createRackFn = useServerFn(createRack);
    const fetchHierarchyFn = useServerFn(getInfrastructureSummary);
    const updateRoomFn = useServerFn(updateRoom);
    const deleteRoomFn = useServerFn(deleteRoom);
    const updateRackFn = useServerFn(updateRack);
    const deleteRackFn = useServerFn(deleteRack);
    const updateEntityOrderFn = useServerFn(updateEntityOrder);
    const updateRackPositionFn = useServerFn(updateRackPosition);

    const [viewMode, setViewMode] = useState<ViewMode>('rack');
    const [rackData, setRackData] = useState<{
        rack: Rack;
        room: Room;
        floor: Floor;
        devices: Device[];
        connections: Connection[];
    } | null>(null);

    const [roomData, setRoomData] = useState<{
        room: Room;
        racks: Rack[];
        floor: Floor;
        allDevices: Device[];
        connections: Connection[];
    } | null>(null);

    const [inventory, setInventory] = useState<Device[]>([]);
    const [loading, setLoading] = useState(false);
    const [_isRefreshing, setIsRefreshing] = useState(false);
    const initialLoadRef = useRef(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerMode, setDrawerMode] = useState<'inventory' | 'rack'>('rack');
    const [hierarchy, setHierarchy] = useState<{
        floors: Floor[];
        rooms: Room[];
        racks: Rack[];
    } | null>(null);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [selectedDevice, setSelectedDevice] = useState<Device | undefined>(
        undefined,
    );
    const [projectedPlacement, setProjectedPlacement] = useState<{
        uPosition: number;
        uHeight: number;
        isOccupied: boolean;
    } | null>(null);

    // 2. Expansion State
    const [isAddingRoom, setIsAddingRoom] = useState(false);
    const [isAddingRack, setIsAddingRack] = useState(false);

    const currentData = useMemo(
        () => (viewMode === 'rack' ? rackData : roomData),
        [viewMode, rackData, roomData],
    );

    const loadRack = useCallback(
        async (id: string, silent = false) => {
            // Only show full-page loading state if we have ZERO data
            if (!silent && !rackData) {
                setLoading(true);
            }
            setIsRefreshing(true);
            try {
                const result = await fetchRack({ data: id } as never);
                setRackData(result as NonNullable<typeof rackData>);
                setViewMode('rack');
            } finally {
                if (!silent) setLoading(false);
                setIsRefreshing(false);
            }
        },
        [fetchRack, rackData],
    );

    const loadRoom = useCallback(
        async (id: string, silent = false) => {
            if (!silent && !roomData) {
                setLoading(true);
            }
            setIsRefreshing(true);
            try {
                const result = await fetchRoom({ data: id } as never);
                setRoomData(result as NonNullable<typeof roomData>);
                setViewMode('room');
            } finally {
                if (!silent) setLoading(false);
                setIsRefreshing(false);
            }
        },
        [fetchRoom, roomData],
    );

    const loadInventory = useCallback(async () => {
        try {
            const result = await fetchInventoryFn();
            setInventory(result);
        } catch (error) {
            console.error('Failed to load inventory:', error);
        }
    }, [fetchInventoryFn]);

    const loadHierarchy = useCallback(async () => {
        try {
            const result = await fetchHierarchyFn();
            setHierarchy(result as NonNullable<typeof hierarchy>);
        } catch (error) {
            console.error('Failed to load hierarchy:', error);
        }
    }, [fetchHierarchyFn]);

    useEffect(() => {
        if (initialLoadRef.current) return;
        initialLoadRef.current = true;

        if (!rackData && !roomData) {
            setLoading(true);
        }

        const initializeData = async () => {
            try {
                const hierarchyResult = await fetchHierarchyFn();
                setHierarchy(hierarchyResult as NonNullable<typeof hierarchy>);

                // Auto-select the first rack in this datacenter
                const dcRooms = hierarchyResult.rooms.filter(
                    (r) => r.floorId === dc.code,
                );
                const firstRoom = dcRooms[0];
                const firstRack = firstRoom
                    ? hierarchyResult.racks.find(
                          (r) => r.roomId === firstRoom.id,
                      )
                    : null;

                if (firstRack) {
                    await loadRack(firstRack.id, true);
                } else if (firstRoom) {
                    await loadRoom(firstRoom.id, true);
                } else {
                    setLoading(false);
                }

                await loadInventory();
            } catch (err) {
                console.error('Failed to initialize data:', err);
                setLoading(false);
            }
        };

        initializeData();
    }, [
        loadRack,
        loadRoom,
        loadInventory,
        fetchHierarchyFn,
        dc.code,
        rackData,
        roomData,
    ]);

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

    const refreshData = useCallback(
        (silent = false) => {
            if (viewMode === 'rack' && rackData)
                loadRack(rackData.rack.id, silent);
            if (viewMode === 'room' && roomData)
                loadRoom(roomData.room.id, silent);
            loadInventory();
            loadHierarchy();
        },
        [
            viewMode,
            rackData,
            roomData,
            loadRack,
            loadRoom,
            loadInventory,
            loadHierarchy,
        ],
    );

    const handleAssetSaved = () => {
        setDrawerOpen(false);
        refreshData();
    };

    const handleRoomCreated = useCallback(
        (newId?: string) => {
            setIsAddingRoom(false);
            if (newId) {
                loadRoom(newId);
                loadHierarchy();
            } else {
                refreshData();
            }
        },
        [refreshData, loadRoom, loadHierarchy],
    );

    const handleRackCreated = useCallback(
        (newId?: string) => {
            setIsAddingRack(false);
            if (newId) {
                loadRack(newId);
                loadHierarchy();
            } else {
                refreshData();
            }
        },
        [refreshData, loadRack, loadHierarchy],
    );

    const handleUpdateRoom = async (id: string, name: string) => {
        setIsRefreshing(true);
        try {
            await updateRoomFn({ data: { id, name } } as never);
            await loadHierarchy();
            if (roomData?.room.id === id) refreshData(true);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleDeleteRoom = async (id: string) => {
        if (!confirm('Delete this room and all its racks?')) return;
        setIsRefreshing(true);
        try {
            await deleteRoomFn({ data: id } as never);
            await loadHierarchy();
            if (roomData?.room.id === id || rackData?.room.id === id) {
                loadRack('rk-01'); // Fallback
            }
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleUpdateRack = async (id: string, name: string) => {
        setIsRefreshing(true);
        try {
            await updateRackFn({ data: { id, name, uCapacity: 42 } } as never); // Default capacity for now
            await loadHierarchy();
            if (rackData?.rack.id === id) refreshData(true);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleDeleteRack = async (id: string) => {
        if (!confirm('Delete this rack and its devices?')) return;
        setIsRefreshing(true);
        try {
            await deleteRackFn({ data: id } as never);
            await loadHierarchy();
            if (rackData?.rack.id === id) {
                loadRoom(roomData?.room.id || 'fl-01');
            }
        } finally {
            setIsRefreshing(false);
        }
    };

    const _handleMoveRack = async (id: string, x: number, y: number) => {
        setIsRefreshing(true);
        try {
            await updateRackPositionFn({ data: { id, x, y } } as never);
            await loadHierarchy();
            if (viewMode === 'room' && roomData)
                loadRoom(roomData.room.id, true);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleReorder = async (
        type: 'room' | 'rack',
        orders: { id: string; order: number }[],
    ) => {
        setIsRefreshing(true);
        try {
            await updateEntityOrderFn({ data: { type, orders } } as never);
            await loadHierarchy();
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleMoveDevice = async (deviceId: string, newUPosition: number) => {
        const currentDevices =
            viewMode === 'rack' ? rackData?.devices : roomData?.allDevices;
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

    // Initial boundary check for currentData availability
    const _floorName = currentData?.floor.name || '...';
    const roomName = currentData?.room.name || '...';
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
                    roomData?.allDevices ||
                    []
                ).find((d) => d.id === deviceId);

                if (device && finalU !== device.uPosition) {
                    handleMoveDevice(deviceId, finalU);
                }
            }}
        >
            <main className="w-full px-4 md:px-8 pb-12 pt-8">
                <div className="max-w-[1920px] w-full mx-auto">
                    {/* Header Section */}
                    <div className="flex flex-col gap-6 mb-10">
                        {/* Top Level: Back link + Breadcrumbs */}
                        <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
                            <Link
                                to="/"
                                className="flex items-center gap-1.5 text-xs font-bold text-(--sea-ink-soft) hover:text-(--lagoon-deep) transition-colors shrink-0"
                            >
                                ← Datacenters
                            </Link>
                            <span className="text-(--sea-ink-soft) opacity-30">
                                /
                            </span>
                            <BreadcrumbNav
                                datacenter={dc.name}
                                floor={roomName}
                                rack={rackName}
                            />
                        </div>

                        {/* Main Level: Context Title & Primary Actions */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h1 className="text-3xl font-black text-zinc-800 dark:text-zinc-100 tracking-tighter">
                                    {!roomData && !rackData
                                        ? 'Datacenter Infrastructure'
                                        : viewMode === 'rack'
                                          ? rackData?.rack.name || 'Rack'
                                          : `Room Plan: ${roomData?.room.name || 'Loading...'}`}
                                </h1>
                                <p className="text-(--sea-ink-soft) text-sm font-medium mt-1 opacity-70">
                                    {!roomData && !rackData
                                        ? 'No infrastructure items found. Start by creating a room.'
                                        : viewMode === 'rack'
                                          ? rackData
                                              ? `${rackData.rack.uCapacity}U Capacity • ${rackData.devices.length} Active Devices`
                                              : 'No rack selected'
                                          : roomData
                                            ? `${roomData.racks.length} Racks • ${roomData.allDevices.length} Total Assets`
                                            : 'No room selected'}
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Contextual Primary Action */}
                                {!roomData && !rackData ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingRoom(true)}
                                        className={cn(
                                            'flex items-center gap-2 px-6 py-2.5 bg-(--lagoon-deep) text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-900/15 dark:shadow-lagoon/20 hover:brightness-110 transition-all active:scale-95 whitespace-nowrap border border-white/10 dark:border-white/5 cursor-pointer',
                                        )}
                                    >
                                        <Plus size={18} />
                                        Add Room
                                    </button>
                                ) : viewMode === 'room' ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingRack(true)}
                                        className={cn(
                                            'flex items-center gap-2 px-6 py-2.5 bg-(--lagoon-deep) text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-900/15 dark:shadow-lagoon/20 hover:brightness-110 transition-all active:scale-95 whitespace-nowrap border border-white/10 dark:border-white/5 cursor-pointer',
                                        )}
                                    >
                                        <Plus size={18} />
                                        Add Rack
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleAddAsset}
                                        disabled={!rackData}
                                        className={cn(
                                            'flex items-center gap-2 px-6 py-2.5 bg-(--lagoon-deep) text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-900/15 dark:shadow-lagoon/20 transition-all whitespace-nowrap border border-white/10 dark:border-white/5 cursor-pointer',
                                            rackData ? 'hover:brightness-110 active:scale-95' : 'opacity-50 cursor-not-allowed'
                                        )}
                                    >
                                        <Plus size={18} />
                                        Add Asset
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Creation Forms */}
                    {isAddingRoom && (
                        <AddRoomForm
                            dcCode={dc.code}
                            onCancel={() => setIsAddingRoom(false)}
                            onSuccess={handleRoomCreated}
                        />
                    )}

                    {isAddingRack && roomData && (
                        <AddRackForm
                            roomId={roomData.room.id}
                            roomName={roomData.room.name}
                            onCancel={() => setIsAddingRack(false)}
                            onSuccess={handleRackCreated}
                        />
                    )}

                    <div className="grid lg:grid-cols-[320px_1fr_400px] 2xl:grid-cols-[350px_1fr_450px] gap-8 items-start">
                        {/* 1. Infrastructure Navigator Sidebar */}
                        <InfrastructureNavigator
                            hierarchy={hierarchy}
                            viewMode={viewMode}
                            currentRoomId={
                                roomData?.room.id || rackData?.room.id
                            }
                            currentRackId={rackData?.rack.id}
                            onLoadRoom={loadRoom}
                            onLoadRack={loadRack}
                            onAddRoom={() => setIsAddingRoom(true)}
                            onAddRack={() => setIsAddingRack(true)}
                            onUpdateRoom={handleUpdateRoom}
                            onDeleteRoom={handleDeleteRoom}
                            onUpdateRack={handleUpdateRack}
                            onDeleteRack={handleDeleteRack}
                            onReorder={handleReorder}
                        />

                        {/* 2. Main Workspace Visualizer */}
                        <section className="island-shell bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl border border-white/40 dark:border-zinc-800/40 rounded-[2.5rem] p-8 md:py-12 md:px-12 xl:px-16 shadow-2xl shadow-emerald-900/5 min-h-200 flex justify-center items-center overflow-auto border-dashed">
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
                            ) : (
                                <div className="flex flex-col items-center gap-4 text-zinc-400 py-20 animate-in fade-in zoom-in duration-300 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center shadow-inner">
                                        <Box
                                            size={24}
                                            className="text-zinc-300"
                                        />
                                    </div>
                                    <div className="text-sm font-medium max-w-sm">
                                        {!roomData && !rackData
                                            ? 'Your datacenter is empty. Use the "Add Room" button above to get started.'
                                            : viewMode === 'rack'
                                              ? 'Select a rack from the sidebar to view its configuration.'
                                              : 'Select a room from the sidebar to view its layout.'}
                                    </div>
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
                                        : 'Room Utilization'
                                }
                                value={
                                    viewMode === 'rack'
                                        ? `${Math.round(((rackData?.devices.reduce((acc, d) => acc + d.uHeight, 0) || 0) / (rackData?.rack.uCapacity || 1)) * 100)}%`
                                        : `${Math.round(((roomData?.racks.length || 0) / ((roomData?.room.width || 1) * (roomData?.room.height || 1))) * 100)}%`
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
                                            : 'Room Asset Overview'}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {(viewMode === 'rack'
                                        ? rackData?.devices
                                        : roomData?.allDevices
                                    )?.map((device) => (
                                        <button
                                            key={device.id}
                                            type="button"
                                            onClick={() =>
                                                handleEditAsset(device)
                                            }
                                            className="w-full flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer group text-left"
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
                            roomData?.allDevices || rackData?.devices || []
                        }
                        connections={
                            viewMode === 'rack'
                                ? rackData?.connections || []
                                : roomData?.connections || []
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
        <div className="island-shell rounded-2xl p-6 bg-white/40 dark:bg-zinc-900/40 shadow-2xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div>
                <p className="text-[10px] font-extrabold text-(--sea-ink-soft) uppercase tracking-widest mb-1">
                    {title}
                </p>
                <div className="text-2xl font-black text-(--sea-ink) tracking-tight">
                    {value}
                </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-zinc-100/50 dark:bg-zinc-800/50 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                {icon}
            </div>
        </div>
    );
}

const AddRoomForm = React.memo(
    ({
        dcCode,
        onCancel,
        onSuccess,
    }: {
        dcCode: string;
        onCancel: () => void;
        onSuccess: (id?: string) => void;
    }) => {
        const [newRoomName, setNewRoomName] = useState('');
        const [loading, setLoading] = useState(false);
        const createRoomFn = useServerFn(createRoom);

        const handleCreateRoom = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!newRoomName.trim()) return;
            setLoading(true);
            try {
                const result = await createRoomFn({
                    data: {
                        name: newRoomName,
                        floorId: dcCode,
                        width: 12,
                        height: 10,
                    },
                } as never);
                setNewRoomName('');
                onSuccess(result.room.id);
            } finally {
                setLoading(false);
            }
        };

        return (
            <div className="mb-8 p-6 bg-white dark:bg-zinc-900 rounded-2xl border-2 border-(--lagoon-deep)/20 shadow-xl animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <Plus className="text-(--lagoon-deep)" />
                    Create New Room
                </h3>
                <form
                    onSubmit={handleCreateRoom}
                    className="flex flex-col md:flex-row gap-4"
                >
                    <input
                        type="text"
                        placeholder="Room Name (e.g. Server Room B)"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        className="flex-1 px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-(--lagoon-deep)/50 transition-all font-medium dark:text-white"
                    />
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-(--lagoon-deep) text-white rounded-xl font-bold shadow-lg shadow-emerald-900/15 hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Create Room'}
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="px-6 py-2 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        );
    },
);

const AddRackForm = React.memo(
    ({
        roomId,
        roomName,
        onCancel,
        onSuccess,
    }: {
        roomId: string;
        roomName: string;
        onCancel: () => void;
        onSuccess: (id?: string) => void;
    }) => {
        const [newRackName, setNewRackName] = useState('');
        const [newRackCapacity, setNewRackCapacity] = useState<number>(42);
        const [loading, setLoading] = useState(false);
        const createRackFn = useServerFn(createRack);

        const handleCreateRack = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!newRackName.trim()) return;
            setLoading(true);
            try {
                const result = await createRackFn({
                    data: {
                        name: newRackName,
                        roomId: roomId,
                        uCapacity: newRackCapacity,
                        x: Math.floor(Math.random() * 8),
                        y: Math.floor(Math.random() * 8),
                    },
                } as never);
                setNewRackName('');
                onSuccess(result.rack.id);
            } finally {
                setLoading(false);
            }
        };

        return (
            <div className="mb-8 p-6 bg-white dark:bg-zinc-900 rounded-2xl border-2 border-(--lagoon-deep)/20 shadow-xl animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <Plus className="text-(--lagoon-deep)" />
                    Add New Rack to {roomName}
                </h3>
                <form
                    onSubmit={handleCreateRack}
                    className="flex flex-col md:flex-row gap-4 items-end"
                >
                    <div className="flex-1 space-y-2">
                        <label
                            htmlFor="newRackName"
                            className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1"
                        >
                            Rack Name
                        </label>
                        <input
                            id="newRackName"
                            type="text"
                            placeholder="Rack Name (e.g. A-12)"
                            value={newRackName}
                            onChange={(e) => setNewRackName(e.target.value)}
                            className="w-full px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-(--lagoon-deep)/50 transition-all font-medium dark:text-white"
                        />
                    </div>
                    <div className="space-y-2">
                        <label
                            htmlFor="newRackCapacity"
                            className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1"
                        >
                            Capacity
                        </label>
                        <select
                            id="newRackCapacity"
                            value={newRackCapacity}
                            onChange={(e) =>
                                setNewRackCapacity(Number(e.target.value))
                            }
                            className="w-32 px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-(--lagoon-deep)/50 transition-all font-bold appearance-none cursor-pointer dark:text-white"
                        >
                            <option value={42}>42U</option>
                            <option value={48}>48U</option>
                            <option value={52}>52U</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-(--lagoon-deep) text-white rounded-xl font-bold shadow-lg shadow-emerald-900/15 hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Create Rack'}
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="px-6 py-2 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        );
    },
);
