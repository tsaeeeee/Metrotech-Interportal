import { useServerFn } from '@tanstack/react-start';
import {
    Cable,
    Database,
    Info,
    Layout,
    Network,
    Save,
    Server,
    Trash2,
    Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { PortFaceplate } from '#/features/connectivity/components/port-faceplate';
import {
    connectPorts,
    deleteDevice,
    deleteInventoryAsset,
    disconnectPorts,
    upsertDevice,
    upsertInventoryAsset,
} from '#/features/database/database-service';
import { cn } from '#/lib/utils';
import type { Connection, Device, Port } from '#/types/schema';

interface AssetFormProps {
    mode?: 'inventory' | 'rack';
    device?: Device;
    allDevices: Device[];
    connections: Connection[];
    rackId: string;
    onSave: (device: Device) => void;
    onDelete: (id: string) => void;
    onUpdateConnections: () => void;
}

const BASE_PRESETS = [
    {
        name: 'Standard Server',
        type: 'server',
        uHeight: 2,
        icon: Server,
        color: '#2ecc71',
        ports: 8,
    },
    {
        name: 'Core Switch',
        type: 'network',
        uHeight: 1,
        icon: Network,
        color: '#3498db',
        ports: 24,
    },
    {
        name: 'Storage Array',
        type: 'storage',
        uHeight: 4,
        icon: Database,
        color: '#9b59b6',
        ports: 4,
    },
    {
        name: 'Storage Array',
        type: 'storage',
        uHeight: 4,
        icon: Database,
        color: '#9b59b6',
        ports: 4,
    },
];

export function AssetForm({
    mode = 'rack',
    device,
    allDevices,
    connections,
    rackId,
    onSave,
    onDelete,
    onUpdateConnections,
}: AssetFormProps) {
    const upsertInventoryFn = useServerFn(upsertInventoryAsset);
    const [activeTab, setActiveTab] = useState<'info' | 'connections'>('info');
    const [isPatching, setIsPatching] = useState<Port | null>(null);
    const [formData, setFormData] = useState<Device>({
        id: crypto.randomUUID(),
        name: '',
        rackId: mode === 'rack' ? rackId : '',
        uHeight: 1,
        uPosition: 1,
        type: 'server',
        depth: 'full',
        status: 'active',
        assetTag: '',
        serialNumber: '',
        model: '',
        manufacturer: '',
        ports: [],
    });

    useEffect(() => {
        if (device) {
            setFormData(device);
        }
    }, [device]);

    const applyPreset = (preset: (typeof BASE_PRESETS)[0]) => {
        const dummyPorts: Port[] = Array.from(
            { length: preset.ports },
            (_, i) => ({
                id: crypto.randomUUID(),
                name: `${preset.type.toUpperCase()}-P${i + 1}`,
                type: 'RJ45',
                deviceId: formData.id,
                status: 'up',
            }),
        );

        setFormData((prev) => ({
            ...prev,
            name: preset.name,
            type: preset.type as Device['type'],
            uHeight: preset.uHeight,
            ports: dummyPorts,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let result: { success: boolean; device?: Device; asset?: Device };
        if (mode === 'inventory') {
            result = await upsertInventoryFn({ data: formData as Device });
        } else {
            result = await upsertDevice({ data: formData as Device });
        }

        if (result.success) {
            const savedDevice = result.device || result.asset;
            if (savedDevice) onSave(savedDevice);
        }
    };

    const handleDelete = async () => {
        if (!device?.id) return;
        const msg =
            mode === 'inventory'
                ? 'Are you sure you want to delete this master blueprint? This will not affect existing rack instances.'
                : 'Are you sure you want to delete this asset from the rack?';

        if (confirm(msg)) {
            const result =
                mode === 'inventory'
                    ? await deleteInventoryAsset({ data: device.id })
                    : await deleteDevice({ data: device.id });

            if (result.success) {
                onDelete(device.id);
            }
        }
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]:
                name === 'uHeight' || name === 'uPosition'
                    ? Number(value)
                    : value,
        }));
    };

    const handleConnect = async (targetPortId: string) => {
        if (!isPatching) return;
        try {
            const result = await connectPorts({
                data: {
                    portAId: isPatching.id,
                    portBId: targetPortId,
                    type: 'copper',
                },
            });
            if (result.success) {
                onUpdateConnections();
                setIsPatching(null);
            }
        } catch (error) {
            console.error('Failed to connect:', error);
            alert('Failed to connect ports. They might already be occupied.');
        }
    };

    const handleDisconnect = async (connectionId: string) => {
        try {
            const result = await disconnectPorts({ data: connectionId });
            if (result.success) {
                onUpdateConnections();
            }
        } catch (error) {
            console.error('Failed to disconnect:', error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Template Selector Bar (Visual Preset Bar) */}
            {!device && (
                <div className="space-y-3">
                    <span className="text-[10px] font-bold text-(--sea-ink-soft) opacity-60 uppercase tracking-widest pl-1 leading-none">
                        Starting Point
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                        {BASE_PRESETS.map((preset) => (
                            <button
                                key={preset.name}
                                type="button"
                                onClick={() => applyPreset(preset)}
                                className={cn(
                                    'flex flex-col items-center justify-center p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 transition-all hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/10 dark:hover:border-white/20 active:scale-95 group',
                                    formData.type === preset.type &&
                                        'bg-(--sea-teal)/10 border-(--sea-teal)/40 text-(--sea-teal)',
                                )}
                            >
                                <preset.icon
                                    size={20}
                                    className={cn(
                                        'mb-2 opacity-40 group-hover:opacity-100 transition-opacity',
                                        formData.type === preset.type &&
                                            'opacity-100',
                                    )}
                                />
                                <span
                                    className={cn(
                                        'text-[9px] font-bold uppercase tracking-tight text-(--sea-ink-soft) opacity-60 group-hover:text-(--sea-ink) group-hover:opacity-100 transition-all',
                                        formData.type === preset.type &&
                                            'text-(--sea-teal)',
                                    )}
                                >
                                    {preset.type}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex bg-black/5 dark:bg-black/40 p-1 rounded-xl border border-black/10 dark:border-white/5">
                <button
                    type="button"
                    onClick={() => setActiveTab('info')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-bold transition-all',
                        activeTab === 'info'
                            ? 'bg-white shadow-sm dark:bg-white/10 text-(--sea-ink)'
                            : 'text-(--sea-ink-soft) opacity-60 hover:opacity-100',
                    )}
                >
                    <Info size={16} />{' '}
                    {mode === 'inventory' ? 'Design' : 'Asset Info'}
                </button>
                {mode !== 'inventory' && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('connections')}
                        disabled={!device}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-bold transition-all',
                            activeTab === 'connections'
                                ? 'bg-white shadow-sm dark:bg-white/10 text-(--sea-ink)'
                                : 'text-(--sea-ink-soft) opacity-60 hover:opacity-100',
                            !device && 'opacity-20 cursor-not-allowed',
                        )}
                    >
                        <Cable size={16} /> Connectivity
                    </button>
                )}
            </div>

            {activeTab === 'info' ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        {/* Basic Info */}
                        <div>
                            <label
                                htmlFor="name"
                                className="block text-sm font-bold text-(--sea-ink-soft) opacity-60 mb-1"
                            >
                                {mode === 'inventory'
                                    ? 'Blueprint Name'
                                    : 'Device Name'}
                            </label>
                            <input
                                required
                                id="name"
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 text-(--sea-ink) focus:outline-none focus:ring-2 focus:ring-(--sea-teal) placeholder:text-(--sea-ink-soft)/40"
                                placeholder={
                                    mode === 'inventory'
                                        ? 'e.g. Standard Web Server Tier A'
                                        : 'e.g. SF-WEB-01'
                                }
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label
                                    htmlFor="type"
                                    className="block text-sm font-bold text-(--sea-ink-soft) opacity-60 mb-1"
                                >
                                    Asset Class
                                </label>
                                <select
                                    id="type"
                                    name="type"
                                    value={formData.type}
                                    onChange={handleChange}
                                    className="w-full bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 text-(--sea-ink) focus:outline-none focus:ring-2 focus:ring-(--sea-teal) placeholder:text-(--sea-ink-soft)/40"
                                >
                                    <option value="server">Server</option>
                                    <option value="network">
                                        Network/Switch
                                    </option>
                                    <option value="storage">
                                        Storage Array
                                    </option>
                                </select>
                            </div>
                            <div>
                                <label
                                    htmlFor="uHeight"
                                    className="block text-sm font-bold text-(--sea-ink-soft) opacity-60 mb-1"
                                >
                                    Height (U Count)
                                </label>
                                <input
                                    required
                                    id="uHeight"
                                    type="number"
                                    min="1"
                                    max="10"
                                    name="uHeight"
                                    value={formData.uHeight}
                                    onChange={handleChange}
                                    className="w-full bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 text-(--sea-ink) focus:outline-none focus:ring-2 focus:ring-(--sea-teal) placeholder:text-(--sea-ink-soft)/40"
                                />
                            </div>
                        </div>

                        {mode === 'rack' && (
                            <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 space-y-4">
                                <h4 className="text-[10px] font-bold text-(--sea-ink-soft) opacity-60 uppercase tracking-widest flex items-center gap-2">
                                    <Layout size={12} /> Deployment Position
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label
                                            htmlFor="uPosition"
                                            className="block text-[10px] text-(--sea-ink-soft) opacity-60 mb-1"
                                        >
                                            Starting U
                                        </label>
                                        <input
                                            required
                                            id="uPosition"
                                            type="number"
                                            min="1"
                                            max="42"
                                            name="uPosition"
                                            value={formData.uPosition}
                                            onChange={handleChange}
                                            className="w-full bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 text-(--sea-ink) focus:outline-none focus:ring-2 focus:ring-(--sea-teal) placeholder:text-(--sea-ink-soft)/40"
                                        />
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="status"
                                            className="block text-[10px] text-(--sea-ink-soft) opacity-60 mb-1"
                                        >
                                            Operation Status
                                        </label>
                                        <select
                                            id="status"
                                            name="status"
                                            value={formData.status}
                                            onChange={handleChange}
                                            className="w-full bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 text-(--sea-ink) focus:outline-none focus:ring-2 focus:ring-(--sea-teal) placeholder:text-(--sea-ink-soft)/40"
                                        >
                                            <option value="active">
                                                Active
                                            </option>
                                            <option value="maintenance">
                                                Maintenance
                                            </option>
                                            <option value="storage">
                                                Storage
                                            </option>
                                            <option value="decommissioned">
                                                Decommissioned
                                            </option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        <hr className="border-white/5 my-4" />

                        {/* Metadata */}
                        <div>
                            <label
                                htmlFor="assetTag"
                                className="flex items-center gap-2 text-sm font-medium text-white/60 mb-1"
                            >
                                {mode === 'inventory'
                                    ? 'Master Asset Tag Prefix'
                                    : 'Asset Tag'}{' '}
                                <Info size={14} className="text-(--sea-teal)" />
                            </label>
                            <input
                                id="assetTag"
                                type="text"
                                name="assetTag"
                                value={formData.assetTag}
                                onChange={handleChange}
                                className="w-full bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 text-(--sea-ink) focus:outline-none focus:ring-2 focus:ring-(--sea-teal) placeholder:text-(--sea-ink-soft)/40"
                                placeholder="TAG-XXXXX"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label
                                    htmlFor="manufacturer"
                                    className="block text-sm font-medium text-white/60 mb-1"
                                >
                                    Manufacturer
                                </label>
                                <input
                                    id="manufacturer"
                                    type="text"
                                    name="manufacturer"
                                    value={formData.manufacturer || ''}
                                    onChange={handleChange}
                                    className="w-full bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 text-(--sea-ink) focus:outline-none focus:ring-2 focus:ring-(--sea-teal) placeholder:text-(--sea-ink-soft)/40"
                                    placeholder="Dell, HP, Cisco..."
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="model"
                                    className="block text-sm font-medium text-white/60 mb-1"
                                >
                                    Model
                                </label>
                                <input
                                    id="model"
                                    type="text"
                                    name="model"
                                    value={formData.model || ''}
                                    onChange={handleChange}
                                    className="w-full bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2 text-(--sea-ink) focus:outline-none focus:ring-2 focus:ring-(--sea-teal) placeholder:text-(--sea-ink-soft)/40"
                                    placeholder="PowerEdge, ProLiant..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-6 border-t border-zinc-200 dark:border-white/10">
                        <button
                            type="submit"
                            className={cn(
                                'w-full bg-(--sea-teal) hover:bg-(--sea-aqua) text-(--sea-ink) font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer',
                            )}
                        >
                            <Save size={18} />
                            {device
                                ? mode === 'inventory'
                                    ? 'Update Master'
                                    : 'Update Asset'
                                : mode === 'inventory'
                                  ? 'Add to Library'
                                  : 'Add Asset'}
                        </button>
                        {device && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="w-full bg-red-500/5 hover:bg-red-500/10 text-red-500/80 hover:text-red-500 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border border-red-500/10 hover:border-red-500/20 active:scale-[0.98] cursor-pointer"
                                title="Delete Asset"
                            >
                                <Trash2 size={16} />
                                <span className="text-xs uppercase tracking-wider">
                                    Delete Asset
                                </span>
                            </button>
                        )}
                    </div>
                </form>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 overflow-hidden">
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-(--sea-ink-soft) opacity-60 uppercase tracking-widest flex items-center gap-2">
                            Port Interface Preview
                        </h4>
                        <PortFaceplate
                            device={formData}
                            onPortClick={
                                mode === 'inventory'
                                    ? undefined
                                    : (p) =>
                                          setIsPatching(
                                              isPatching?.id === p.id
                                                  ? null
                                                  : p,
                                          )
                            }
                            activePortId={isPatching?.id}
                        />
                        {mode === 'inventory' && (
                            <p className="text-[10px] text-zinc-500 italic px-1">
                                Note: Connectivity is managed on live rack
                                instances, not blueprints.
                            </p>
                        )}
                    </div>

                    {mode === 'rack' && (
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-(--sea-ink-soft) opacity-60 uppercase tracking-widest">
                                Connect
                            </h4>
                            <div className="space-y-2">
                                {connections.map((conn) => {
                                    const isPortA = device?.ports.some(
                                        (p) => p.id === conn.portAId,
                                    );
                                    const localPort = device?.ports.find(
                                        (p) =>
                                            p.id ===
                                            (isPortA
                                                ? conn.portAId
                                                : conn.portBId),
                                    );
                                    const peerPortId = isPortA
                                        ? conn.portBId
                                        : conn.portAId;

                                    const peerDevice = allDevices.find((d) =>
                                        d.ports.some(
                                            (p) => p.id === peerPortId,
                                        ),
                                    );
                                    const peerPort = peerDevice?.ports.find(
                                        (p) => p.id === peerPortId,
                                    );

                                    return (
                                        <div
                                            key={conn.id}
                                            className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 group hover:border-white/10 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-md bg-(--sea-teal)/20 flex items-center justify-center text-(--sea-teal)">
                                                    <Zap size={14} />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-(--sea-ink)">
                                                        {localPort?.name} →{' '}
                                                        {peerDevice?.name}
                                                    </div>
                                                    <div className="text-[10px] text-(--sea-ink-soft) opacity-60">
                                                        {conn.type.toUpperCase()}{' '}
                                                        | {peerPort?.name}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleDisconnect(conn.id)
                                                }
                                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 text-red-500 rounded-md transition-all cursor-pointer"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    );
                                })}
                                {connections.length === 0 && (
                                    <div className="text-center py-6 rounded-lg border border-dashed border-black/10 dark:border-white/5">
                                        <p className="text-[10px] text-(--sea-ink-soft) opacity-40 font-medium">
                                            No active connections
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {isPatching && mode === 'rack' && (
                        <div className="p-4 bg-(--sea-teal)/10 rounded-xl border border-(--sea-teal)/20 space-y-3 animate-in fade-in slide-in-from-bottom-2">
                            <div className="text-[10px] font-bold text-(--sea-teal) uppercase tracking-wider flex items-center justify-between">
                                <span>PATCHING: {isPatching.name}</span>
                                <button
                                    type="button"
                                    onClick={() => setIsPatching(null)}
                                    className="text-(--sea-ink-soft) opacity-60 hover:text-(--sea-ink) hover:opacity-100 transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                            <div className="space-y-4 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                                {allDevices
                                    .filter((d) => d.id !== device?.id)
                                    .map((d) => (
                                        <div key={d.id} className="space-y-2">
                                            <div className="text-[9px] uppercase tracking-widest text-(--sea-ink-soft) opacity-40 font-bold border-b border-black/5 dark:border-white/5 pb-1">
                                                {d.name}
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {d.ports.map((p) => {
                                                    const isOccupied =
                                                        p.status === 'plugged';
                                                    return (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            disabled={
                                                                isOccupied
                                                            }
                                                            onClick={() =>
                                                                handleConnect(
                                                                    p.id,
                                                                )
                                                            }
                                                            className={cn(
                                                                'text-[9px] px-2 py-1 rounded border transition-all',
                                                                isOccupied
                                                                    ? 'bg-white/5 border-transparent text-white/10 cursor-not-allowed'
                                                                    : 'bg-black/20 border-white/10 hover:border-(--sea-teal) text-white/60 hover:text-white',
                                                            )}
                                                        >
                                                            {p.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
