import fs from 'node:fs/promises';
import path from 'node:path';
import { createServerFn } from '@tanstack/react-start';
import type {
    Connection,
    Database,
    Device,
    Floor,
    Rack,
    Room,
} from '#/types/schema';
import { getSession } from '../auth/auth-service';
import { getDb as getSqliteDb } from '../auth/sqlite';

const DB_PATH = path.resolve(process.cwd(), 'data/db.json');

let cachedDb: Database | null = null;

async function requireAuth() {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');
    return session;
}

/**
 * Low-level helper to read the JSON database.
 */
async function readDb(): Promise<Database> {
    if (cachedDb) return cachedDb;
    try {
        try {
            await fs.access(DB_PATH);
        } catch {
            // File doesn't exist, return empty structure
            const emptyDb: Database = {
                floors: [],
                rooms: [],
                racks: [],
                devices: [],
                connections: [],
                inventory: [],
            };
            await writeDb(emptyDb);
            return emptyDb;
        }

        const data = await fs.readFile(DB_PATH, 'utf-8');
        const db = JSON.parse(data);

        // Ensure arrays exist
        if (!db.floors) db.floors = [];
        if (!db.rooms) db.rooms = [];
        if (!db.racks) db.racks = [];
        if (!db.devices) db.devices = [];
        if (!db.connections) db.connections = [];
        if (!db.inventory) db.inventory = [];

        // Automatic migration for 'order' property
        db.rooms = db.rooms.map((r: Room, i: number) => ({
            ...r,
            order: r.order ?? i + 1,
        }));
        db.racks = db.racks.map((r: Rack, i: number) => ({
            ...r,
            order: r.order ?? i + 1,
        }));

        cachedDb = db;
        return db;
    } catch (error) {
        console.error('Error reading DB:', error);
        throw new Error('Database read failed');
    }
}

/**
 * Low-level helper to write to the JSON database.
 */
async function writeDb(data: Database): Promise<void> {
    cachedDb = data;
    try {
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error writing DB:', error);
        throw new Error('Database write failed');
    }
}

/**
 * Fetches all available Floors.
 */
export const getFloors = createServerFn({ method: 'GET' }).handler(
    async (): Promise<Floor[]> => {
        const db = await readDb();
        const sqlite = getSqliteDb();
        
        // Map SQLite Datacenters to Floors
        const dcs = sqlite.prepare('SELECT id, name, code FROM datacenters').all() as { id: string; name: string; code: string }[];
        const dynamicFloors = dcs.map(dc => ({
            id: dc.code,
            name: dc.name
        }));
        
        // Merge with existing floors
        const combined = [...dynamicFloors];
        for (const f of (db.floors || [])) {
            if (!combined.find(df => df.id === f.id)) combined.push(f);
        }
        return combined;
    },
);

/**
 * Fetches all rooms for a specific Floor.
 */
export const getFloorRooms = createServerFn({ method: 'GET' }).handler(
    async (ctx: unknown): Promise<Room[]> => {
        const { data } = ctx as { data: string };
        const db = await readDb();
        return db.rooms.filter((r) => r.floorId === data);
    },
);

/**
 * Fetches all racks for a specific room.
 */
export const getRoomRacks = createServerFn({ method: 'GET' }).handler(
    async (ctx: unknown): Promise<Rack[]> => {
        const { data } = ctx as { data: string };
        const db = await readDb();
        return db.racks.filter((r) => r.roomId === data);
    },
);

/**
 * Fetches a rack and its full hierarchy (Room and Floor) for breadcrumbs.
 */
