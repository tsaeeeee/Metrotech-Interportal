import { randomUUID } from 'node:crypto';
import { createServerFn } from '@tanstack/react-start';
import type {
    AssetStatus,
    Connection,
    Database,
    Device,
    DeviceType,
    Floor,
    Port,
    PortStatus,
    PortType,
    Rack,
    Room,
} from '#/types/schema';
import { getSession } from '../auth/auth-service';
import { getDb } from '../auth/sqlite';

type RoomRow = {
    id: string;
    name: string;
    floor_id: string;
    width: number;
    height: number;
    sort_order: number;
};

type RackRow = {
    id: string;
    name: string;
    room_id: string;
    u_capacity: number;
    x: number;
    y: number;
    sort_order: number;
};

type DeviceRow = {
    id: string;
    name: string;
    rack_id: string;
    u_height: number;
    u_position: number;
    type: DeviceType;
    depth: Device['depth'];
    asset_tag: string | null;
    serial_number: string | null;
    model: string | null;
    manufacturer: string | null;
    status: AssetStatus;
};

type InventoryRow = Omit<DeviceRow, 'rack_id' | 'u_position'>;

type PortRow = {
    id: string;
    name: string;
    type: PortType;
    device_id: string;
    status: PortStatus;
};

type InventoryPortRow = Omit<PortRow, 'device_id'> & {
    asset_id: string;
};

type ConnectionRow = {
    id: string;
    port_a_id: string;
    port_b_id: string;
    type: Connection['type'];
    color: string | null;
    status: Connection['status'];
};

async function requireAuth() {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');
    return session;
}

function toRoom(row: RoomRow): Room {
    return {
        id: row.id,
        name: row.name,
        floorId: row.floor_id,
        width: row.width,
        height: row.height,
        order: row.sort_order,
    };
}

function toRack(row: RackRow, deviceIds: string[] = []): Rack {
    return {
        id: row.id,
        name: row.name,
        roomId: row.room_id,
        uCapacity: row.u_capacity,
        devices: deviceIds,
        x: row.x,
        y: row.y,
        order: row.sort_order,
    };
}

function toPort(row: PortRow): Port {
    return {
        id: row.id,
        name: row.name,
        type: row.type,
        deviceId: row.device_id,
        status: row.status,
    };
}

function toDevice(row: DeviceRow, ports: Port[] = []): Device {
    return {
        id: row.id,
        name: row.name,
        rackId: row.rack_id,
        uHeight: row.u_height,
        uPosition: row.u_position,
        type: row.type,
        depth: row.depth,
        assetTag: row.asset_tag || undefined,
        serialNumber: row.serial_number || undefined,
        model: row.model || undefined,
        manufacturer: row.manufacturer || undefined,
        status: row.status,
        ports,
    };
}

function toInventoryDevice(row: InventoryRow, ports: Port[] = []): Device {
    return {
        id: row.id,
        name: row.name,
        rackId: '',
        uHeight: row.u_height,
        uPosition: 1,
        type: row.type,
        depth: row.depth,
        assetTag: row.asset_tag || undefined,
        serialNumber: row.serial_number || undefined,
        model: row.model || undefined,
        manufacturer: row.manufacturer || undefined,
        status: row.status,
        ports,
    };
}

function toConnection(row: ConnectionRow): Connection {
    return {
        id: row.id,
        portAId: row.port_a_id,
        portBId: row.port_b_id,
        type: row.type,
        color: row.color || undefined,
        status: row.status,
    };
}

function getFloor(floorId: string): Floor | null {
    const db = getDb();
    const row = db
        .prepare(
            'SELECT code AS id, name, location FROM datacenters WHERE code = ?',
        )
        .get(floorId) as Floor | undefined;
    return row || null;
}

function getRoomById(roomId: string): Room | null {
    const row = getDb()
        .prepare(
            'SELECT id, name, floor_id, width, height, sort_order FROM rooms WHERE id = ?',
        )
        .get(roomId) as RoomRow | undefined;
    return row ? toRoom(row) : null;
}

