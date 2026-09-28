import { createServerFn } from '@tanstack/react-start';
import type {
    Connection,
    Device,
    Floor,
    Rack,
    Room,
} from '#/types/schema';
import { getSession } from '../auth/auth-service';
import { getDb } from '../auth/sqlite';

async function requireAuth() {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');
    return session;
}

function parseDevice(payload: string): Device {
    const device = JSON.parse(payload) as Device;
    return {
        ...device,
        uHeight: Number(device.uHeight) || 1,
        uPosition: Number(device.uPosition) || 1,
        depth: device.depth || 'full',
        status: device.status || 'active',
        ports: Array.isArray(device.ports) ? device.ports : [],
    };
}

function parseConnection(payload: string): Connection {
    return JSON.parse(payload) as Connection;
}

function roomFromRow(row: {
    id: string;
    name: string;
    floor_id: string;
    width: number;
    height: number;
    sort_order: number;
}): Room {
    return {
        id: row.id,
        name: row.name,
        floorId: row.floor_id,
        width: row.width,
        height: row.height,
        order: row.sort_order,
    };
}

function rackFromRow(
    row: {
        id: string;
        name: string;
        room_id: string;
        u_capacity: number;
        x: number;
        y: number;
        sort_order: number;
    },
    deviceIds: string[] = [],
): Rack {
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

function getFloorById(id: string): Floor | undefined {
    const db = getDb();

    const dc = db
        .prepare('SELECT code, name, location FROM datacenters WHERE code = ?')
        .get(id) as
        | { code: string; name: string; location: string }
        | undefined;

    if (dc) {
        return { id: dc.code, name: dc.name, location: dc.location };
    }

    const floor = db
        .prepare('SELECT id, name, location FROM floors WHERE id = ?')
        .get(id) as Floor | undefined;

    return floor;
}

function getDevicesForRack(rackId: string): Device[] {
    const db = getDb();
    const rows = db
        .prepare('SELECT payload FROM devices WHERE rack_id = ?')
        .all(rackId) as { payload: string }[];

    return rows.map((row) => parseDevice(row.payload));
}

function getConnectionsForDevices(devices: Device[]): Connection[] {
    if (devices.length === 0) return [];

    const portIds = new Set(
        devices.flatMap((device) => (device.ports || []).map((port) => port.id)),
    );

    const db = getDb();
    const rows = db.prepare('SELECT payload FROM connections').all() as {
        payload: string;
    }[];

    return rows
        .map((row) => parseConnection(row.payload))
        .filter(
            (connection) =>
                portIds.has(connection.portAId) ||
                portIds.has(connection.portBId),
        );
}

function saveDevice(device: Device) {
    const db = getDb();
    db.prepare(
        `INSERT INTO devices (id, rack_id, payload)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           rack_id = excluded.rack_id,
           payload = excluded.payload`,
    ).run(device.id, device.rackId, JSON.stringify(device));
}

function saveConnection(connection: Connection) {
    const db = getDb();
    db.prepare(
        `INSERT INTO connections (id, payload)
         VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
    ).run(connection.id, JSON.stringify(connection));
}

export const getFloors = createServerFn({ method: 'GET' }).handler(
    async (): Promise<Floor[]> => {
        const db = getDb();

        const datacenters = db
            .prepare('SELECT code, name, location FROM datacenters ORDER BY created_at')
            .all() as { code: string; name: string; location: string }[];

        const floors = db
            .prepare('SELECT id, name, location FROM floors ORDER BY name')
            .all() as Floor[];

        const result: Floor[] = datacenters.map((dc) => ({
            id: dc.code,
            name: dc.name,
            location: dc.location,
        }));

        for (const floor of floors) {
            if (!result.some((item) => item.id === floor.id)) result.push(floor);
        }

        return result;
    },
);

export const getFloorRooms = createServerFn({ method: 'GET' })
    .inputValidator((data: string) => data)
    .handler(async (ctx): Promise<Room[]> => {
        const db = getDb();
        const rows = db
            .prepare(
                'SELECT id, name, floor_id, width, height, sort_order FROM rooms WHERE floor_id = ? ORDER BY sort_order, name',
            )
            .all(ctx.data) as {
            id: string;
            name: string;
            floor_id: string;
            width: number;
            height: number;
            sort_order: number;
        }[];

        return rows.map(roomFromRow);
    });

export const getRoomRacks = createServerFn({ method: 'GET' })
    .inputValidator((data: string) => data)
    .handler(async (ctx): Promise<Rack[]> => {
        const db = getDb();
        const rows = db
            .prepare(
                'SELECT id, name, room_id, u_capacity, x, y, sort_order FROM racks WHERE room_id = ? ORDER BY sort_order, name',
            )
            .all(ctx.data) as {
            id: string;
            name: string;
            room_id: string;
            u_capacity: number;
            x: number;
            y: number;
            sort_order: number;
        }[];

        return rows.map((row) => {
            const deviceIds = getDevicesForRack(row.id).map((device) => device.id);
            return rackFromRow(row, deviceIds);
        });
    });

export const getFullRackContext = createServerFn({ method: 'GET' })
    .inputValidator((data: string) => data)
    .handler(async (ctx) => {
        const db = getDb();
        const rackRow = db
            .prepare(
                'SELECT id, name, room_id, u_capacity, x, y, sort_order FROM racks WHERE id = ?',
            )
            .get(ctx.data) as
            | {
                  id: string;
                  name: string;
                  room_id: string;
                  u_capacity: number;
                  x: number;
                  y: number;
                  sort_order: number;
              }
            | undefined;

        if (!rackRow) throw new Error('Rack not found');

        const roomRow = db
            .prepare(
                'SELECT id, name, floor_id, width, height, sort_order FROM rooms WHERE id = ?',
            )
            .get(rackRow.room_id) as
            | {
                  id: string;
                  name: string;
                  floor_id: string;
                  width: number;
                  height: number;
                  sort_order: number;
              }
            | undefined;

        if (!roomRow) throw new Error('Room not found');

        const room = roomFromRow(roomRow);
        const floor = getFloorById(room.floorId);
        if (!floor) throw new Error('Datacenter not found');

        const devices = getDevicesForRack(rackRow.id);
        const rack = rackFromRow(
            rackRow,
            devices.map((device) => device.id),
        );

        return {
            rack,
            room,
            floor,
            devices,
            connections: getConnectionsForDevices(devices),
        };
    });

export const getFullRoomContext = createServerFn({ method: 'GET' })
    .inputValidator((data: string) => data)
    .handler(async (ctx) => {
        const db = getDb();
        const roomRow = db
            .prepare(
                'SELECT id, name, floor_id, width, height, sort_order FROM rooms WHERE id = ?',
            )
            .get(ctx.data) as
            | {
                  id: string;
                  name: string;
                  floor_id: string;
                  width: number;
                  height: number;
                  sort_order: number;
              }
            | undefined;

        if (!roomRow) throw new Error('Room not found');

        const room = roomFromRow(roomRow);
        const floor = getFloorById(room.floorId);
        if (!floor) throw new Error('Datacenter not found');

        const rackRows = db
            .prepare(
                'SELECT id, name, room_id, u_capacity, x, y, sort_order FROM racks WHERE room_id = ? ORDER BY sort_order, name',
            )
            .all(room.id) as {
            id: string;
            name: string;
            room_id: string;
            u_capacity: number;
            x: number;
            y: number;
            sort_order: number;
        }[];

        const racks = rackRows.map((row) => {
            const deviceIds = getDevicesForRack(row.id).map((device) => device.id);
            return rackFromRow(row, deviceIds);
        });

        const allDevices = racks.flatMap((rack) => getDevicesForRack(rack.id));

        return {
            room,
            racks,
            floor,
            allDevices,
            connections: getConnectionsForDevices(allDevices),
        };
    });

export const updateRackDevices = createServerFn({ method: 'POST' })
    .inputValidator((data: { rackId: string; devices: Device[] }) => data)
    .handler(async (ctx) => {
        await requireAuth();
        const db = getDb();

        const rack = db.prepare('SELECT id FROM racks WHERE id = ?').get(ctx.data.rackId);
        if (!rack) throw new Error('Rack not found');

        const transaction = db.transaction(() => {
            db.prepare('DELETE FROM devices WHERE rack_id = ?').run(ctx.data.rackId);
            for (const device of ctx.data.devices) {
                saveDevice({
                    ...device,
                    rackId: ctx.data.rackId,
                    ports: device.ports || [],
                });
            }
        });

        transaction();
        return { success: true };
    });

export const upsertDevice = createServerFn({ method: 'POST' })
    .inputValidator((data: Device) => data)
    .handler(async (ctx): Promise<{ success: boolean; device: Device }> => {
        await requireAuth();
        const db = getDb();
        const rackRow = db
            .prepare('SELECT id, u_capacity FROM racks WHERE id = ?')
            .get(ctx.data.rackId) as { id: string; u_capacity: number } | undefined;

        if (!rackRow) {
            throw new Error('Rack not found. Select a rack before adding an asset.');
        }

        const device: Device = {
            ...ctx.data,
            rackId: rackRow.id,
            uHeight: Number(ctx.data.uHeight) || 1,
            uPosition: Number(ctx.data.uPosition) || 1,
            ports: (ctx.data.ports || []).map((port) => ({
                ...port,
                deviceId: ctx.data.id,
            })),
        };

        if (
            device.uPosition < 1 ||
            device.uHeight < 1 ||
            device.uPosition + device.uHeight - 1 > rackRow.u_capacity
        ) {
            throw new Error(
                `Asset placement must fit within rack capacity (1-${rackRow.u_capacity}U).`,
            );
        }

        const siblings = getDevicesForRack(rackRow.id).filter(
            (candidate) => candidate.id !== device.id,
        );
        const start = device.uPosition;
        const end = start + device.uHeight - 1;

        const collision = siblings.some((candidate) => {
            const candidateStart = candidate.uPosition;
            const candidateEnd = candidateStart + candidate.uHeight - 1;
            return start <= candidateEnd && end >= candidateStart;
        });

        if (collision) {
            throw new Error('Selected rack units are already occupied.');
        }

        saveDevice(device);
        return { success: true, device };
    });

export const deleteDevice = createServerFn({ method: 'POST' })
    .inputValidator((data: string) => data)
    .handler(async (ctx) => {
        await requireAuth();
        const db = getDb();
        const row = db
            .prepare('SELECT payload FROM devices WHERE id = ?')
            .get(ctx.data) as { payload: string } | undefined;

        if (!row) throw new Error('Device not found');

        const device = parseDevice(row.payload);
        const portIds = new Set((device.ports || []).map((port) => port.id));

        const transaction = db.transaction(() => {
            const connections = db
                .prepare('SELECT id, payload FROM connections')
                .all() as { id: string; payload: string }[];

            for (const connectionRow of connections) {
                const connection = parseConnection(connectionRow.payload);
                if (
                    portIds.has(connection.portAId) ||
                    portIds.has(connection.portBId)
                ) {
                    db.prepare('DELETE FROM connections WHERE id = ?').run(
                        connection.id,
                    );
                }
            }

            db.prepare('DELETE FROM devices WHERE id = ?').run(ctx.data);
        });

        transaction();
        return { success: true };
    });

export const updateRackPosition = createServerFn({ method: 'POST' })
    .inputValidator((data: { id: string; x: number; y: number }) => data)
    .handler(async (ctx) => {
        await requireAuth();
        const db = getDb();
        const result = db
            .prepare('UPDATE racks SET x = ?, y = ? WHERE id = ?')
            .run(ctx.data.x, ctx.data.y, ctx.data.id);

        if (result.changes === 0) throw new Error('Rack not found');
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
    .handler(async (ctx) => {
        await requireAuth();
        const db = getDb();
        const rows = db.prepare('SELECT payload FROM connections').all() as {
            payload: string;
        }[];

        const existing = rows
            .map((row) => parseConnection(row.payload))
            .find(
                (connection) =>
                    connection.portAId === ctx.data.portAId ||
                    connection.portBId === ctx.data.portAId ||
                    connection.portAId === ctx.data.portBId ||
                    connection.portBId === ctx.data.portBId,
            );

        if (existing) {
            throw new Error('One or both ports are already connected');
        }

        const connection: Connection = {
            id: crypto.randomUUID(),
            portAId: ctx.data.portAId,
            portBId: ctx.data.portBId,
            type: ctx.data.type,
            status: 'active',
            color:
                ctx.data.type === 'fiber'
                    ? '#f59e0b'
                    : ctx.data.type === 'power'
                      ? '#ef4444'
                      : '#3b82f6',
        };

        const deviceRows = db
            .prepare('SELECT id, payload FROM devices')
            .all() as { id: string; payload: string }[];

        const transaction = db.transaction(() => {
            saveConnection(connection);

            for (const row of deviceRows) {
                const device = parseDevice(row.payload);
                let changed = false;

                device.ports = (device.ports || []).map((port) => {
                    if (
                        port.id === connection.portAId ||
                        port.id === connection.portBId
                    ) {
                        changed = true;
                        return { ...port, status: 'plugged' };
                    }
                    return port;
                });

                if (changed) saveDevice(device);
            }
        });

        transaction();
        return { success: true, connection };
    });

export const disconnectPorts = createServerFn({ method: 'POST' })
    .inputValidator((data: string) => data)
    .handler(async (ctx) => {
        await requireAuth();
        const db = getDb();
        const row = db
            .prepare('SELECT payload FROM connections WHERE id = ?')
            .get(ctx.data) as { payload: string } | undefined;

        if (!row) throw new Error('Connection not found');
        const connection = parseConnection(row.payload);

        const deviceRows = db
            .prepare('SELECT id, payload FROM devices')
            .all() as { id: string; payload: string }[];

        const transaction = db.transaction(() => {
            for (const deviceRow of deviceRows) {
                const device = parseDevice(deviceRow.payload);
                let changed = false;

                device.ports = (device.ports || []).map((port) => {
                    if (
                        port.id === connection.portAId ||
                        port.id === connection.portBId
                    ) {
                        changed = true;
                        return { ...port, status: 'up' };
                    }
                    return port;
                });

                if (changed) saveDevice(device);
            }

            db.prepare('DELETE FROM connections WHERE id = ?').run(ctx.data);
        });

        transaction();
        return { success: true };
    });

export const getInventory = createServerFn({ method: 'GET' }).handler(
    async (): Promise<Device[]> => {
        const db = getDb();
        const rows = db
            .prepare('SELECT payload FROM inventory ORDER BY id')
            .all() as { payload: string }[];

        return rows.map((row) => parseDevice(row.payload));
    },
);

export const upsertInventoryAsset = createServerFn({ method: 'POST' })
    .inputValidator((data: Device) => data)
    .handler(async (ctx): Promise<{ success: boolean; device: Device }> => {
        await requireAuth();
        const db = getDb();

        const asset: Device = {
            ...ctx.data,
            rackId: '',
            uPosition: 1,
            ports: (ctx.data.ports || []).map((port) => ({
                ...port,
                deviceId: ctx.data.id,
            })),
        };

        db.prepare(
            `INSERT INTO inventory (id, payload)
             VALUES (?, ?)
             ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
        ).run(asset.id, JSON.stringify(asset));

        return { success: true, device: asset };
    });