export const getFullRackContext = createServerFn({ method: 'GET' }).handler(
    async (
        ctx: unknown,
    ): Promise<{
        rack: Rack;
        room: Room;
        floor: Floor;
        devices: Device[];
        connections: Connection[];
    }> => {
        const { data } = ctx as { data: string };
        const db = await readDb();

        const rack = db.racks.find((r) => r.id === data);
        if (!rack) throw new Error('Rack not found');

        const room = db.rooms.find((r) => r.id === rack.roomId);
        if (!room) throw new Error('Room not found');

        let floor = db.floors.find((f) => f.id === room.floorId);
        if (!floor) {
            const sqlite = getSqliteDb();
            const dcs = sqlite.prepare('SELECT id, name, code FROM datacenters').all() as { id: string; name: string; code: string }[];
            floor = dcs.map(dc => ({ id: dc.code, name: dc.name })).find(df => df.id === room.floorId);
        }
        if (!floor) throw new Error('Floor not found');

        const devices = db.devices.filter((d) => rack.devices.includes(d.id));

        // Phase 3: Get connections involving these devices
        const portIds = devices.flatMap((d) =>
            (d.ports || []).map((p) => p.id),
        );
        const connections = db.connections.filter(
            (c) => portIds.includes(c.portAId) || portIds.includes(c.portBId),
        );

        return { rack, room, floor, devices, connections };
    },
);

/**
 * Fetches a room and all its racks/devices for the 2D view.
 */
export const getFullRoomContext = createServerFn({ method: 'GET' }).handler(
    async (
        ctx: unknown,
    ): Promise<{
        room: Room;
        racks: Rack[];
        floor: Floor;
        allDevices: Device[];
        connections: Connection[];
    }> => {
        const { data: roomId } = ctx as { data: string };
        const db = await readDb();

        const room = db.rooms.find((r) => r.id === roomId);
        if (!room) throw new Error('Room not found');

        let floor = db.floors.find((f) => f.id === room.floorId);
        if (!floor) {
            const sqlite = getSqliteDb();
            const dcs = sqlite.prepare('SELECT id, name, code FROM datacenters').all() as { id: string; name: string; code: string }[];
            floor = dcs.map(dc => ({ id: dc.code, name: dc.name })).find(df => df.id === room.floorId);
        }
        if (!floor) throw new Error('Floor not found');

        const racks = db.racks.filter((r) => r.roomId === roomId);
        const deviceIds = racks.flatMap((r) => r.devices);
        const allDevices = db.devices.filter((d) => deviceIds.includes(d.id));

        // Phase 3: Get all connections on this room
        const portIds = allDevices.flatMap((d) =>
            (d.ports || []).map((p) => p.id),
        );
        const connections = db.connections.filter(
            (c) => portIds.includes(c.portAId) || portIds.includes(c.portBId),
        );

        return { room, racks, floor, allDevices, connections };
    },
);

/**
 * Updates the devices within a rack.
 */
export const updateRackDevices = createServerFn({ method: 'POST' }).handler(
    async (ctx: unknown): Promise<{ success: boolean }> => {
        await requireAuth();
        const { data } = ctx as { data: { rackId: string; devices: Device[] } };
        const { rackId, devices } = data;
        const db = await readDb();

        const otherDevices = db.devices.filter((d) => d.rackId !== rackId);
        db.devices = [...otherDevices, ...devices];

        const rack = db.racks.find((r) => r.id === rackId);
        if (rack) {
            rack.devices = devices.map((d) => d.id);
        }

        await writeDb(db);
        return { success: true };
    },
);

/**
 * Single function to Add or Update a device.
 */
export const upsertDevice = createServerFn({ method: 'POST' }).handler(
    async (ctx: { data: Device }): Promise<{ success: boolean; device: Device }> => {
        await requireAuth();
        const { data: device } = ctx;
        const db = await readDb();

        const index = db.devices.findIndex((d) => d.id === device.id);
        if (index !== -1) {
            db.devices[index] = device;
        } else {
            db.devices.push(device);
        }

        // Ensure the rack's device list is in sync
        const rack = db.racks.find((r) => r.id === device.rackId);
        if (rack && !rack.devices.includes(device.id)) {
            rack.devices.push(device.id);
        }

        await writeDb(db);
        return { success: true, device };
    },
);

/**
 * Removes a device from the database and its parent rack.
 */