function getDeviceIdsForRack(rackId: string): string[] {
    return (
        getDb()
            .prepare(
                'SELECT id FROM devices WHERE rack_id = ? ORDER BY u_position DESC',
            )
            .all(rackId) as { id: string }[]
    ).map((entry) => entry.id);
}

function getRackById(rackId: string): Rack | null {
    const row = getDb()
        .prepare(
            'SELECT id, name, room_id, u_capacity, x, y, sort_order FROM racks WHERE id = ?',
        )
        .get(rackId) as RackRow | undefined;
    return row ? toRack(row, getDeviceIdsForRack(row.id)) : null;
}

function loadPortsForDevices(deviceIds: string[]): Map<string, Port[]> {
    const result = new Map<string, Port[]>();
    for (const id of deviceIds) result.set(id, []);
    if (deviceIds.length === 0) return result;

    const placeholders = deviceIds.map(() => '?').join(',');
    const rows = getDb()
        .prepare(
            `SELECT id, name, type, device_id, status
             FROM ports
             WHERE device_id IN (${placeholders})
             ORDER BY name`,
        )
        .all(...deviceIds) as PortRow[];

    for (const row of rows) {
        const list = result.get(row.device_id) || [];
        list.push(toPort(row));
        result.set(row.device_id, list);
    }

    return result;
}

function loadDevicesForRack(rackId: string): Device[] {
    const rows = getDb()
        .prepare(
            `SELECT id, name, rack_id, u_height, u_position, type, depth,
                    asset_tag, serial_number, model, manufacturer, status
             FROM devices
             WHERE rack_id = ?
             ORDER BY u_position DESC`,
        )
        .all(rackId) as DeviceRow[];

    const ports = loadPortsForDevices(rows.map((row) => row.id));
    return rows.map((row) => toDevice(row, ports.get(row.id) || []));
}

function loadDevicesForRacks(rackIds: string[]): Device[] {
    if (rackIds.length === 0) return [];
    const placeholders = rackIds.map(() => '?').join(',');
    const rows = getDb()
        .prepare(
            `SELECT id, name, rack_id, u_height, u_position, type, depth,
                    asset_tag, serial_number, model, manufacturer, status
             FROM devices
             WHERE rack_id IN (${placeholders})
             ORDER BY rack_id, u_position DESC`,
        )
        .all(...rackIds) as DeviceRow[];

    const ports = loadPortsForDevices(rows.map((row) => row.id));
    return rows.map((row) => toDevice(row, ports.get(row.id) || []));
}

function loadConnectionsForDevices(deviceIds: string[]): Connection[] {
    if (deviceIds.length === 0) return [];

    const placeholdersA = deviceIds.map(() => '?').join(',');
    const placeholdersB = deviceIds.map(() => '?').join(',');
    const rows = getDb()
        .prepare(
            `SELECT DISTINCT
                c.id, c.port_a_id, c.port_b_id, c.type, c.color, c.status
             FROM connections c
             JOIN ports pa ON pa.id = c.port_a_id
             JOIN ports pb ON pb.id = c.port_b_id
             WHERE pa.device_id IN (${placeholdersA})
                OR pb.device_id IN (${placeholdersB})
             ORDER BY c.created_at ASC`,
        )
        .all(...deviceIds, ...deviceIds) as ConnectionRow[];

    return rows.map(toConnection);
}

function validateDevicePlacement(device: Device) {
    const db = getDb();
    const rack = db
        .prepare('SELECT id, u_capacity FROM racks WHERE id = ?')
        .get(device.rackId) as { id: string; u_capacity: number } | undefined;

    if (!rack) {
        throw new Error('Rack not found. Select a rack before adding an asset.');
    }

    if (device.uHeight < 1 || device.uPosition < 1) {
        throw new Error('Asset U position and height must be greater than zero.');
    }

    const endU = device.uPosition + device.uHeight - 1;
    if (endU > rack.u_capacity) {
        throw new Error(
            `Asset placement must fit within rack capacity (1-${rack.u_capacity}U).`,
        );
    }

    const existing = db
        .prepare(
            `SELECT id, u_position, u_height
             FROM devices
             WHERE rack_id = ? AND id <> ?`,
        )
        .all(device.rackId, device.id) as {
        id: string;
        u_position: number;
        u_height: number;
    }[];

    const overlaps = existing.some((other) => {
        const otherEnd = other.u_position + other.u_height - 1;
        return device.uPosition <= otherEnd && endU >= other.u_position;
    });

    if (overlaps) {
        throw new Error('The selected rack units are already occupied.');
    }
}

