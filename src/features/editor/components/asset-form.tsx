import { useServerFn } from '@tanstack/react-start';
import {
    Cable,
    Info,
    Layout,
    Network,
    Save,
    Server,
    Trash2,
    Wind,
    Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PortFaceplate } from '#/features/connectivity/components/port-faceplate';
import {
    connectPorts,
    deleteDevice,
    deleteInventoryAsset,
    disconnectPorts,
    upsertDevice,
    upsertInventoryAsset,
} from '#/features/database/database-service';
import { createId } from '#/lib/id';
import { cn } from '#/lib/utils';
import type {
    AssetCategory,
    Connection,
    Device,
    OtherAssetKind,
    Port,
} from '#/types/schema';

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

type OtherPreset = {
    key: string;
    name: string;
    kind: OtherAssetKind;
    uHeight: number;
    type: Device['type'];
    icon: typeof Cable;
};

const OTHER_PRESETS: OtherPreset[] = [
    {
        key: 'cable-management-1u',
        name: 'Cable Management 1U',
        kind: 'cable-management',
        uHeight: 1,
        type: 'cable',
        icon: Cable,
    },
    {
        key: 'blanking-panel-1u',
        name: 'Blanking Panel 1U',
        kind: 'blanking-panel',
        uHeight: 1,
        type: 'panel',
        icon: Layout,
    },
    {
        key: 'blanking-panel-2u',
        name: 'Blanking Panel 2U',
        kind: 'blanking-panel',
        uHeight: 2,
        type: 'panel',
        icon: Layout,
    },
    {
        key: 'blanking-panel-10u',
        name: 'Blanking Panel 10U',
        kind: 'blanking-panel',
        uHeight: 10,
        type: 'panel',
        icon: Layout,
    },
    {
        key: 'blanking-panel-12u',
        name: 'Blanking Panel 12U',
        kind: 'blanking-panel',
        uHeight: 12,
        type: 'panel',
        icon: Layout,
    },
    {
        key: 'geist-switchair-1u',
        name: 'Vertiv Geist SwitchAir 1U',
        kind: 'geist-switchair',
        uHeight: 1,
        type: 'airflow',
        icon: Wind,
    },
    {
        key: 'geist-switchair-2u',
        name: 'Vertiv Geist SwitchAir 2U',
        kind: 'geist-switchair',
        uHeight: 2,
        type: 'airflow',
        icon: Wind,
    },
];

function deriveCategory(device?: Device): AssetCategory {
    if (device?.category) return device.category;
    if (device?.type === 'network') return 'switch';
    if (device?.type === 'server') return 'server';
    return 'other';
}

function makePorts(
    deviceId: string,
    category: AssetCategory,
    existing: Port[] = [],
): Port[] {
    if (existing.length > 0) return existing;
    if (category === 'other') return [];

    const count = category === 'switch' ? 24 : 8;
    return Array.from({ length: count }, (_, index) => ({
        id: createId(),
        name: `${category === 'switch' ? 'SW' : 'SRV'}-P${index + 1}`,
        type: 'RJ45',
        deviceId,
        status: 'up',
    }));
}