export const deleteDevice = createServerFn({ method: 'POST' }).handler(
    async (ctx: { data: string }): Promise<{ success: boolean }> => {
        await requireAuth();
        const { data: deviceId } = ctx;
        const db = await readDb();

        const device = db.devices.find((d) => d.id === deviceId);
        if (!device) throw new Error('Device not found');

        db.devices = db.devices.filter((d) => d.id !== deviceId);

        const rack = db.racks.find((r) => r.id === device.rackId);
        if (rack) {
            rack.devices = rack.devices.filter((id) => id !== deviceId);
        }

        // Phase 3: Cleanup connections involving this device
        const portIds = (device.ports || []).map((p) => p.id);
        db.connections = db.connections.filter(
            (c) => !portIds.includes(c.portAId) && !portIds.includes(c.portBId),
        );

        await writeDb(db);
        return { success: true };
    },
);

/**
 * Updates a rack's (X, Y) position on the room grid.
 */
export const updateRackPosition = createServerFn({ method: 'POST' }).handler(
    async (ctx: {
        data: { id: string; x: number; y: number };
    }): Promise<{ success: boolean }> => {
        await requireAuth();
        const { id, x, y } = ctx.data;
        const db = await readDb();

        const rack = db.racks.find((r) => r.id === id);
        if (!rack) throw new Error('Rack not found');

        rack.x = x;
        rack.y = y;

        await writeDb(db);
        return { success: true };
    },
);

/**
 * Creates an interactive point-to-point cable connection between two ports.
 */
export const connectPorts = createServerFn({ method: 'POST' }).handler(
    async (ctx: {
        data: { portAId: string; portBId: string; type: string };
    }): Promise<{ success: boolean; connection: Connection }> => {
        await requireAuth();
        const { data } = ctx;
        const db = await readDb();

        // Check if ports are already occupied
        const existing = db.connections.find(
            (c) =>
                c.portAId === data.portAId ||
                c.portBId === data.portAId ||
                c.portAId === data.portBId ||
                c.portBId === data.portBId,
        );
        if (existing)
            throw new Error('One or both ports are already connected');

        const connection: Connection = {
            id: crypto.randomUUID(),
            portAId: data.portAId,
            portBId: data.portBId,
            type: data.type,
            status: 'active',
            color: data.type === 'fiber' ? '#f59e0b' : '#3b82f6', // Orange for fiber, Blue for copper
        };

        db.connections.push(connection);

        // Update port statuses
        for (const device of db.devices) {
            for (const port of device.ports || []) {
                if (port.id === data.portAId || port.id === data.portBId) {
                    port.status = 'plugged';
                }
            }
        }

        await writeDb(db);
        return { success: true, connection };
    },
);

/**
 * Removes a cable connection and frees up the ports.
 */
export const disconnectPorts = createServerFn({ method: 'POST' }).handler(
    async (ctx: { data: string }): Promise<{ success: boolean }> => {
        await requireAuth();
        const { data: connectionId } = ctx;
        const db = await readDb();

        const connection = db.connections.find((c) => c.id === connectionId);
        if (!connection) throw new Error('Connection not found');

        // Free ports
        for (const device of db.devices) {
            for (const port of device.ports || []) {
                if (
                    port.id === connection.portAId ||
                    port.id === connection.portBId
                ) {
                    port.status = 'up'; // Or whatever default 'available' status is
                }
            }
        }

        db.connections = db.connections.filter((c) => c.id !== connectionId);

        await writeDb(db);
        return { success: true };
    },
);

/**
 * Fetches the user's library of master assets.
 */
export const getInventory = createServerFn({ method: 'GET' }).handler(
    async (): Promise<Device[]> => {
        const db = await readDb();
        return db.inventory || [];
    },
);

/**
 * Adds or updates a master asset in the palette.
 */
export const upsertInventoryAsset = createServerFn({ method: 'POST' }).handler(
    async (ctx: {
        data: Device;
    }): Promise<{ success: boolean; device: Device }> => {
        await requireAuth();
        const { data: asset } = ctx;
        const db = await readDb();

        if (!db.inventory) db.inventory = [];

        const index = db.inventory.findIndex((a) => a.id === asset.id);
        if (index !== -1) {
            db.inventory[index] = asset;
        } else {
            db.inventory.push(asset);
        }

        await writeDb(db);
        return { success: true, device: asset };
    },
);

/**
 * Removes a master asset from the palette.
 */
