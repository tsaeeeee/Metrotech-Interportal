import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Box,
    Check,
    GripVertical,
    Map as MapIcon,
    Pencil,
    Plus,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '#/lib/utils';
import type { Floor, Room, Rack } from '#/types/schema';

interface InfrastructureNavigatorProps {
    hierarchy: {
        floors: Floor[];
        rooms: Room[];
        racks: Rack[];
    } | null;
    viewMode: 'room' | 'rack';
    currentRoomId?: string;
    currentRackId?: string;
    onLoadRoom: (id: string) => void;
    onLoadRack: (id: string) => void;
    onAddRoom: () => void;
    onAddRack: () => void;
    onUpdateRoom: (id: string, name: string) => Promise<void>;
    onDeleteRoom: (id: string) => Promise<void>;
    onUpdateRack: (id: string, name: string) => Promise<void>;
    onDeleteRack: (id: string) => Promise<void>;
    onReorder: (
        type: 'room' | 'rack',
        orders: { id: string; order: number }[],
    ) => Promise<void>;
}

export function InfrastructureNavigator({
    hierarchy,
    viewMode,
    currentRoomId,
    currentRackId,
    onLoadRoom,
    onLoadRack,
    onAddRoom,
    onAddRack,
    onUpdateRoom,
    onDeleteRoom,
    onUpdateRack,
    onDeleteRack,
    onReorder,
}: InfrastructureNavigatorProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const [editingId, setEditingId] = useState<string | null>(null);

    const handleSortEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !hierarchy) return;

        const activeId = active.id.toString();
        const overId = over.id.toString();

        const isRoom = hierarchy.rooms.some((r) => r.id === activeId);
        const isRack = hierarchy.racks.some((r) => r.id === activeId);

        if (isRoom) {
            // Reordering Rooms
            const oldIndex = hierarchy.rooms.findIndex((r) => r.id === activeId);
            const newIndex = hierarchy.rooms.findIndex((r) => r.id === overId);
            if (oldIndex === -1 || newIndex === -1) return;

            const newRooms = arrayMove(hierarchy.rooms, oldIndex, newIndex);
            const orders = newRooms.map((r, i) => ({
                id: r.id,
                order: i + 1,
            }));
            await onReorder('room', orders);
        } else if (isRack) {
            // Reordering Racks (within same room)
            const activeRack = hierarchy.racks.find((r) => r.id === activeId);
            const overRack = hierarchy.racks.find((r) => r.id === overId);
            if (
                !activeRack ||
                !overRack ||
                activeRack.roomId !== overRack.roomId
            )
                return;

            const roomRacks = hierarchy.racks.filter(
                (r) => r.roomId === activeRack.roomId,
            );
            const oldIndex = roomRacks.findIndex((r) => r.id === activeId);
            const newIndex = roomRacks.findIndex((r) => r.id === overId);

            const newTotalRacks = arrayMove(roomRacks, oldIndex, newIndex);
            const orders = newTotalRacks.map((r, i) => ({
                id: r.id,
                order: i + 1,
            }));
            await onReorder('rack', orders);
        }
    };

    const startEditing = (id: string) => {
        setEditingId(id);
    };

    const handleSave = async (
        id: string,
        newName: string,
        type: 'room' | 'rack',
    ) => {
        if (type === 'room') {
            await onUpdateRoom(id, newName);
        } else {
            await onUpdateRack(id, newName);
        }
        setEditingId(null);
    };

    if (!hierarchy) return null;

    return (
        <aside className="island-shell bg-white/90 backdrop-blur-md border border-zinc-100 rounded-3xl p-6 sticky top-[76px] z-10 max-h-[calc(100vh-92px)] overflow-y-auto custom-scrollbar shadow-sm">
            <div className="flex items-center justify-between mb-6 px-1">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        Infrastructure
                    </span>
                </div>
                <button
                    onClick={onAddRoom}
                    className="p-1.5 hover:bg-black/5 dark:hover:bg-zinc-800 rounded-lg text-(--sea-ink-soft) hover:text-(--sea-ink) transition-all cursor-pointer"
                    title="Add Room"
                >
                    <Plus size={14} />
                </button>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleSortEnd}
            >
                <div className="space-y-6">
                    {hierarchy.floors.map((floor) => (
                        <div key={floor.id} className="space-y-4">
                            <div className="flex items-center gap-2 px-1 text-zinc-500 dark:text-zinc-400 font-bold text-[10px] uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-2">
                                <span>{floor.name}</span>
                            </div>

                            <SortableContext
                                items={hierarchy.rooms.filter(r => r.floorId === floor.id).map((r) => r.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-2">
                                    {hierarchy.rooms
                                        .filter((r) => r.floorId === floor.id)
                                        .map((room) => {
                                            const rackCount =
                                                hierarchy.racks.filter(
                                                    (r) =>
                                                        r.roomId === room.id,
                                                ).length;
                                            return (
                                                <SortableNavigatorItem
                                                    key={room.id}
                                                    id={room.id}
                                                    name={room.name}
                                                    type="room"
                                                    stats={`${rackCount} Racks`}
                                                    isActive={
                                                        viewMode === 'room' &&
                                                        currentRoomId ===
                                                            room.id
                                                    }
                                                    isEditing={
                                                        editingId === room.id
                                                    }
                                                    onSelect={() =>
                                                        onLoadRoom(room.id)
                                                    }
                                                    onEdit={() =>
                                                        startEditing(room.id)
                                                    }
                                                    onSave={(newName) =>
                                                        handleSave(
                                                            room.id,
                                                            newName,
                                                            'room',
                                                        )
                                                    }
                                                    onCancel={() =>
                                                        setEditingId(null)
                                                    }
                                                    onDelete={() =>
                                                        onDeleteRoom(room.id)
                                                    }
                                                >
                                                    {/* Nested Racks */}
                                                    <div className="ml-4 pl-4 border-l border-zinc-200/50 space-y-1 mt-1">
                                                        <SortableContext
                                                            items={hierarchy.racks
                                                                .filter(
                                                                    (r) =>
                                                                        r.roomId ===
                                                                        room.id,
                                                                )
                                                                .map(
                                                                    (r) => r.id,
                                                                )}
                                                            strategy={
                                                                verticalListSortingStrategy
                                                            }
                                                        >
                                                            {hierarchy.racks
                                                                .filter(
                                                                    (r) =>
                                                                        r.roomId ===
                                                                        room.id,
                                                                )
                                                                .map((rack) => (
                                                                    <SortableNavigatorItem
                                                                        key={
                                                                            rack.id
                                                                        }
                                                                        id={
                                                                            rack.id
                                                                        }
                                                                        name={
                                                                            rack.name
                                                                        }
                                                                        type="rack"
                                                                        stats={`${rack.uCapacity || 42}U`}
                                                                        isActive={
                                                                            viewMode ===
                                                                                'rack' &&
                                                                            currentRackId ===
                                                                                rack.id
                                                                        }
                                                                        isEditing={
                                                                            editingId ===
                                                                            rack.id
                                                                        }
                                                                        onSelect={() =>
                                                                            onLoadRack(
                                                                                rack.id,
                                                                            )
                                                                        }
                                                                        onEdit={() =>
                                                                            startEditing(
                                                                                rack.id,
                                                                            )
                                                                        }
                                                                        onSave={(
                                                                            newName,
                                                                        ) =>
                                                                            handleSave(
                                                                                rack.id,
                                                                                newName,
                                                                                'rack',
                                                                            )
                                                                        }
                                                                        onCancel={() =>
                                                                            setEditingId(
                                                                                null,
                                                                            )
                                                                        }
                                                                        onDelete={() =>
                                                                            onDeleteRack(
                                                                                rack.id,
                                                                            )
                                                                        }
                                                                    />
                                                                ))}
                                                        </SortableContext>
                                                        <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-300">
                                                            <div className="overflow-hidden">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (
                                                                            viewMode !==
                                                                                'room' ||
                                                                            currentRoomId !==
                                                                                room.id
                                                                        )
                                                                            onLoadRoom(
                                                                                room.id,
                                                                            );
                                                                        onAddRack();
                                                                    }}
                                                                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-tight text-(--sea-ink-soft) hover:text-(--sea-ink) hover:bg-black/5 dark:hover:bg-zinc-800 transition-all cursor-pointer mt-1"
                                                                >
                                                                    <Plus size={10} />
                                                                    Add Rack
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </SortableNavigatorItem>
                                            );
                                        })}
                                </div>
                            </SortableContext>
                        </div>
                    ))}
                </div>
            </DndContext>
        </aside>
    );
}