function saveDevice(device: Device): Device {
    const db = getDb();
    validateDevicePlacement(device);

    const now = Date.now();
    const save = db.transaction(() => {
        db.prepare(
            `INSERT INTO devices (
                id, name, rack_id, u_height, u_position, type, depth,
                asset_tag, serial_number, model, manufacturer, status,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                rack_id = excluded.rack_id,
                u_height = excluded.u_height,
                u_position = excluded.u_position,
                type = excluded.type,
                depth = excluded.depth,
                asset_tag = excluded.asset_tag,
                serial_number = excluded.serial_number,
                model = excluded.model,
                manufacturer = excluded.manufacturer,
                status = excluded.status,
                updated_at = excluded.updated_at`,
        ).run(
            device.id,
            device.name.trim(),
            device.rackId,
            device.uHeight,
            device.uPosition,
            device.type,
            device.depth,
            device.assetTag || null,
            device.serialNumber || null,
            device.model || null,
            device.manufacturer || null,
            device.status,
            now,
            now,
        );

        const incomingPortIds = new Set((device.ports || []).map((port) => port.id));
        const existingPorts = db
            .prepare('SELECT id FROM ports WHERE device_id = ?')
            .all(device.id) as { id: string }[];

        for (const existing of existingPorts) {
            if (!incomingPortIds.has(existing.id)) {
                db.prepare('DELETE FROM ports WHERE id = ?').run(existing.id);
            }
        }

        const upsertPort = db.prepare(
            `INSERT INTO ports (id, name, type, device_id, status)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                type = excluded.type,
                device_id = excluded.device_id,
                status = excluded.status`,
        );

        for (const port of device.ports || []) {
            upsertPort.run(
                port.id,
                port.name,
                port.type,
                device.id,
                port.status || 'up',
            );
        }
    });

    save();

    return (
        loadDevicesForRack(device.rackId).find(
            (candidate) => candidate.id === device.id,
        ) || device
    );
}

function saveInventoryAsset(asset: Device): Device {
    const db = getDb();
    const now = Date.now();

    const save = db.transaction(() => {
        db.prepare(
            `INSERT INTO inventory_assets (
                id, name, u_height, type, depth, asset_tag, serial_number,
                model, manufacturer, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                u_height = excluded.u_height,
                type = excluded.type,
                depth = excluded.depth,
                asset_tag = excluded.asset_tag,
                serial_number = excluded.serial_number,
                model = excluded.model,
                manufacturer = excluded.manufacturer,
                status = excluded.status,
                updated_at = excluded.updated_at`,
        ).run(
            asset.id,
            asset.name.trim(),
            asset.uHeight,
            asset.type,
            asset.depth,
            asset.assetTag || null,
            asset.serialNumber || null,
            asset.model || null,
            asset.manufacturer || null,
            asset.status,
            now,
            now,
        );

        const incomingPortIds = new Set((asset.ports || []).map((port) => port.id));
        const existingPorts = db
            .prepare('SELECT id FROM inventory_ports WHERE asset_id = ?')
            .all(asset.id) as { id: string }[];

        for (const existing of existingPorts) {
            if (!incomingPortIds.has(existing.id)) {
                db.prepare('DELETE FROM inventory_ports WHERE id = ?').run(
                    existing.id,
                );
            }
        }

        const upsertPort = db.prepare(
            `INSERT INTO inventory_ports (id, name, type, asset_id, status)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                type = excluded.type,
                asset_id = excluded.asset_id,
                status = excluded.status`,
        );

        for (const port of asset.ports || []) {
            upsertPort.run(
                port.id,
                port.name,
                port.type,
                asset.id,
                port.status || 'up',
            );
        }
    });

    save();

    return getInventoryInternal().find((candidate) => candidate.id === asset.id) || asset;
}