function createBlankAsset(rackId: string, mode: 'inventory' | 'rack'): Device {
    const id = createId();
    return {
        id,
        name: '',
        rackId: mode === 'rack' ? rackId : '',
        uHeight: 1,
        uPosition: 1,
        type: 'network',
        depth: 'full',
        category: 'switch',
        brand: '',
        equipmentType: '',
        serialNumber: '',
        status: 'active',
        ports: makePorts(id, 'switch'),
    };
}

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
    const upsertDeviceFn = useServerFn(upsertDevice);
    const deleteInventoryFn = useServerFn(deleteInventoryAsset);
    const deleteDeviceFn = useServerFn(deleteDevice);
    const connectPortsFn = useServerFn(connectPorts);
    const disconnectPortsFn = useServerFn(disconnectPorts);

    const [activeTab, setActiveTab] = useState<'info' | 'connections'>('info');
    const [isPatching, setIsPatching] = useState<Port | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState<Device>(() =>
        createBlankAsset(rackId, mode),
    );

    const category = deriveCategory(formData);
    const isOther = category === 'other';

    const activeOtherPreset = useMemo(
        () =>
            OTHER_PRESETS.find(
                (preset) =>
                    preset.kind === formData.otherKind &&
                    preset.uHeight === formData.uHeight,
            ),
        [formData.otherKind, formData.uHeight],
    );

    useEffect(() => {
        if (device) {
            const normalizedCategory = deriveCategory(device);
            setFormData({
                ...device,
                category: normalizedCategory,
                brand: device.brand ?? device.manufacturer ?? '',
                equipmentType: device.equipmentType ?? device.model ?? '',
                serialNumber: device.serialNumber ?? '',
                rackId: mode === 'rack' ? rackId : '',
                ports: makePorts(
                    device.id,
                    normalizedCategory,
                    device.ports || [],
                ),
            });
            return;
        }

        setFormData(createBlankAsset(rackId, mode));
    }, [device, mode, rackId]);

    const selectCategory = (nextCategory: AssetCategory) => {
        setError('');
        setFormData((prev) => {
            if (nextCategory === 'other') {
                const preset = OTHER_PRESETS[0];
                return {
                    ...prev,
                    category: 'other',
                    name: preset.name,
                    type: preset.type,
                    otherKind: preset.kind,
                    uHeight: preset.uHeight,
                    brand: undefined,
                    equipmentType: undefined,
                    serialNumber: undefined,
                    assetTag: undefined,
                    manufacturer: undefined,
                    model: undefined,
                    ports: [],
                };
            }

            return {
                ...prev,
                category: nextCategory,
                type: nextCategory === 'switch' ? 'network' : 'server',
                otherKind: undefined,
                uHeight:
                    nextCategory === 'switch'
                        ? 1
                        : prev.category === 'server'
                          ? prev.uHeight
                          : 2,
                brand: prev.category === 'other' ? '' : prev.brand || '',
                equipmentType:
                    prev.category === 'other' ? '' : prev.equipmentType || '',
                serialNumber:
                    prev.category === 'other' ? '' : prev.serialNumber || '',
                ports: makePorts(
                    prev.id,
                    nextCategory,
                    prev.category === nextCategory ? prev.ports || [] : [],
                ),
            };
        });
    };

    const selectOtherPreset = (preset: OtherPreset) => {
        setFormData((prev) => ({
            ...prev,
            category: 'other',
            name: preset.name,
            type: preset.type,
            otherKind: preset.kind,
            uHeight: preset.uHeight,
            brand: undefined,
            equipmentType: undefined,
            serialNumber: undefined,
            assetTag: undefined,
            manufacturer: undefined,
            model: undefined,
            ports: [],
        }));
    };

    const handleChange = (
        event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
        const { name, value } = event.target;
        setFormData((prev) => ({
            ...prev,
            [name]:
                name === 'uHeight' || name === 'uPosition'
                    ? Number(value)
                    : value,
        }));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setSaving(true);

        try {
            if (mode === 'rack' && !rackId) {
                throw new Error('Select a rack before adding an asset.');
            }

            if (!formData.name.trim()) {
                throw new Error('Asset name is required.');
            }

            if (!isOther) {
                if (!formData.brand?.trim()) {
                    throw new Error('Brand is required.');
                }
                if (!formData.equipmentType?.trim()) {
                    throw new Error('Type is required.');
                }
                if (!formData.serialNumber?.trim()) {
                    throw new Error('Serial number is required.');
                }
            }

            const payload: Device = {
                ...formData,
                name: formData.name.trim(),
                rackId: mode === 'rack' ? rackId : '',
                category,
                brand: isOther ? undefined : formData.brand?.trim(),
                equipmentType: isOther
                    ? undefined
                    : formData.equipmentType?.trim(),
                serialNumber: isOther
                    ? undefined
                    : formData.serialNumber?.trim(),
                otherKind: isOther ? formData.otherKind : undefined,
                assetTag: undefined,
                manufacturer: undefined,
                model: undefined,
                status: 'active',
                ports: isOther
                    ? []
                    : makePorts(formData.id, category, formData.ports),
            };

            const result =
                mode === 'inventory'
                    ? await upsertInventoryFn({ data: payload })
                    : await upsertDeviceFn({ data: payload });

            if (result.success && result.device) {
                onSave(result.device);
            }
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Failed to save asset',
            );
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!device?.id) return;

        const message =
            mode === 'inventory'
                ? 'Delete this asset from the library? Existing rack assets will stay in place.'
                : 'Delete this asset from the rack?';

        if (!confirm(message)) return;

        const result =
            mode === 'inventory'
                ? await deleteInventoryFn({ data: device.id })
                : await deleteDeviceFn({ data: device.id });

        if (result.success) onDelete(device.id);
    };

    const handleConnect = async (targetPortId: string) => {
        if (!isPatching) return;

        try {
            const result = await connectPortsFn({
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
        } catch (connectionError) {
            console.error('Failed to connect:', connectionError);
            alert('Failed to connect ports. They might already be occupied.');
        }
    };

    const handleDisconnect = async (connectionId: string) => {
        try {
            const result = await disconnectPortsFn({ data: connectionId });
            if (result.success) onUpdateConnections();
        } catch (connectionError) {
            console.error('Failed to disconnect:', connectionError);
        }
    };

    return (
        <div className="space-y-5">
            <div className="space-y-2">
                <span className="asset-section-label">Asset Category</span>
                <div className="grid grid-cols-3 gap-2">
                    {[
                        {
                            value: 'switch' as const,
                            label: 'Switch',
                            icon: Network,
                        },
                        {
                            value: 'server' as const,
                            label: 'Server',
                            icon: Server,
                        },
                        {
                            value: 'other' as const,
                            label: 'Others',
                            icon: Layout,
                        },
                    ].map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => selectCategory(item.value)}
                            className={cn(
                                'asset-choice',
                                category === item.value &&
                                    'asset-choice-active',
                            )}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {isOther && (
                <div className="space-y-2">
                    <span className="asset-section-label">Component</span>
                    <div className="grid grid-cols-2 gap-2">
                        {OTHER_PRESETS.map((preset) => (
                            <button
                                key={preset.key}
                                type="button"
                                onClick={() => selectOtherPreset(preset)}
                                className={cn(
                                    'asset-other-choice',
                                    activeOtherPreset?.key === preset.key &&
                                        'asset-other-choice-active',
                                )}
                            >
                                <preset.icon size={16} />
                                <div className="min-w-0 text-left">
                                    <div className="font-bold truncate">
                                        {preset.name}
                                    </div>
                                    <div className="text-[10px] opacity-65">
                                        {preset.uHeight}U
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex bg-(--surface-muted) p-1 rounded-lg border border-(--line)">
                <button
                    type="button"
                    onClick={() => setActiveTab('info')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-bold transition-all',
                        activeTab === 'info'
                            ? 'bg-(--surface-strong) text-(--sea-ink) shadow-sm'
                            : 'text-(--sea-ink-soft) hover:text-(--sea-ink)',
                    )}
                >
                    <Info size={15} /> Asset Info
                </button>
                {mode === 'rack' && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('connections')}
                        disabled={!device || isOther}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-bold transition-all',
                            activeTab === 'connections'
                                ? 'bg-(--surface-strong) text-(--sea-ink) shadow-sm'
                                : 'text-(--sea-ink-soft) hover:text-(--sea-ink)',
                            (!device || isOther) &&
                                'opacity-35 cursor-not-allowed',
                        )}
                    >
                        <Cable size={15} /> Connectivity
                    </button>
                )}
            </div>

            {activeTab === 'info' ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="name" className="asset-label">
                                Asset Name
                            </label>
                            <input
                                required
                                id="name"
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                readOnly={isOther}
                                className={cn(
                                    'asset-control',
                                    isOther && 'asset-control-readonly',
                                )}
                                placeholder="e.g. Core Switch A"
                            />
                        </div>

                        {!isOther && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label
                                            htmlFor="brand"
                                            className="asset-label"
                                        >
                                            Brand
                                        </label>
                                        <input
                                            required
                                            id="brand"
                                            type="text"
                                            name="brand"
                                            value={formData.brand || ''}
                                            onChange={handleChange}
                                            className="asset-control"
                                            placeholder={
                                                category === 'switch'
                                                    ? 'Cisco, Juniper...'
                                                    : 'Dell, HPE...'
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="equipmentType"
                                            className="asset-label"
                                        >
                                            Type
                                        </label>
                                        <input
                                            required
                                            id="equipmentType"
                                            type="text"
                                            name="equipmentType"
                                            value={
                                                formData.equipmentType || ''
                                            }
                                            onChange={handleChange}
                                            className="asset-control"
                                            placeholder={
                                                category === 'switch'
                                                    ? 'QFX5120...'
                                                    : 'PowerEdge R760...'
                                            }
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label
                                        htmlFor="serialNumber"
                                        className="asset-label"
                                    >
                                        Serial Number
                                    </label>
                                    <input
                                        required
                                        id="serialNumber"
                                        type="text"
                                        name="serialNumber"
                                        value={formData.serialNumber || ''}
                                        onChange={handleChange}
                                        className="asset-control font-mono"
                                        placeholder="Serial number"
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="uHeight"
                                        className="asset-label"
                                    >
                                        Rack Height
                                    </label>
                                    <div className="relative">
                                        <input
                                            required
                                            id="uHeight"
                                            type="number"
                                            min="1"
                                            max="12"
                                            name="uHeight"
                                            value={formData.uHeight}
                                            onChange={handleChange}
                                            className="asset-control pr-12"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-(--sea-ink-soft)">
                                            U
                                        </span>
                                    </div>
                                </div>
                            </>
                        )}

                        {mode === 'rack' && (
                            <div className="ops-subtle rounded-lg p-4">
                                <label
                                    htmlFor="uPosition"
                                    className="asset-label"
                                >
                                    Starting U
                                </label>
                                <input
                                    required
                                    id="uPosition"
                                    type="number"
                                    min="1"
                                    max="52"
                                    name="uPosition"
                                    value={formData.uPosition}
                                    onChange={handleChange}
                                    className="asset-control"
                                />
                                <p className="mt-2 text-[11px] text-(--sea-ink-soft)">
                                    Occupancy and rack capacity are validated
                                    when the asset is saved.
                                </p>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-300 text-sm font-semibold">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-2 pt-4 border-t border-(--line)">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-(--sea-teal) hover:bg-(--sea-aqua) text-white dark:text-[#071312] font-extrabold py-3 px-4 rounded-lg flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60"
                        >
                            <Save size={17} />
                            {saving
                                ? 'Saving...'
                                : device
                                  ? 'Update Asset'
                                  : mode === 'inventory'
                                    ? 'Add to Library'
                                    : 'Add Asset'}
                        </button>

                        {device && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="w-full text-red-600 dark:text-red-300 hover:bg-red-500/10 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 border border-red-500/20"
                            >
                                <Trash2 size={15} />
                                Delete Asset
                            </button>
                        )}
                    </div>
                </form>
            ) : (
                <div className="space-y-5">
                    <div className="space-y-3">
                        <span className="asset-section-label">
                            Port Interface
                        </span>
                        <PortFaceplate
                            device={formData}
                            onPortClick={(port) =>
                                setIsPatching(
                                    isPatching?.id === port.id ? null : port,
                                )
                            }
                            activePortId={isPatching?.id}
                        />
                    </div>

                    <div className="space-y-2">
                        <span className="asset-section-label">
                            Connections
                        </span>
                        {connections.length === 0 ? (
                            <div className="text-center py-6 rounded-lg border border-dashed border-(--line) text-xs text-(--sea-ink-soft)">
                                No active connections
                            </div>
                        ) : (
                            connections.map((connection) => {
                                const isPortA = device?.ports.some(
                                    (port) =>
                                        port.id === connection.portAId,
                                );
                                const localPort = device?.ports.find(
                                    (port) =>
                                        port.id ===
                                        (isPortA
                                            ? connection.portAId
                                            : connection.portBId),
                                );
                                const peerPortId = isPortA
                                    ? connection.portBId
                                    : connection.portAId;
                                const peerDevice = allDevices.find((candidate) =>
                                    candidate.ports.some(
                                        (port) => port.id === peerPortId,
                                    ),
                                );
                                const peerPort = peerDevice?.ports.find(
                                    (port) => port.id === peerPortId,
                                );

                                return (
                                    <div
                                        key={connection.id}
                                        className="flex items-center justify-between p-3 rounded-lg border border-(--line) bg-(--surface-muted)"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-md bg-(--sea-teal)/12 flex items-center justify-center text-(--sea-teal)">
                                                <Zap size={14} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-(--sea-ink) truncate">
                                                    {localPort?.name} →{' '}
                                                    {peerDevice?.name}
                                                </div>
                                                <div className="text-[10px] text-(--sea-ink-soft)">
                                                    {connection.type.toUpperCase()}{' '}
                                                    · {peerPort?.name}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleDisconnect(connection.id)
                                            }
                                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-md"
                                            aria-label="Disconnect port"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {isPatching && (
                        <div className="p-4 bg-(--sea-teal)/10 rounded-lg border border-(--sea-teal)/25 space-y-3">
                            <div className="text-[10px] font-bold text-(--sea-teal) uppercase tracking-wider flex items-center justify-between">
                                <span>Patching: {isPatching.name}</span>
                                <button
                                    type="button"
                                    onClick={() => setIsPatching(null)}
                                    className="text-(--sea-ink-soft) hover:text-(--sea-ink)"
                                >
                                    Cancel
                                </button>
                            </div>
                            <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                                {allDevices
                                    .filter(
                                        (candidate) =>
                                            candidate.id !== device?.id,
                                    )
                                    .map((candidate) => (
                                        <div
                                            key={candidate.id}
                                            className="space-y-2"
                                        >
                                            <div className="text-[10px] uppercase tracking-wider text-(--sea-ink-soft) font-bold border-b border-(--line) pb-1">
                                                {candidate.name}
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {candidate.ports.map((port) => {
                                                    const occupied =
                                                        port.status ===
                                                        'plugged';
                                                    return (
                                                        <button
                                                            key={port.id}
                                                            type="button"
                                                            disabled={occupied}
                                                            onClick={() =>
                                                                handleConnect(
                                                                    port.id,
                                                                )
                                                            }
                                                            className={cn(
                                                                'text-[10px] px-2 py-1 rounded border',
                                                                occupied
                                                                    ? 'bg-(--surface-muted) border-(--line) text-(--sea-ink-soft) opacity-35'
                                                                    : 'bg-(--surface) border-(--line-strong) text-(--sea-ink) hover:border-(--sea-teal)',
                                                            )}
                                                        >
                                                            {port.name}
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
