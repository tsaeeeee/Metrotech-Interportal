import { GripVertical, Edit3, Copy, Trash2, PlusCircle } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { DeviceFaceplate } from '../../racks/components/device-faceplate';
import type { Device } from '#/types/schema';

interface AssetTrayProps {
    inventory: Device[];
    onEditMaster: (asset: Device) => void;
    onDuplicateMaster: (id: string) => void;
    onDeleteMaster: (id: string) => void;
}

export function AssetTray({
    inventory,
    onEditMaster,
    onDuplicateMaster,
    onDeleteMaster,
}: AssetTrayProps) {
    return (
        <div className="island-shell rounded-2xl p-6 bg-white border border-zinc-100 shadow-sm min-h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                    Asset Library
                </h3>
                <span className="text-[10px] font-bold text-zinc-300 bg-zinc-50 px-2 py-0.5 rounded-full border border-zinc-100">
                    {inventory.length} Blueprints
                </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
                {inventory.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                        {inventory.map((asset) => (
                            <DraggableAsset
                                key={asset.id}
                                asset={asset}
                                onEdit={() => onEditMaster(asset)}
                                onDuplicate={() => onDuplicateMaster(asset.id)}
                                onDelete={() => onDeleteMaster(asset.id)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3 opacity-40">
                        <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-zinc-200 flex items-center justify-center text-zinc-300">
                            <PlusCircle size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-tight">
                                Library Empty
                            </p>
                            <p className="text-[10px] text-zinc-400 max-w-[140px] mt-1">
                                Design your first master asset to populate your
                                library.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <p className="text-[10px] text-zinc-400 mt-6 px-1 italic border-t border-zinc-50 pt-4">
                Drag Blueprints into the rack to provision new infrastructure.
            </p>
        </div>
    );
}

interface DraggableAssetProps {
    asset: Device;
    onEdit: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
}

function DraggableAsset({
    asset,
    onEdit,
    onDuplicate,
    onDelete,
}: DraggableAssetProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({
            id: asset.id,
            data: {
                type: 'master',
                device: asset,
            },
        });

    const style = {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 100 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group relative flex items-center gap-3 p-2.5 rounded-xl border transition-all ${isDragging ? 'ring-2 ring-emerald-500 shadow-xl opacity-50 z-50' : 'bg-white border-zinc-100 hover:border-zinc-300'}`}
        >
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing shrink-0"
            >
                <GripVertical
                    size={14}
                    className="text-zinc-300 group-hover:text-zinc-500 transition-colors"
                />
            </div>

            {/* Mini Faceplate Preview */}
            <div className="w-20 h-6 bg-zinc-900 rounded overflow-hidden shadow-inner border border-zinc-800 shrink-0">
                <DeviceFaceplate device={asset} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-zinc-700 leading-none truncate">
                        {asset.name}
                    </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-zinc-400 font-mono tracking-tighter shrink-0">
                        {asset.uHeight}U • {asset.type.toUpperCase()}
                    </span>
                </div>
            </div>

            {/* Quick Actions (only on non-dragging) */}
            {!isDragging && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur pl-2 absolute right-2">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit();
                        }}
                        className="p-1.5 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 rounded-lg transition-colors"
                        title="Edit Master"
                    >
                        <Edit3 size={11} />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDuplicate();
                        }}
                        className="p-1.5 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 rounded-lg transition-colors"
                        title="Duplicate"
                    >
                        <Copy size={11} />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="p-1.5 hover:bg-red-50 text-zinc-400 hover:text-red-500 rounded-lg transition-colors"
                        title="Remove"
                    >
                        <Trash2 size={11} />
                    </button>
                </div>
            )}
        </div>
    );
}
