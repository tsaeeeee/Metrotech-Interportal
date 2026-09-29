import { useServerFn } from '@tanstack/react-start';
import { Cable, Layout, Network, Save, Server, Trash2, Wind } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
    deleteDevice,
    deleteInventoryAsset,
    upsertDevice,
    upsertInventoryAsset,
} from '#/features/database/database-service';
import { createId } from '#/lib/id';
import { cn } from '#/lib/utils';
import type { AssetCategory, Device, OtherAssetKind } from '#/types/schema';
import {
    SERVER_CATALOG,
    getServerCatalogItem,
    inferServerRackHeight,
} from '../server-catalog';

interface AssetFormProps {
    mode?: 'inventory' | 'rack';
    device?: Device;
    rackId: string;
    onSave: (device: Device) => void;
    onDelete: (id: string) => void;
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

function createBlankAsset(rackId: string, mode: 'inventory' | 'rack'): Device {
    return {
        id: createId(),
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
        ports: [],
    };
}

export function AssetForm({
    mode = 'rack',
    device,
    rackId,
    onSave,
    onDelete,
}: AssetFormProps) {
    const upsertInventoryFn = useServerFn(upsertInventoryAsset);
    const upsertDeviceFn = useServerFn(upsertDevice);
    const deleteInventoryFn = useServerFn(deleteInventoryAsset);
    const deleteDeviceFn = useServerFn(deleteDevice);

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
            const equipmentType =
                device.equipmentType ?? device.model ?? '';

            setFormData({
                ...device,
                category: normalizedCategory,
                brand: device.brand ?? device.manufacturer ?? '',
                equipmentType,
                serialNumber: device.serialNumber ?? '',
                rackId: mode === 'rack' ? rackId : '',
                uHeight:
                    normalizedCategory === 'server'
                        ? inferServerRackHeight(
                              equipmentType,
                              device.uHeight || 1,
                          )
                        : device.uHeight,
                ports: [],
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
                        : inferServerRackHeight(prev.equipmentType, 1),
                brand: prev.category === 'other' ? '' : prev.brand || '',
                equipmentType:
                    prev.category === nextCategory
                        ? prev.equipmentType || ''
                        : '',
                serialNumber:
                    prev.category === 'other' ? '' : prev.serialNumber || '',
                ports: [],
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

    const handleServerTypeChange = (
        event: React.ChangeEvent<HTMLSelectElement>,
    ) => {
        const equipmentType = event.target.value;
        const catalogItem = getServerCatalogItem(equipmentType);

        setFormData((prev) => ({
            ...prev,
            equipmentType,
            uHeight: inferServerRackHeight(equipmentType, prev.uHeight),
            brand:
                catalogItem?.brandHint === 'Supermicro'
                    ? 'Supermicro'
                    : prev.brand,
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
                ports: [],
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

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
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
                        placeholder="e.g. Server A01"
                    />
                </div>

                {!isOther && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="brand" className="asset-label">
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
                                            : 'CIARA, Jabil, Supermicro...'
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
                                {category === 'server' ? (
                                    <select
                                        required
                                        id="equipmentType"
                                        name="equipmentType"
                                        value={formData.equipmentType || ''}
                                        onChange={handleServerTypeChange}
                                        className="asset-control"
                                    >
                                        <option value="">
                                            Select server type
                                        </option>
                                        {formData.equipmentType &&
                                            !getServerCatalogItem(
                                                formData.equipmentType,
                                            ) && (
                                                <option
                                                    value={
                                                        formData.equipmentType
                                                    }
                                                >
                                                    {formData.equipmentType}
                                                </option>
                                            )}
                                        {SERVER_CATALOG.map((serverType) => (
                                            <option
                                                key={serverType.value}
                                                value={serverType.value}
                                            >
                                                {serverType.label}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        required
                                        id="equipmentType"
                                        type="text"
                                        name="equipmentType"
                                        value={formData.equipmentType || ''}
                                        onChange={handleChange}
                                        className="asset-control"
                                        placeholder="QFX5120..."
                                    />
                                )}
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
                            <label htmlFor="uHeight" className="asset-label">
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
                            {category === 'server' && (
                                <p className="mt-1.5 text-[10px] text-(--sea-ink-soft)">
                                    Known server types set rack height
                                    automatically. Prefix 2x defaults to 2U.
                                </p>
                            )}
                        </div>
                    </>
                )}

                {mode === 'rack' && (
                    <div className="ops-subtle rounded-lg p-4">
                        <label htmlFor="uPosition" className="asset-label">
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
                            Occupancy and rack capacity are validated when the
                            asset is saved.
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
    );
}