interface SortableNavigatorItemProps {
    id: string;
    name: string;
    type: 'room' | 'rack';
    isActive: boolean;
    isEditing: boolean;
    onSelect: () => void;
    onEdit: () => void;
    onSave: (newName: string) => Promise<void>;
    onCancel: () => void;
    onDelete: () => void;
    stats?: string;
    children?: React.ReactNode;
}

function SortableNavigatorItem({
    id,
    name,
    type,
    isActive,
    isEditing,
    onSelect,
    onEdit,
    onSave,
    onCancel,
    onDelete,
    stats,
    children,
}: SortableNavigatorItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const [localName, setLocalName] = useState(name);
    const [isDeleting, setIsDeleting] = useState(false);

    // Sync local name when editing starts
    useEffect(() => {
        if (isEditing) setLocalName(name);
    }, [isEditing, name]);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
    };

    const handleSave = () => {
        if (localName.trim() && localName.trim() !== name) {
            onSave(localName.trim());
        } else {
            onCancel();
        }
    };

    const Icon = type === 'room' ? MapIcon : Box;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'group select-none relative',
                isDragging && 'opacity-50 z-50',
            )}
        >
            <div
                onClick={onSelect}
                className={cn(
                    'flex items-center gap-2 px-2 py-2 rounded-xl transition-all cursor-pointer group',
                    isActive
                        ? type === 'room'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20 font-bold'
                            : 'bg-teal-700 text-white shadow-sm font-bold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200',
                    isDeleting && 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/50',
                    type === 'room' ? 'mt-2' : 'mt-0',
                )}
            >
                {/* Drag Handle */}
                {!isEditing && !isDeleting && (
                    <div
                        {...attributes}
                        {...listeners}
                        className={cn(
                            'p-1 cursor-grab active:cursor-grabbing rounded hover:bg-black/5 transition-colors',
                            isActive
                                ? 'text-white/40 hover:text-white'
                                : 'text-zinc-400 group-hover:text-zinc-500',
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GripVertical size={14} />
                    </div>
                )}

                <div className="flex-1 flex items-center gap-2 min-w-0">
                    <Icon
                        size={type === 'room' ? 14 : 12}
                        className={cn(
                            'shrink-0',
                            isActive ? 'opacity-100' : 'opacity-70',
                        )}
                    />

                    {isEditing ? (
                        <input
                            autoFocus
                            value={localName}
                            onChange={(e) => setLocalName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave();
                                if (e.key === 'Escape') onCancel();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 bg-white/20 border-white/40 outline-none text-inherit px-1 rounded font-bold placeholder:text-white/50"
                        />
                    ) : (
                        <div className="flex items-center gap-2">
                            <span
                                className={cn(
                                    'truncate',
                                    type === 'room'
                                        ? 'text-sm'
                                        : 'text-xs',
                                )}
                            >
                                {isDeleting ? 'Delete?' : name}
                            </span>
                            {stats && !isDeleting && (
                                <span
                                    className={cn(
                                        'text-[10px] font-bold px-1.5 py-0.5 rounded-md text-nowrap',
                                        isActive
                                            ? 'bg-white/20 text-white'
                                            : 'bg-black/5 text-zinc-500',
                                    )}
                                >
                                    {stats}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                    {isEditing ? (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSave();
                                }}
                                className="p-1 hover:bg-black/10 rounded transition-colors"
                            >
                                <Check size={12} className="cursor-pointer" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCancel();
                                }}
                                className="p-1 hover:bg-black/10 rounded transition-colors"
                            >
                                <X size={12} className="cursor-pointer" />
                            </button>
                        </>
                    ) : isDeleting ? (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                    setIsDeleting(false);
                                }}
                                className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-md hover:bg-red-600 transition-colors shadow-sm"
                            >
                                YES
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsDeleting(false);
                                }}
                                className="p-1 hover:bg-black/10 rounded transition-colors"
                            >
                                <X size={12} className="cursor-pointer" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit();
                                }}
                                className="p-1 hover:bg-black/10 rounded transition-colors"
                                title="Rename"
                            >
                                <Pencil size={12} className="cursor-pointer" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsDeleting(true);
                                }}
                                className="p-1 hover:bg-black/10 hover:text-red-400 rounded transition-colors"
                                title="Delete"
                            >
                                <Trash2 size={12} className="cursor-pointer" />
                            </button>
                        </>
                    )}
                </div>
            </div>
            {children}
        </div>
    );
}