export const deleteInventoryAsset = createServerFn({ method: 'POST' }).handler(
    async (ctx: { data: string }): Promise<{ success: boolean }> => {
        await requireAuth();
        const { data: assetId } = ctx;
        const db = await readDb();

        db.inventory = (db.inventory || []).filter((a) => a.id !== assetId);

        await writeDb(db);
        return { success: true };
    },
);

/**
 * Clones a master asset in the palette.
 */
export const duplicateInventoryAsset = createServerFn({
    method: 'POST',
}).handler(
    async (ctx: {
        data: string;
    }): Promise<{ success: boolean; device: Device }> => {
        await requireAuth();
        const { data: assetId } = ctx;
        const db = await readDb();

        const original = db.inventory.find((a) => a.id === assetId);
        if (!original) throw new Error('Asset not found');

        const clone: Device = {
            ...original,
            id: crypto.randomUUID(),
            name: `${original.name} (Copy)`,
            assetTag: original.assetTag ? `${original.assetTag}-COPY` : 'COPY',
        };

        db.inventory.push(clone);
        await writeDb(db);
        return { success: true, device: clone };
    },
);

/**
 * Creates a new Room in the database.
 */
export const createRoom = createServerFn({ method: 'POST' }).handler(
    async (ctx: {
        data: { name: string; floorId: string; width: number; height: number };
    }): Promise<{ success: boolean; room: Room }> => {
        await requireAuth();
        const { data } = ctx;
        const db = await readDb();
        const crypto = await import('node:crypto');

        const newRoom: Room = {
            id: `rm-${crypto.randomUUID()}`,
            name: data.name,
            floorId: data.floorId,
            width: data.width,
            height: data.height,
            order:
                (db.rooms.length > 0
                    ? Math.max(...db.rooms.map((r) => r.order || 0))
                    : 0) + 1,
        };

        db.rooms.push(newRoom);
        await writeDb(db);
        return { success: true, room: newRoom };
    },
);

/**
 * Creates a new Rack in the database.
 */
export const createRack = createServerFn({ method: 'POST' }).handler(
    async (ctx: {
        data: {
            name: string;
            roomId: string;
            uCapacity: number;
            x: number;
            y: number;
        };
    }): Promise<{ success: boolean; rack: Rack }> => {
        await requireAuth();
        const { data } = ctx;
        const db = await readDb();
        const crypto = await import('node:crypto');

        const newRack: Rack = {
            id: `rk-${crypto.randomUUID()}`,
            name: data.name,
            roomId: data.roomId,
            uCapacity: data.uCapacity,
            devices: [],
            x: data.x,
            y: data.y,
            order:
                (db.racks.filter((r) => r.roomId === data.roomId).length > 0
                    ? Math.max(
                          ...db.racks
                              .filter((r) => r.roomId === data.roomId)
                              .map((r) => r.order || 0),
                      )
                    : 0) + 1,
        };

        db.racks.push(newRack);
        await writeDb(db);
        return { success: true, rack: newRack };
    },
);

/**
 * Fetches all floors, rooms, and racks for the infrastructure navigator.
 */
export const getInfrastructureSummary = createServerFn({
    method: 'GET',
}).handler(
    async (): Promise<{
        floors: Floor[];
        rooms: Room[];
        racks: Rack[];
    }> => {
        const db = await readDb();
        const sqlite = getSqliteDb();
        
        // Map SQLite Datacenters to Floors
        const dcs = sqlite.prepare('SELECT id, name, code FROM datacenters').all() as { id: string; name: string; code: string }[];
        const dynamicFloors = dcs.map(dc => ({
            id: dc.code,
            name: dc.name
        }));
        
        // Merge with existing floors
        const combined = [...dynamicFloors];
        for (const f of (db.floors || [])) {
            if (!combined.find(df => df.id === f.id)) combined.push(f);
        }

        return {
            floors: combined,
            rooms: (db.rooms || []).sort(
                (a, b) => (a.order || 0) - (b.order || 0),
            ),
            racks: (db.racks || []).sort(
                (a, b) => (a.order || 0) - (b.order || 0),
            ),
        };
    },
);