function getInventoryInternal(): Device[] {
    const db = getDb();
    const rows = db
        .prepare(
            `SELECT id, name, u_height, type, depth, asset_tag, serial_number,
                    model, manufacturer, status
             FROM inventory_assets
             ORDER BY name COLLATE NOCASE`,
        )
        .all() as InventoryRow[];

    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const placeholders = ids.map(() => '?').join(',');
    const portRows = db
        .prepare(
            `SELECT id, name, type, asset_id, status
             FROM inventory_ports
             WHERE asset_id IN (${placeholders})
             ORDER BY name`,
        )
        .all(...ids) as InventoryPortRow[];

    const portsByAsset = new Map<string, Port[]>();
    for (const id of ids) portsByAsset.set(id, []);
    for (const row of portRows) {
        const list = portsByAsset.get(row.asset_id) || [];
        list.push({
            id: row.id,
            name: row.name,
            type: row.type,
            deviceId: row.asset_id,
            status: row.status,
        });
        portsByAsset.set(row.asset_id, list);
    }

    return rows.map((row) =>
        toInventoryDevice(row, portsByAsset.get(row.id) || []),
    );
}

export const getFloors = createServerFn({ method: 'GET' }).handler(
    async (): Promise<Floor[]> => {
        await requireAuth();
        return getDb()
            .prepare(
                'SELECT code AS id, name, location FROM datacenters ORDER BY name COLLATE NOCASE',
            )
            .all() as Floor[];
    },
);

export const getFloorRooms = createServerFn({ method: 'GET' })
    .inputValidator((data: string) => data)
    .handler(async (ctx): Promise<Room[]> => {
        await requireAuth();
        const rows = getDb()
            .prepare(
                `SELECT id, name, floor_id, width, height, sort_order
                 FROM rooms
                 WHERE floor_id = ?
                 ORDER BY sort_order, name COLLATE NOCASE`,
            )
            .all(ctx.data) as RoomRow[];
        return rows.map(toRoom);
    });

export const getRoomRacks = createServerFn({ method: 'GET' })
    .inputValidator((data: string) => data)
    .handler(async (ctx): Promise<Rack[]> => {
        await requireAuth();
        const rows = getDb()
            .prepare(
                `SELECT id, name, room_id, u_capacity, x, y, sort_order
                 FROM racks
                 WHERE room_id = ?
                 ORDER BY sort_order, name COLLATE NOCASE`,
            )
            .all(ctx.data) as RackRow[];
        return rows.map((row) => toRack(row, getDeviceIdsForRack(row.id)));
    });

export const getFullRackContext = createServerFn({ method: 'GET' })
    .inputValidator((data: string) => data)
    .handler(
        async (
            ctx,
        ): Promise<{
            rack: Rack;
            room: Room;
            floor: Floor;
            devices: Device[];
            connections: Connection[];
        }> => {
            await requireAuth();

            const rack = getRackById(ctx.data);
            if (!rack) throw new Error('Rack not found');

            const room = getRoomById(rack.roomId);
            if (!room) throw new Error('Room not found');

            const floor = getFloor(room.floorId);
            if (!floor) throw new Error('Datacenter not found');

            const devices = loadDevicesForRack(rack.id);
            const connections = loadConnectionsForDevices(
                devices.map((device) => device.id),
            );

            return {
                rack: { ...rack, devices: devices.map((device) => device.id) },
                room,
                floor,
                devices,
                connections,
            };
        },
    );

