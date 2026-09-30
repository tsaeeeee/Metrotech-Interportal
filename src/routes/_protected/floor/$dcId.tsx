import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import {
    ArrowLeft, Cable, Eraser, Grid3X3, Layers3,
    MapPinned, Pencil, Plus, Route as RouteIcon, Save, Server,
    ZoomIn, ZoomOut,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { cn } from '#/lib/utils';
import { FloorCanvas, type FloorTool } from '#/features/floor-planner/components/floor-canvas';
import {
    addPlannerFloor, addPlannerRack, addPlannerRoom, getPlannerOverview,
    placePlannerRack, savePlannerLayout, unplacePlannerRack,
} from '#/features/floor-planner/planner-service';
import { calculateFiberRoute, type PlannedRoute } from '#/features/floor-planner/routing';
import type {
    PlannerCell, PlannerFloor, PlannerLayer, PlannerLayout,
    PlannerOverview,
} from '#/features/floor-planner/types';

export const Route = createFileRoute('/_protected/floor/$dcId')({
    loader: async ({ params }) => {
        try {
            const overview = await getPlannerOverview({
                data: { dcId: params.dcId },
            } as never);
            return { overview };
        } catch {
            throw redirect({ to: '/' });
        }
    },
    component: PlannerPage,
});

const LAYERS: { id: PlannerLayer; label: string; color: string }[] = [
    { id: 'runners', label: 'Fiber Runners', color: '#f0b94e' },
    { id: 'perforated', label: 'Perforated Floor', color: '#60a5fa' },
    { id: 'entries', label: 'Entry Markers', color: '#059669' },
    { id: 'walls', label: 'Structural Walls', color: '#334155' },
    { id: 'blocked', label: 'Blocked Area', color: '#94a3b8' },
];

const initialLayers = {
    grid: true,
    racks: true,
    runners: true,
    perforated: true,
    entries: true,
    walls: true,
    blocked: true,
};

function key(cell: PlannerCell) {
    return String(cell.x) + ',' + String(cell.y);
}

function cloneLayout(layout: PlannerLayout): PlannerLayout {
    return {
        runners: layout.runners.map((point) => ({ ...point })),
        perforated: layout.perforated.map((point) => ({ ...point })),
        entries: layout.entries.map((point) => ({ ...point })),
        walls: layout.walls.map((point) => ({ ...point })),
        blocked: layout.blocked.map((point) => ({ ...point })),
    };
}

function errorMessage(err: unknown) {
    return err instanceof Error ? err.message : 'Operation failed. Please retry.';
}

function PlannerPage() {
    const { overview: initial } = Route.useLoaderData();
    const [overview, setOverview] = useState<PlannerOverview>(initial);
    const [floorId, setFloorId] = useState(initial.floors[0]?.id ?? '');
    const [creatingFloor, setCreatingFloor] = useState(false);
    const [floorName, setFloorName] = useState('');
    const [newGridWidth, setNewGridWidth] = useState(48);
    const [newGridHeight, setNewGridHeight] = useState(22);
    const [tileCm, setTileCm] = useState(60);
    const [busy, setBusy] = useState(false);
    const [pageError, setPageError] = useState('');

    const overviewFn = useServerFn(getPlannerOverview);
    const addFloorFn = useServerFn(addPlannerFloor);

    const refresh = async () => {
        const result = await overviewFn({ data: { dcId: overview.datacenter.id } });
        setOverview(result);
        return result;
    };

    const addFloor = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setPageError('');
        try {
            const result = await addFloorFn({
                data: {
                    dcId: overview.datacenter.id,
                    name: floorName,
                    gridWidth: newGridWidth,
                    gridHeight: newGridHeight,
                    tileCm,
                },
            });
            await refresh();
            setFloorId(result.id);
            setCreatingFloor(false);
            setFloorName('');
        } catch (err) {
            setPageError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const floor = overview.floors.find((candidate) => candidate.id === floorId)
        ?? overview.floors[0];

    return (
        <main className="w-full px-4 pb-10 pt-5 md:px-6">
            <div className="mx-auto max-w-[1920px] space-y-4">
                <div className="ops-toolbar rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-1 rounded-lg border border-(--line) px-3 py-2 text-xs font-bold text-(--sea-ink-soft) hover:text-(--sea-ink)"
                    >
                        <ArrowLeft size={14} /> Datacenters
                    </Link>
                    <div className="mr-auto">
                        <h1 className="text-base font-extrabold text-(--sea-ink)">
                            {overview.datacenter.name} · Floor Planner
                        </h1>
                        <p className="text-[11px] text-(--sea-ink-soft)">
                            Physical placement, fiber runners and cable estimates
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <label htmlFor="planner-floor" className="text-xs font-semibold text-(--sea-ink-soft)">
                            Floor
                        </label>
                        <select
                            id="planner-floor"
                            value={floor?.id ?? ''}
                            onChange={(event) => setFloorId(event.target.value)}
                            className="asset-control max-w-[210px]"
                        >
                            {overview.floors.map((option) => (
                                <option value={option.id} key={option.id}>{option.name}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => setCreatingFloor((value) => !value)}
                            className="rounded-lg border border-(--line) p-2.5 text-(--sea-ink) hover:border-(--sea-teal)"
                            title="Add a floor"
                            aria-label="Add a floor"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                    <Link
                        to="/dc/$dcId"
                        params={{ dcId: overview.datacenter.id }}
                        className="inline-flex items-center gap-2 rounded-lg border border-(--line) bg-(--surface) px-3 py-2 text-xs font-bold text-(--sea-ink)"
                    >
                        <Server size={15} /> Classic Rack View
                    </Link>
                </div>

                {creatingFloor && (
                    <form onSubmit={addFloor} className="ops-panel rounded-xl p-4 flex flex-wrap items-end gap-3">
                        <div className="min-w-44 flex-1">
                            <label htmlFor="floor-name" className="asset-label">New Floor Name</label>
                            <input
                                id="floor-name"
                                className="asset-control"
                                value={floorName}
                                onChange={(event) => setFloorName(event.target.value)}
                                placeholder="e.g. 7th Floor"
                                maxLength={80}
                                required
                            />
                        </div>
                        {[
                            { label: 'Columns', value: newGridWidth, set: setNewGridWidth, min: 10, max: 100 },
                            { label: 'Rows', value: newGridHeight, set: setNewGridHeight, min: 10, max: 80 },
                            { label: 'Tile (cm)', value: tileCm, set: setTileCm, min: 10, max: 200 },
                        ].map((field) => (
                            <div key={field.label} className="w-25">
                                <label className="asset-label">{field.label}</label>
                                <input
                                    type="number"
                                    min={field.min}
                                    max={field.max}
                                    className="asset-control"
                                    value={field.value}
                                    onChange={(event) => field.set(Number(event.target.value))}
                                    required
                                />
                            </div>
                        ))}
                        <button disabled={busy} type="submit" className="rounded-lg bg-(--sea-teal) px-5 py-3 text-xs font-bold text-white disabled:opacity-50">
                            Create Floor
                        </button>
                        <button type="button" onClick={() => setCreatingFloor(false)} className="rounded-lg border border-(--line) px-4 py-3 text-xs font-bold text-(--sea-ink)">
                            Cancel
                        </button>
                    </form>
                )}
                {pageError && <p className="text-sm font-semibold text-red-500">{pageError}</p>}
                {floor && (
                    <FloorWorkspace
                        key={floor.id}
                        floor={floor}
                        overview={overview}
                        refresh={refresh}
                    />
                )}
            </div>
        </main>
    );
}

function FloorWorkspace({
    floor, overview, refresh,
}: {
    floor: PlannerFloor;
    overview: PlannerOverview;
    refresh: () => Promise<PlannerOverview>;
}) {
    const [draft, setDraft] = useState(() => cloneLayout(floor.layout));
    const [version, setVersion] = useState(floor.version);
    const [dirty, setDirty] = useState(false);
    const [editing, setEditing] = useState(false);
    const [tool, setTool] = useState<FloorTool>('select');
    const [layers, setLayers] = useState(initialLayers);
    const [zoom, setZoom] = useState(0.85);
    const [selectedRackId, setSelectedRackId] = useState('');
    const [sourceId, setSourceId] = useState('');
    const [destinationId, setDestinationId] = useState('');
    const [allowance, setAllowance] = useState(3);
    const [calculated, setCalculated] = useState<PlannedRoute | null>(null);
    const [routeError, setRouteError] = useState('');
    const [actionError, setActionError] = useState('');
    const [busy, setBusy] = useState(false);
    const [creatingRoom, setCreatingRoom] = useState(false);
    const [roomName, setRoomName] = useState('');
    const [creatingRackAt, setCreatingRackAt] = useState<PlannerCell | null>(null);
    const [newRackName, setNewRackName] = useState('');
    const [capacity, setCapacity] = useState(42);
    const [roomId, setRoomId] = useState('');
    const [placingRackId, setPlacingRackId] = useState('');

    const addRoomFn = useServerFn(addPlannerRoom);
    const addRackFn = useServerFn(addPlannerRack);
    const placeRackFn = useServerFn(placePlannerRack);
    const unplaceRackFn = useServerFn(unplacePlannerRack);
    const saveLayoutFn = useServerFn(savePlannerLayout);

    const rooms = useMemo(
        () => overview.rooms.filter((room) => room.floorId === floor.id),
        [overview.rooms, floor.id],
    );
    const roomIds = useMemo(() => new Set(rooms.map((room) => room.id)), [rooms]);
    const racks = useMemo(
        () => overview.racks.filter((rack) => roomIds.has(rack.roomId)),
        [overview.racks, roomIds],
    );
    const positioned = racks.filter((rack) =>
        rack.x !== null && rack.y !== null && rack.floorId === floor.id,
    );
    const unplaced = racks.filter((rack) => rack.floorId === null);
    const selectedRack = racks.find((rack) => rack.id === selectedRackId);

    useEffect(() => {
        if (floor.version !== version && !dirty) {
            setDraft(cloneLayout(floor.layout));
            setVersion(floor.version);
        }
    }, [floor.version, floor.layout, dirty, version]);

    const updateCell = (cell: PlannerCell) => {
        if (!editing || tool === 'select') return;
        setActionError('');
        if (tool === 'new-rack') {
            if (creatingRackAt) return;
            setCreatingRackAt(cell);
            setRoomId((current) => current || rooms[0]?.id || '');
            return;
        }
        if (tool === 'place-rack') {
            if (!placingRackId || busy) {
                setActionError('Select an unplaced rack before choosing its grid tile.');
                return;
            }
            setBusy(true);
            void placeRackFn({
                data: { floorId: floor.id, rackId: placingRackId, x: cell.x, y: cell.y },
            }).then(async () => {
                await refresh();
                setSelectedRackId(placingRackId);
                setPlacingRackId('');
                setTool('select');
            }).catch((err: unknown) => setActionError(errorMessage(err)))
                .finally(() => setBusy(false));
            return;
        }

        setDraft((current) => {
            const next = cloneLayout(current);
            const cellId = key(cell);
            if (tool === 'erase') {
                for (const layer of LAYERS) {
                    next[layer.id] = next[layer.id].filter((point) => key(point) !== cellId);
                }
            } else {
                const layer: PlannerLayer = tool;
                const has = next[layer].some((point) => key(point) === cellId);
                if (!has) {
                    next[layer].push(cell);
                    if (layer === 'walls' || layer === 'blocked') {
                        next.runners = next.runners.filter((point) => key(point) !== cellId);
                        next.perforated = next.perforated.filter((point) => key(point) !== cellId);
                    }
                    if (layer === 'runners' || layer === 'perforated') {
                        next.walls = next.walls.filter((point) => key(point) !== cellId);
                        next.blocked = next.blocked.filter((point) => key(point) !== cellId);
                    }
                }
            }
            return next;
        });
        setDirty(true);
        setCalculated(null);
        setRouteError('');
    };

    const saveLayout = async () => {
        setBusy(true);
        setActionError('');
        try {
            const result = await saveLayoutFn({
                data: { floorId: floor.id, layout: draft, expectedVersion: version },
            });
            setDirty(false);
            setVersion(result.version);
            await refresh();
        } catch (err) {
            setActionError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const calculate = () => {
        setRouteError('');
        setCalculated(null);
        const result = calculateFiberRoute({
            layout: draft,
            racks: positioned,
            sourceId,
            destinationId,
            width: floor.gridWidth,
            height: floor.gridHeight,
            tileCm: floor.tileCm,
            slackMeters: allowance,
        });
        if (!result) {
            setRouteError('No connected runner route found. Draw connected fiber runner tiles near both racks, and check walls or blocked areas.');
        } else {
            setCalculated(result);
        }
    };

    const createRoom = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setActionError('');
        try {
            const result = await addRoomFn({ data: { floorId: floor.id, name: roomName } });
            await refresh();
            setRoomId(result.id);
            setRoomName('');
            setCreatingRoom(false);
        } catch (err) {
            setActionError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const createRack = async (event: FormEvent) => {
        event.preventDefault();
        if (!creatingRackAt) return;
        setBusy(true);
        setActionError('');
        try {
            const result = await addRackFn({
                data: {
                    floorId: floor.id,
                    roomId: roomId || rooms[0]?.id || '',
                    name: newRackName,
                    uCapacity: capacity,
                    x: creatingRackAt.x,
                    y: creatingRackAt.y,
                },
            });
            await refresh();
            setSelectedRackId(result.id);
            setCreatingRackAt(null);
            setNewRackName('');
            setTool('select');
        } catch (err) {
            setActionError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const unplace = async (rackId: string) => {
        setBusy(true);
        setActionError('');
        try {
            await unplaceRackFn({ data: { floorId: floor.id, rackId } });
            await refresh();
            setSelectedRackId('');
            setCalculated(null);
        } catch (err) {
            setActionError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const layerFloor: PlannerFloor = { ...floor, layout: draft };
    const total = racks.length;
    const routeLength = calculated
        ? calculated.estimatedMeters.toFixed(2) + ' m'
        : '—';

    return (
        <>
            <div className="ops-toolbar rounded-xl p-3 flex flex-wrap items-center gap-2">
                <div className="mr-auto flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-(--sea-ink)">
                        <MapPinned size={17} className="text-(--sea-teal)" />
                        {floor.name}
                    </span>
                    <span className="text-[11px] font-semibold text-(--sea-ink-soft)">
                        {floor.gridWidth} × {floor.gridHeight} · {floor.tileCm} cm tiles
                    </span>
                    <span className="rounded-md border border-(--line) bg-(--surface-muted) px-2 py-1 text-[11px] font-bold text-(--sea-ink-soft)">
                        {total} racks · {positioned.filter((rack) => rack.deviceCount > 0).length} occupied · {unplaced.length} unplaced
                    </span>
                    {dirty && <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Unsaved layout</span>}
                </div>
                <button
                    type="button"
                    onClick={() => {
                        if (editing && dirty && !confirm('Discard unsaved floor layout changes?')) return;
                        if (editing && dirty) {
                            setDraft(cloneLayout(floor.layout));
                            setDirty(false);
                        }
                        setEditing(!editing);
                        setTool('select');
                        setCreatingRackAt(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-(--line) bg-(--surface) px-3 py-2 text-xs font-bold text-(--sea-ink)"
                >
                    <Pencil size={14} /> {editing ? 'Exit Editor' : 'Edit Layout'}
                </button>
                {editing && (
                    <button
                        disabled={!dirty || busy}
                        type="button"
                        onClick={saveLayout}
                        className="inline-flex items-center gap-2 rounded-lg bg-(--sea-teal) px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                        <Save size={14} /> Save Layout
                    </button>
                )}
                <div className="flex items-center gap-1 rounded-lg border border-(--line) p-1">
                    <button type="button" onClick={() => setZoom((value) => Math.max(.6, value - .1))} aria-label="Zoom out" className="p-1 text-(--sea-ink)"><ZoomOut size={16} /></button>
                    <span className="w-10 text-center text-[11px] font-semibold text-(--sea-ink)">{Math.round(zoom * 100)}%</span>
                    <button type="button" onClick={() => setZoom((value) => Math.min(1.5, value + .1))} aria-label="Zoom in" className="p-1 text-(--sea-ink)"><ZoomIn size={16} /></button>
                    <button type="button" onClick={() => setZoom(.85)} className="px-1 text-[11px] font-semibold text-(--sea-ink-soft)">Fit</button>
                </div>
            </div>

            {actionError && (
                <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm font-semibold text-red-600 dark:text-red-300">
                    {actionError}
                </div>
            )}

            <div className="grid min-w-0 gap-3 xl:grid-cols-[240px_minmax(0,1fr)_206px]">
                <aside className="min-w-0 space-y-3">
                    <div className="ops-panel rounded-xl p-3 space-y-3">
                        <div className="flex items-center gap-2 border-b border-(--line) pb-2 text-xs font-extrabold text-(--sea-ink)">
                            <Cable size={15} /> Cable Route Planner
                        </div>
                        <div>
                            <label htmlFor="route-source" className="asset-label text-emerald-600 dark:text-emerald-400">Source Rack</label>
                            <select id="route-source" value={sourceId} onChange={(event) => { setSourceId(event.target.value); setCalculated(null); }} className="asset-control">
                                <option value="">Select source rack</option>
                                {positioned.map((rack) => <option key={rack.id} value={rack.id}>{rack.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="route-destination" className="asset-label text-blue-600 dark:text-blue-400">Destination Rack</label>
                            <select id="route-destination" value={destinationId} onChange={(event) => { setDestinationId(event.target.value); setCalculated(null); }} className="asset-control">
                                <option value="">Select destination rack</option>
                                {positioned.filter((rack) => rack.id !== sourceId).map((rack) => <option key={rack.id} value={rack.id}>{rack.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="route-slack" className="asset-label">Allowance / Slack (m)</label>
                            <input id="route-slack" type="number" min="0" max="100" step=".5" value={allowance} onChange={(event) => { setAllowance(Number(event.target.value)); setCalculated(null); }} className="asset-control" />
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={!sourceId || !destinationId}
                                onClick={calculate}
                                className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-(--sea-teal) px-2 py-2 text-[11px] font-bold text-white disabled:opacity-40"
                            >
                                <RouteIcon size={13} /> Calculate Route
                            </button>
                            <button type="button" onClick={() => { setCalculated(null); setRouteError(''); }} className="rounded-md border border-(--line) px-2 py-2 text-[11px] font-bold text-(--sea-ink)">
                                Clear
                            </button>
                        </div>
                        {routeError && <p role="alert" className="text-xs font-semibold text-red-500">{routeError}</p>}
                        {calculated ? (
                            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-1.5">
                                <span className="text-[10px] font-bold uppercase text-(--sea-ink-soft)">Calculated Fiber Route</span>
                                <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-300">{routeLength}</div>
                                <p className="text-[11px] text-(--sea-ink-soft)">
                                    Floor path: {calculated.distanceMeters.toFixed(2)} m<br />
                                    Access leads: {calculated.leadTiles} tiles<br />
                                    Runner: {calculated.runnerTiles} segments<br />
                                    Extra allowance: {allowance} m
                                </p>
                                <p className="text-[10px] text-(--sea-ink-soft)">
                                    Estimate only. Verify vertical drops, routing and slack on-site.
                                </p>
                            </div>
                        ) : !routeError && (
                            <p className="rounded-md bg-(--surface-muted) p-2 text-[11px] text-(--sea-ink-soft)">
                                Select source and destination racks, then calculate the route.
                            </p>
                        )}
                    </div>

                    {editing && (
                        <div className="ops-panel rounded-xl p-3 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-extrabold text-(--sea-ink)">
                                <Pencil size={14} /> Layout Tools
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {[
                                    { id: 'select', label: 'Select', icon: MapPinned },
                                    { id: 'new-rack', label: 'New Rack', icon: Plus },
                                    { id: 'place-rack', label: 'Place Rack', icon: Server },
                                    { id: 'erase', label: 'Erase Tile', icon: Eraser },
                                ].map((entry) => (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        onClick={() => setTool(entry.id as FloorTool)}
                                        className={cn(
                                            'inline-flex items-center justify-center gap-1 rounded-md border px-1.5 py-2 text-[11px] font-semibold',
                                            tool === entry.id
                                                ? 'border-(--sea-teal) bg-emerald-500/10 text-(--sea-teal)'
                                                : 'border-(--line) text-(--sea-ink-soft)',
                                        )}
                                    >
                                        <entry.icon size={13} /> {entry.label}
                                    </button>
                                ))}
                            </div>
                            {tool === 'place-rack' && (
                                <div>
                                    <label htmlFor="unplaced-rack" className="asset-label">Existing Unplaced Rack</label>
                                    <select id="unplaced-rack" className="asset-control" value={placingRackId} onChange={(event) => setPlacingRackId(event.target.value)}>
                                        <option value="">Select rack</option>
                                        {unplaced.map((rack) => <option key={rack.id} value={rack.id}>{rack.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="border-t border-(--line) pt-3">
                                <span className="asset-section-label">Draw Layer</span>
                                <div className="mt-2 grid grid-cols-2 gap-1.5">
                                    {LAYERS.map((entry) => (
                                        <button
                                            key={entry.id}
                                            type="button"
                                            onClick={() => setTool(entry.id)}
                                            className={cn(
                                                'flex items-center gap-2 rounded-md border p-2 text-left text-[10px] font-semibold',
                                                tool === entry.id
                                                    ? 'border-(--sea-teal) bg-emerald-500/10 text-(--sea-ink)'
                                                    : 'border-(--line) text-(--sea-ink-soft)',
                                            )}
                                        >
                                            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: entry.color }} />
                                            {entry.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <p className="text-[10px] text-(--sea-ink-soft)">Paint cells with the pointer, then save the layout.</p>
                        </div>
                    )}
                </aside>

                <section className="min-w-0 ops-panel rounded-xl p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-(--sea-ink)">
                            <Grid3X3 size={14} /> Floor Map
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <Layers3 size={13} className="text-(--sea-ink-soft)" />
                            {([
                                ['runners', 'Runner'],
                                ['perforated', 'Floor'],
                                ['grid', 'Grid'],
                                ['racks', 'Racks'],
                                ['walls', 'Walls'],
                            ] as const).map(([name, label]) => (
                                <label key={name} className="flex items-center gap-1 rounded-md border border-(--line) px-1.5 py-1 text-[10px] font-semibold text-(--sea-ink-soft)">
                                    <input
                                        type="checkbox"
                                        checked={layers[name]}
                                        onChange={(event) => setLayers((current) => ({ ...current, [name]: event.target.checked }))}
                                    />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </div>
                    <FloorCanvas
                        floor={layerFloor}
                        racks={positioned}
                        show={layers}
                        selectedRackId={selectedRackId}
                        sourceId={sourceId}
                        destinationId={destinationId}
                        route={calculated?.cells ?? []}
                        editMode={editing}
                        tool={tool}
                        zoom={zoom}
                        onCell={updateCell}
                        onRack={setSelectedRackId}
                    />
                    <div className="text-[10px] text-(--sea-ink-soft)">
                        Grid scale: {floor.tileCm / 100} m / tile · Route follows connected drawn runner tiles.
                    </div>
                </section>

                <aside className="min-w-0 space-y-3">
                    <div className="ops-panel rounded-xl p-3 space-y-2">
                        <h2 className="asset-section-label">Legend</h2>
                        {[
                            ['#dcfce7', 'Occupied Rack'],
                            ['#475569', 'Empty Rack'],
                            ['#eebc58', 'Fiber Runner'],
                            ['#1558d6', 'Calculated Route'],
                            ['#60a5fa', 'Perforated Floor'],
                            ['#334155', 'Structural Wall'],
                        ].map(([color, label]) => (
                            <div key={label} className="flex items-center gap-2 text-[11px] text-(--sea-ink-soft)">
                                <span className="h-2.5 w-4 rounded-sm border border-(--line)" style={{ backgroundColor: color }} />
                                {label}
                            </div>
                        ))}
                    </div>

                    <div className="ops-panel rounded-xl p-3 space-y-3">
                        <h2 className="asset-section-label">Selected Rack</h2>
                        {selectedRack ? (
                            <>
                                <div className="text-sm font-extrabold text-(--sea-ink)">{selectedRack.name}</div>
                                <div className="text-[11px] text-(--sea-ink-soft)">
                                    {selectedRack.uCapacity}U · {selectedRack.deviceCount} devices
                                </div>
                                <div className="text-[11px] text-(--sea-ink-soft)">
                                    Room: {rooms.find((room) => room.id === selectedRack.roomId)?.name ?? '—'}
                                </div>
                                <Link
                                    to="/dc/$dcId"
                                    params={{ dcId: overview.datacenter.id }}
                                    search={{ rack: selectedRack.id }}
                                    className="flex items-center justify-center gap-1 rounded-md bg-(--sea-teal) px-2 py-2 text-[11px] font-bold text-white"
                                >
                                    <Server size={13} /> Open Rack Assets
                                </Link>
                                {editing && selectedRack.floorId === floor.id && (
                                    <button type="button" disabled={busy} onClick={() => void unplace(selectedRack.id)} className="w-full rounded-md border border-(--line) px-2 py-2 text-[11px] font-semibold text-(--sea-ink)">
                                        Remove from Map
                                    </button>
                                )}
                            </>
                        ) : (
                            <p className="text-[11px] text-(--sea-ink-soft)">Click any rack on the map to inspect it.</p>
                        )}
                    </div>

                    <div className="ops-panel rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="asset-section-label">Rooms</h2>
                            <button type="button" onClick={() => setCreatingRoom((value) => !value)} className="rounded border border-(--line) p-1 text-(--sea-ink)" aria-label="Add room"><Plus size={12} /></button>
                        </div>
                        {rooms.map((room) => (
                            <div key={room.id} className="flex items-center justify-between border-b border-(--line) py-1 text-[11px]">
                                <span className="truncate font-semibold text-(--sea-ink)">{room.name}</span>
                                <span className="text-(--sea-ink-soft)">{racks.filter((rack) => rack.roomId === room.id).length}</span>
                            </div>
                        ))}
                        {creatingRoom && (
                            <form onSubmit={(event) => void createRoom(event)} className="space-y-2">
                                <label htmlFor="new-room-name" className="asset-label">Room Name</label>
                                <input id="new-room-name" className="asset-control" maxLength={80} value={roomName} onChange={(event) => setRoomName(event.target.value)} required placeholder="e.g. Cage A" />
                                <button type="submit" disabled={busy} className="w-full rounded-md bg-(--sea-teal) px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50">Create Room</button>
                            </form>
                        )}
                        {unplaced.length > 0 && (
                            <p className="text-[10px] text-(--sea-ink-soft)">
                                {unplaced.length} existing racks have no floor-map position. Use Edit Layout → Place Rack.
                            </p>
                        )}
                    </div>
                </aside>
            </div>

            {creatingRackAt && (
                <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 px-4">
                    <form onSubmit={(event) => void createRack(event)} className="ops-panel w-full max-w-md space-y-4 rounded-xl p-6 shadow-2xl">
                        <h2 className="text-lg font-extrabold text-(--sea-ink)">Add Rack to Floor</h2>
                        <p className="text-xs text-(--sea-ink-soft)">
                            Grid coordinate {creatingRackAt.x}, {creatingRackAt.y} on {floor.name}.
                        </p>
                        <div>
                            <label htmlFor="planner-rack-name" className="asset-label">Rack Name</label>
                            <input
                                id="planner-rack-name"
                                className="asset-control"
                                value={newRackName}
                                onChange={(event) => setNewRackName(event.target.value)}
                                required
                                maxLength={80}
                                placeholder="e.g. 032"
                            />
                        </div>
                        <div>
                            <label htmlFor="planner-room" className="asset-label">Room</label>
                            <select
                                id="planner-room"
                                className="asset-control"
                                value={roomId}
                                onChange={(event) => setRoomId(event.target.value)}
                                required
                            >
                                <option value="">Select a room</option>
                                {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="planner-capacity" className="asset-label">Capacity</label>
                            <select id="planner-capacity" className="asset-control" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))}>
                                {[42, 48, 52].map((value) => <option key={value} value={value}>{value}U</option>)}
                            </select>
                        </div>
                        {rooms.length === 0 && <p className="text-xs text-amber-500">Create a room on this floor first.</p>}
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setCreatingRackAt(null)}
                                className="rounded-lg border border-(--line) px-4 py-2 text-xs font-bold text-(--sea-ink)"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={busy || !roomId || rooms.length === 0}
                                className="rounded-lg bg-(--sea-teal) px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                            >
                                Add Rack
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}