/**
 * Updates a Room's properties.
 */
export const updateRoom = createServerFn({ method: 'POST' }).handler(
    async (ctx: {
        data: { id: string; name: string };
    }): Promise<{ success: boolean }> => {
        await requireAuth();
        const { data } = ctx;
        const db = await readDb();
        const room = db.rooms.find((r) => r.id === data.id);
        if (!room) throw new Error('Room not found');
        room.name = data.name;
        await writeDb(db);
        return { success: true };
    },
);

/**
 * Deletes a Room and all its nested Racks and Devices.
 */
export const deleteRoom = createServerFn({ method: 'POST' }).handler(
    async (ctx: { data: string }): Promise<{ success: boolean }> => {
        await requireAuth();
        const { data: roomId } = ctx;
        const db = await readDb();

        // 1. Find all racks in this room
        const roomRacks = db.racks.filter((r) => r.roomId === roomId);
        const _rackIds = roomRacks.map((r) => r.id);

        // 2. Find all devices in those racks
        const deviceIds = roomRacks.flatMap((r) => r.devices);

        // 3. Remove connections involving those devices
        const devicePorts = db.devices
            .filter((d) => deviceIds.includes(d.id))
            .flatMap((d) => (d.ports || []).map((p) => p.id));

        db.connections = db.connections.filter(
            (c) =>
                !devicePorts.includes(c.portAId) &&
                !devicePorts.includes(c.portBId),
        );

        // 4. Remove devices, racks, and room
        db.devices = db.devices.filter((d) => !deviceIds.includes(d.id));
        db.racks = db.racks.filter((r) => r.roomId !== roomId);
        db.rooms = db.rooms.filter((r) => r.id !== roomId);

        await writeDb(db);
        return { success: true };
    },
);

/**
 * Updates a Rack's properties (Name, Capacity).
 */
export const updateRack = createServerFn({ method: 'POST' }).handler(
    async (ctx: {
        data: { id: string; name: string; uCapacity: number };
    }): Promise<{ success: boolean }> => {
        await requireAuth();
        const { data } = ctx;
        const db = await readDb();
        const rack = db.racks.find((r) => r.id === data.id);
        if (!rack) throw new Error('Rack not found');
        rack.name = data.name;
        rack.uCapacity = data.uCapacity;
        await writeDb(db);
        return { success: true };
    },
);

/**
 * Deletes a Rack and all its Devices.
 */
export const deleteRack = createServerFn({ method: 'POST' }).handler(
    async (ctx: { data: string }): Promise<{ success: boolean }> => {
        await requireAuth();
        const { data: rackId } = ctx;
        const db = await readDb();

        const rack = db.racks.find((r) => r.id === rackId);
        if (!rack) throw new Error('Rack not found');

        const deviceIds = rack.devices;

        // Cleanup connections
        const devicePorts = db.devices
            .filter((d) => deviceIds.includes(d.id))
            .flatMap((d) => (d.ports || []).map((p) => p.id));

        db.connections = db.connections.filter(
            (c) =>
                !devicePorts.includes(c.portAId) &&
                !devicePorts.includes(c.portBId),
        );

        db.devices = db.devices.filter((d) => !deviceIds.includes(d.id));
        db.racks = db.racks.filter((r) => r.id !== rackId);

        await writeDb(db);
        return { success: true };
    },
);

/**
 * Updates the order of rooms or racks.
 */
export const updateEntityOrder = createServerFn({ method: 'POST' }).handler(
    async (ctx: {
        data: {
            type: 'room' | 'rack';
            orders: { id: string; order: number }[];
        };
    }): Promise<{ success: boolean }> => {
        await requireAuth();
        const { type, orders } = ctx.data;
        const db = await readDb();

        if (type === 'room') {
            orders.forEach(({ id, order }) => {
                const room = db.rooms.find((r) => r.id === id);
                if (room) room.order = order;
            });
        } else {
            orders.forEach(({ id, order }) => {
                const rack = db.racks.find((r) => r.id === id);
                if (rack) rack.order = order;
            });
        }

        await writeDb(db);
        return { success: true };
    },
);