export const getFullRoomContext = createServerFn({ method: 'GET' })
    .inputValidator((data: string) => data)
    .handler(
        async (
            ctx,
        ): Promise<{
            room: Room;
            racks: Rack[];
            floor: Floor;
            allDevices: Device[];
            connections: Connection[];
        }> => {
            await requireAuth();

            const room = getRoomById(ctx.data);
            if (!room) throw new Error('Room not found');

            const floor = getFloor(room.floorId);
            if (!floor) throw new Error('Datacenter not found');

            const rackRows = getDb()
                .prepare(
                    `SELECT id, name, room_id, u_capacity, x, y, sort_order
                     FROM racks
                     WHERE room_id = ?
                     ORDER BY sort_order, name COLLATE NOCASE`,
                )
                .all(room.id) as RackRow[];

            const allDevices = loadDevicesForRacks(
                rackRows.map((rack) => rack.id),
            );
            const devicesByRack = new Map<string, string[]>();
            for (const device of allDevices) {
                const list = devicesByRack.get(device.rackId) || [];
                list.push(device.id);
                devicesByRack.set(device.rackId, list);
            }

            const racks = rackRows.map((rack) =>
                toRack(rack, devicesByRack.get(rack.id) || []),
            );

            const connections = loadConnectionsForDevices(
                allDevices.map((device) => device.id),
            );

            return { room, racks, floor, allDevices, connections };
        },
    );

export const updateRackDevices = createServerFn({ method: 'POST' })
    .inputValidator((data: { rackId: string; devices: Device[] }) => data)
    .handler(async (ctx): Promise<{ success: boolean }> => {
        await requireAuth();
        const db = getDb();
        const { rackId, devices } = ctx.data;

        const transaction = db.transaction(() => {
            const ids = new Set(devices.map((device) => device.id));
            const existing = db
                .prepare('SELECT id FROM devices WHERE rack_id = ?')
                .all(rackId) as { id: string }[];

            for (const row of existing) {
                if (!ids.has(row.id)) {
                    db.prepare('DELETE FROM devices WHERE id = ?').run(row.id);
                }
            }

            for (const device of devices) {
                saveDevice({ ...device, rackId });
            }
        });

        transaction();
        return { success: true };
    });

export const upsertDevice = createServerFn({ method: 'POST' })
    .inputValidator((data: Device) => data)
    .handler(async (ctx): Promise<{ success: boolean; device: Device }> => {
        await requireAuth();
        const device = saveDevice(ctx.data);
        return { success: true, device };
    });

export const deleteDevice = createServerFn({ method: 'POST' })
    .inputValidator((data: string) => data)
    .handler(async (ctx): Promise<{ success: boolean }> => {
        await requireAuth();
        const result = getDb().prepare('DELETE FROM devices WHERE id = ?').run(ctx.data);
        if (result.changes === 0) throw new Error('Device not found');
        return { success: true };
    });

export const updateRackPosition = createServerFn({ method: 'POST' })
    .inputValidator((data: { id: string; x: number; y: number }) => data)
    .handler(async (ctx): Promise<{ success: boolean }> => {
        await requireAuth();
        const { id, x, y } = ctx.data;
        const db = getDb();

        const rack = db
            .prepare('SELECT room_id FROM racks WHERE id = ?')
            .get(id) as { room_id: string } | undefined;
        if (!rack) throw new Error('Rack not found');

        const occupied = db
            .prepare(
                'SELECT 1 FROM racks WHERE room_id = ? AND x = ? AND y = ? AND id <> ?',
            )
            .get(rack.room_id, x, y, id);
        if (occupied) throw new Error('That room position is already occupied.');

        db.prepare('UPDATE racks SET x = ?, y = ? WHERE id = ?').run(x, y, id);
        return { success: true };
    });