export const deleteInventoryAsset = createServerFn({ method: 'POST' })
    .inputValidator((data: string) => data)
    .handler(async (ctx) => {
        await requireAuth();
        getDb().prepare('DELETE FROM inventory WHERE id = ?').run(ctx.data);
        return { success: true };
    });

export const duplicateInventoryAsset = createServerFn({ method: 'POST' })
    .inputValidator((data: string) => data)
    .handler(async (ctx): Promise<{ success: boolean; device: Device }> => {
        await requireAuth();
        const db = getDb();
        const row = db
            .prepare('SELECT payload FROM inventory WHERE id = ?')
            .get(ctx.data) as { payload: string } | undefined;

        if (!row) throw new Error('Asset not found');

        const original = parseDevice(row.payload);
        const id = crypto.randomUUID();
        const clone: Device = {
            ...original,
            id,
            name: `${original.name} (Copy)`,
            assetTag: original.assetTag ? `${original.assetTag}-COPY` : 'COPY',
            ports: (original.ports || []).map((port) => ({
                ...port,
                id: crypto.randomUUID(),
                deviceId: id,
                status: 'up',
            })),
        };

        db.prepare('INSERT INTO inventory (id, payload) VALUES (?, ?)').run(
            clone.id,
            JSON.stringify(clone),
        );

        return { success: true, device: clone };
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
    .handler(async (ctx) => {
        await requireAuth();
        const db = getDb();
        const name = ctx.data.name.trim();
        if (!name) throw new Error('Room name is required.');

        const maxOrder = db
            .prepare('SELECT COALESCE(MAX(sort_order), 0) AS value FROM rooms WHERE floor_id = ?')
            .get(ctx.data.floorId) as { value: number };

        const room: Room = {
            id: `rm-${crypto.randomUUID()}`,
            name,
            floorId: ctx.data.floorId,
            width: Math.max(1, Number(ctx.data.width) || 12),
            height: Math.max(1, Number(ctx.data.height) || 10),
            order: maxOrder.value + 1,
        };

        db.prepare(
            'INSERT INTO rooms (id, name, floor_id, width, height, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(
            room.id,
            room.name,
            room.floorId,
            room.width,
            room.height,
            room.order,
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
    .handler(async (ctx) => {
        await requireAuth();
        const db = getDb();

        const roomRow = db
            .prepare('SELECT width, height FROM rooms WHERE id = ?')
            .get(ctx.data.roomId) as { width: number; height: number } | undefined;

        if (!roomRow) {
            throw new Error('Target room not found. Refresh the page and try again.');
        }

        const name = ctx.data.name.trim();
        if (!name) throw new Error('Rack name is required.');

        if (![42, 48, 52].includes(ctx.data.uCapacity)) {
            throw new Error('Rack capacity must be 42U, 48U, or 52U.');
        }

        const occupiedRows = db
            .prepare('SELECT x, y FROM racks WHERE room_id = ?')
            .all(ctx.data.roomId) as { x: number; y: number }[];
        const occupied = new Set(occupiedRows.map((row) => `${row.x},${row.y}`));

        let x = Math.max(0, Number(ctx.data.x) || 0);
        let y = Math.max(0, Number(ctx.data.y) || 0);

        if (occupied.has(`${x},${y}`)) {
            let found = false;
            for (let row = 0; row < roomRow.height && !found; row += 1) {
                for (let column = 0; column < roomRow.width; column += 1) {
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

        const maxOrder = db
            .prepare('SELECT COALESCE(MAX(sort_order), 0) AS value FROM racks WHERE room_id = ?')
            .get(ctx.data.roomId) as { value: number };

        const rack: Rack = {
            id: `rk-${crypto.randomUUID()}`,
            name,
            roomId: ctx.data.roomId,
            uCapacity: ctx.data.uCapacity,
            devices: [],
            x,
            y,
            order: maxOrder.value + 1,
        };

        db.prepare(
            'INSERT INTO racks (id, name, room_id, u_capacity, x, y, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).run(
            rack.id,
            rack.name,
            rack.roomId,
            rack.uCapacity,
            rack.x,
            rack.y,
            rack.order,
        );

        return { success: true, rack };
    });

export const getInfrastructureSummary = createServerFn({ method: 'GET' }).handler(
    async (): Promise<{ floors: Floor[]; rooms: Room[]; racks: Rack[] }> => {
        const db = getDb();

        const floors = await getFloors();

        const roomRows = db
            .prepare(
                'SELECT id, name, floor_id, width, height, sort_order FROM rooms ORDER BY floor_id, sort_order, name',
            )
            .all() as {
            id: string;
            name: string;
            floor_id: string;
            width: number;
            height: number;
            sort_order: number;
        }[];

        const rackRows = db
            .prepare(
                'SELECT id, name, room_id, u_capacity, x, y, sort_order FROM racks ORDER BY room_id, sort_order, name',
            )
            .all() as {
            id: string;
            name: string;
            room_id: string;
            u_capacity: number;
            x: number;
            y: number;
            sort_order: number;
        }[];

        const racks = rackRows.map((row) =>
            rackFromRow(
                row,
                getDevicesForRack(row.id).map((device) => device.id),
            ),
        );

        return {
            floors,
            rooms: roomRows.map(roomFromRow),
            racks,
        };
    },
);

export const updateRoom = createServerFn({ method: 'POST' })
    .inputValidator((data: { id: string; name: string }) => data)
    .handler(async (ctx) => {
        await requireAuth();
        const result = getDb()
            .prepare('UPDATE rooms SET name = ? WHERE id = ?')
            .run(ctx.data.name.trim(), ctx.data.id);

        if (result.changes === 0) throw new Error('Room not found');
        return { success: true };
    });

export const deleteRoom = createServerFn({ method: 'POST' })
    .inputValidator((data: string) => data)
    .handler(async (ctx) => {
        await requireAuth();
        const db = getDb();

        const rackIds = db
            .prepare('SELECT id FROM racks WHERE room_id = ?')
            .all(ctx.data) as { id: string }[];

        const deviceRows = rackIds.flatMap((rack) =>
            db
                .prepare('SELECT payload FROM devices WHERE rack_id = ?')
                .all(rack.id) as { payload: string }[],
        );
        const portIds = new Set(
            deviceRows
                .map((row) => parseDevice(row.payload))
                .flatMap((device) => device.ports.map((port) => port.id)),
        );

        const transaction = db.transaction(() => {
            const connectionRows = db
                .prepare('SELECT id, payload FROM connections')
                .all() as { id: string; payload: string }[];

            for (const row of connectionRows) {
                const connection = parseConnection(row.payload);
                if (
                    portIds.has(connection.portAId) ||
                    portIds.has(connection.portBId)
                ) {
                    db.prepare('DELETE FROM connections WHERE id = ?').run(
                        connection.id,
                    );
                }
            }

            db.prepare('DELETE FROM rooms WHERE id = ?').run(ctx.data);
        });

        transaction();
        return { success: true };
    });

export const updateRack = createServerFn({ method: 'POST' })
    .inputValidator(
        (data: { id: string; name: string; uCapacity: number }) => data,
    )
    .handler(async (ctx) => {
        await requireAuth();
        const result = getDb()
            .prepare('UPDATE racks SET name = ?, u_capacity = ? WHERE id = ?')
            .run(ctx.data.name.trim(), ctx.data.uCapacity, ctx.data.id);

        if (result.changes === 0) throw new Error('Rack not found');
        return { success: true };
    });

export const deleteRack = createServerFn({ method: 'POST' })
    .inputValidator((data: string) => data)
    .handler(async (ctx) => {
        await requireAuth();
        const db = getDb();

        const deviceRows = db
            .prepare('SELECT payload FROM devices WHERE rack_id = ?')
            .all(ctx.data) as { payload: string }[];
        const portIds = new Set(
            deviceRows
                .map((row) => parseDevice(row.payload))
                .flatMap((device) => device.ports.map((port) => port.id)),
        );

        const transaction = db.transaction(() => {
            const connectionRows = db
                .prepare('SELECT id, payload FROM connections')
                .all() as { id: string; payload: string }[];

            for (const row of connectionRows) {
                const connection = parseConnection(row.payload);
                if (
                    portIds.has(connection.portAId) ||
                    portIds.has(connection.portBId)
                ) {
                    db.prepare('DELETE FROM connections WHERE id = ?').run(
                        connection.id,
                    );
                }
            }

            db.prepare('DELETE FROM racks WHERE id = ?').run(ctx.data);
        });

        transaction();
        return { success: true };
    });

export const updateEntityOrder = createServerFn({ method: 'POST' })
    .inputValidator(
        (data: {
            type: 'room' | 'rack';
            orders: { id: string; order: number }[];
        }) => data,
    )
    .handler(async (ctx) => {
        await requireAuth();
        const db = getDb();
        const table = ctx.data.type === 'room' ? 'rooms' : 'racks';

        const statement = db.prepare(
            `UPDATE ${table} SET sort_order = ? WHERE id = ?`,
        );
        const transaction = db.transaction(() => {
            for (const item of ctx.data.orders) {
                statement.run(item.order, item.id);
            }
        });

        transaction();
        return { success: true };
    });