export const connectPorts = createServerFn({ method: 'POST' })
    .inputValidator(
        (data: {
            portAId: string;
            portBId: string;
            type: 'copper' | 'fiber' | 'power';
        }) => data,
    )
    .handler(
        async (ctx): Promise<{ success: boolean; connection: Connection }> => {
            await requireAuth();
            const db = getDb();
            const { portAId, portBId, type } = ctx.data;

            if (portAId === portBId) {
                throw new Error('A port cannot be connected to itself.');
            }

            const ports = db
                .prepare(
                    'SELECT id FROM ports WHERE id IN (?, ?)',
                )
                .all(portAId, portBId) as { id: string }[];
            if (ports.length !== 2) throw new Error('One or both ports were not found.');

            const existing = db
                .prepare(
                    `SELECT id FROM connections
                     WHERE port_a_id IN (?, ?) OR port_b_id IN (?, ?)`,
                )
                .get(portAId, portBId, portAId, portBId);
            if (existing) throw new Error('One or both ports are already connected.');

            const connection: Connection = {
                id: randomUUID(),
                portAId,
                portBId,
                type,
                status: 'active',
                color: type === 'fiber' ? '#f59e0b' : type === 'power' ? '#ef4444' : '#3b82f6',
            };

            const transaction = db.transaction(() => {
                db.prepare(
                    `INSERT INTO connections
                        (id, port_a_id, port_b_id, type, color, status, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ).run(
                    connection.id,
                    connection.portAId,
                    connection.portBId,
                    connection.type,
                    connection.color || null,
                    connection.status,
                    Date.now(),
                );
                db.prepare(
                    "UPDATE ports SET status = 'plugged' WHERE id IN (?, ?)",
                ).run(portAId, portBId);
            });

            transaction();
            return { success: true, connection };
        },
    );

export const disconnectPorts = createServerFn({ method: 'POST' })
    .inputValidator((data: string) => data)
    .handler(async (ctx): Promise<{ success: boolean }> => {
        await requireAuth();
        const db = getDb();

        const connection = db
            .prepare(
                'SELECT port_a_id, port_b_id FROM connections WHERE id = ?',
            )
            .get(ctx.data) as
            | { port_a_id: string; port_b_id: string }
            | undefined;
        if (!connection) throw new Error('Connection not found');

        const transaction = db.transaction(() => {
            db.prepare('DELETE FROM connections WHERE id = ?').run(ctx.data);
            db.prepare(
                "UPDATE ports SET status = 'up' WHERE id IN (?, ?)",
            ).run(connection.port_a_id, connection.port_b_id);
        });

        transaction();
        return { success: true };
    });

export const getInventory = createServerFn({ method: 'GET' }).handler(
    async (): Promise<Device[]> => {
        await requireAuth();
        return getInventoryInternal();
    },
);

export const upsertInventoryAsset = createServerFn({ method: 'POST' })
    .inputValidator((data: Device) => data)
    .handler(async (ctx): Promise<{ success: boolean; device: Device }> => {
        await requireAuth();
        if (!ctx.data.name.trim()) throw new Error('Blueprint name is required.');
        if (ctx.data.uHeight < 1) throw new Error('Blueprint height must be at least 1U.');
        const device = saveInventoryAsset({
            ...ctx.data,
            rackId: '',
            uPosition: 1,
        });
        return { success: true, device };
    });

export const deleteInventoryAsset = createServerFn({ method: 'POST' })
    .inputValidator((data: string) => data)
    .handler(async (ctx): Promise<{ success: boolean }> => {
        await requireAuth();
        const result = getDb()
            .prepare('DELETE FROM inventory_assets WHERE id = ?')
            .run(ctx.data);
        if (result.changes === 0) throw new Error('Blueprint not found');
        return { success: true };
    });

export const duplicateInventoryAsset = createServerFn({ method: 'POST' })
    .inputValidator((data: string) => data)
    .handler(async (ctx): Promise<{ success: boolean; device: Device }> => {
        await requireAuth();
        const original = getInventoryInternal().find(
            (asset) => asset.id === ctx.data,
        );
        if (!original) throw new Error('Blueprint not found');

        const id = randomUUID();
        const clone: Device = {
            ...original,
            id,
            name: `${original.name} (Copy)`,
            assetTag: original.assetTag ? `${original.assetTag}-COPY` : undefined,
            ports: original.ports.map((port) => ({
                ...port,
                id: randomUUID(),
                deviceId: id,
                status: 'up',
            })),
        };

        const device = saveInventoryAsset(clone);
        return { success: true, device };
    });

export const createRoom = createServerFn({ method: 'POST' })
    .inputValidator(
        (data: {
            name: string;
            floorId: string;
            width: number;
            height: number;
        }) => data,
    )
    .handler(async (ctx): Promise<{ success: boolean; room: Room }> => {
        await requireAuth();
        const db = getDb();
        const data = ctx.data;

        if (!data.name.trim()) throw new Error('Room name is required.');
        if (!getFloor(data.floorId)) throw new Error('Datacenter not found.');

        const nextOrder = (
            db.prepare(
                'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM rooms WHERE floor_id = ?',
            )
                .get(data.floorId) as { next_order: number }
        ).next_order;

        const room: Room = {
            id: `rm-${randomUUID()}`,
            name: data.name.trim(),
            floorId: data.floorId,
            width: Math.max(1, data.width),
            height: Math.max(1, data.height),
            order: nextOrder,
        };

        db.prepare(
            `INSERT INTO rooms
                (id, name, floor_id, width, height, sort_order, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(
            room.id,
            room.name,
            room.floorId,
            room.width,
            room.height,
            room.order,
            Date.now(),
        );

        return { success: true, room };
    });

export const createRack = createServerFn({ method: 'POST' })
    .inputValidator(
        (data: {
            name: string;
            roomId: string;
            uCapacity: number;
            x: number;
            y: number;
        }) => data,
    )
    .handler(async (ctx): Promise<{ success: boolean; rack: Rack }> => {
        await requireAuth();
        const db = getDb();
        const data = ctx.data;
        const room = getRoomById(data.roomId);

        if (!room) throw new Error('Target room not found.');
        if (!data.name.trim()) throw new Error('Rack name is required.');
        if (![42, 48, 52].includes(data.uCapacity)) {
            throw new Error('Rack capacity must be 42U, 48U, or 52U.');
        }

        const existing = db
            .prepare('SELECT x, y FROM racks WHERE room_id = ?')
            .all(room.id) as { x: number; y: number }[];
        const occupied = new Set(existing.map((entry) => `${entry.x},${entry.y}`));

        let x = Math.max(0, Math.min(room.width - 1, data.x));
        let y = Math.max(0, Math.min(room.height - 1, data.y));

        if (occupied.has(`${x},${y}`)) {
            let found = false;
            for (let row = 0; row < room.height && !found; row += 1) {
                for (let column = 0; column < room.width; column += 1) {
                    if (!occupied.has(`${column},${row}`)) {
                        x = column;
                        y = row;
                        found = true;
                        break;
                    }
                }
            }
            if (!found) throw new Error('No free rack position is available in this room.');
        }

        const nextOrder = (
            db.prepare(
                'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM racks WHERE room_id = ?',
            )
                .get(room.id) as { next_order: number }
        ).next_order;

        const rack: Rack = {
            id: `rk-${randomUUID()}`,
            name: data.name.trim(),
            roomId: room.id,
            uCapacity: data.uCapacity,
            devices: [],
            x,
            y,
            order: nextOrder,
        };

        db.prepare(
            `INSERT INTO racks
                (id, name, room_id, u_capacity, x, y, sort_order, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
            rack.id,
            rack.name,
            rack.roomId,
            rack.uCapacity,
            rack.x,
            rack.y,
            rack.order,
            Date.now(),
        );

        return { success: true, rack };
    });

export const getInfrastructureSummary = createServerFn({
    method: 'GET',
}).handler(
    async (): Promise<{
        floors: Floor[];
        rooms: Room[];
        racks: Rack[];
    }> => {
        await requireAuth();
        const db = getDb();

        const floors = db
            .prepare(
                'SELECT code AS id, name, location FROM datacenters ORDER BY name COLLATE NOCASE',
            )
            .all() as Floor[];

        const roomRows = db
            .prepare(
                `SELECT id, name, floor_id, width, height, sort_order
                 FROM rooms
                 ORDER BY floor_id, sort_order, name COLLATE NOCASE`,
            )
            .all() as RoomRow[];

        const rackRows = db
            .prepare(
                `SELECT id, name, room_id, u_capacity, x, y, sort_order
                 FROM racks
                 ORDER BY room_id, sort_order, name COLLATE NOCASE`,
            )
            .all() as RackRow[];

        const devices = db
            .prepare('SELECT id, rack_id FROM devices')
            .all() as { id: string; rack_id: string }[];
        const devicesByRack = new Map<string, string[]>();
        for (const device of devices) {
            const list = devicesByRack.get(device.rack_id) || [];
            list.push(device.id);
            devicesByRack.set(device.rack_id, list);
        }

        return {
            floors,
            rooms: roomRows.map(toRoom),
            racks: rackRows.map((row) =>
                toRack(row, devicesByRack.get(row.id) || []),
            ),
        };
    },
);

export const updateRoom = createServerFn({ method: 'POST' })
    .inputValidator((data: { id: string; name: string }) => data)
    .handler(async (ctx): Promise<{ success: boolean }> => {
        await requireAuth();
        const name = ctx.data.name.trim();
        if (!name) throw new Error('Room name is required.');

        const result = getDb()
            .prepare('UPDATE rooms SET name = ? WHERE id = ?')
            .run(name, ctx.data.id);
        if (result.changes === 0) throw new Error('Room not found');
        return { success: true };
    });

export const deleteRoom = createServerFn({ method: 'POST' })
    .inputValidator((data: string) => data)
    .handler(async (ctx): Promise<{ success: boolean }> => {
        await requireAuth();
        const result = getDb().prepare('DELETE FROM rooms WHERE id = ?').run(ctx.data);
        if (result.changes === 0) throw new Error('Room not found');
        return { success: true };
    });

export const updateRack = createServerFn({ method: 'POST' })
    .inputValidator(
        (data: { id: string; name: string; uCapacity: number }) => data,
    )
    .handler(async (ctx): Promise<{ success: boolean }> => {
        await requireAuth();
        const name = ctx.data.name.trim();
        if (!name) throw new Error('Rack name is required.');

        const currentUsage = getDb()
            .prepare(
                `SELECT COALESCE(MAX(u_position + u_height - 1), 0) AS max_u
                 FROM devices WHERE rack_id = ?`,
            )
            .get(ctx.data.id) as { max_u: number };

        if (currentUsage.max_u > ctx.data.uCapacity) {
            throw new Error(
                `Rack contains a device above ${ctx.data.uCapacity}U and cannot be resized yet.`,
            );
        }

        const result = getDb()
            .prepare(
                'UPDATE racks SET name = ?, u_capacity = ? WHERE id = ?',
            )
            .run(name, ctx.data.uCapacity, ctx.data.id);
        if (result.changes === 0) throw new Error('Rack not found');
        return { success: true };
    });

export const deleteRack = createServerFn({ method: 'POST' })
    .inputValidator((data: string) => data)
    .handler(async (ctx): Promise<{ success: boolean }> => {
        await requireAuth();
        const result = getDb().prepare('DELETE FROM racks WHERE id = ?').run(ctx.data);
        if (result.changes === 0) throw new Error('Rack not found');
        return { success: true };
    });

export const updateEntityOrder = createServerFn({ method: 'POST' })
    .inputValidator(
        (data: {
            type: 'room' | 'rack';
            orders: { id: string; order: number }[];
        }) => data,
    )
    .handler(async (ctx): Promise<{ success: boolean }> => {
        await requireAuth();
        const db = getDb();
        const table = ctx.data.type === 'room' ? 'rooms' : 'racks';

        const update = db.prepare(
            `UPDATE ${table} SET sort_order = ? WHERE id = ?`,
        );
        const transaction = db.transaction(() => {
            for (const item of ctx.data.orders) {
                update.run(item.order, item.id);
            }
        });

        transaction();
        return { success: true };
    });

export type { Database };
