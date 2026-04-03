import fs from 'node:fs/promises';
import path from 'node:path';
import { createServerFn } from '@tanstack/react-start';
import type {
    Database,
    DataCenter,
    Device,
    Floor,
    Rack,
    Connection,
} from '#/types/schema';

const DB_PATH = path.resolve(process.cwd(), 'data/db.json');

/**
 * Low-level helper to read the JSON database.
 */
async function readDb(): Promise<Database> {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        const db = JSON.parse(data);
        // Ensure inventory exists
        if (!db.inventory) db.inventory = [];
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
    try {
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error writing DB:', error);
        throw new Error('Database write failed');
    }
}

/**
 * Fetches all available DataCenters.
 */
export const getDatacenters = createServerFn({ method: 'GET' }).handler(
    async (): Promise<DataCenter[]> => {
        const db = await readDb();
        return db.datacenters;
    },
);

/**
 * Fetches all floors for a specific DataCenter.
 */
export const getDcFloors = createServerFn({ method: 'GET' }).handler(
    async (ctx: unknown): Promise<Floor[]> => {
        const { data } = ctx as { data: string };
        const db = await readDb();
        return db.floors.filter((f) => f.datacenterId === data);
    },
);

/**
 * Fetches all racks for a specific floor.
 */
export const getFloorRacks = createServerFn({ method: 'GET' }).handler(
    async (ctx: unknown): Promise<Rack[]> => {
        const { data } = ctx as { data: string };
        const db = await readDb();
        return db.racks.filter((r) => r.floorId === data);
    },
);

/**
 * Fetches a rack and its full hierarchy (DataCenter and Floor) for breadcrumbs.
 */
export const getFullRackContext = createServerFn({ method: 'GET' }).handler(
    async (
        ctx: unknown,
    ): Promise<{
        rack: Rack;
        floor: Floor;
        datacenter: DataCenter;
        devices: Device[];
        connections: Connection[];
    }> => {
        const { data } = ctx as { data: string };
        const db = await readDb();

        const rack = db.racks.find((r) => r.id === data);
        if (!rack) throw new Error('Rack not found');

        const floor = db.floors.find((f) => f.id === rack.floorId);
        if (!floor) throw new Error('Floor not found');

        const datacenter = db.datacenters.find(
            (d) => d.id === floor.datacenterId,
        );
        if (!datacenter) throw new Error('DataCenter not found');

        const devices = db.devices.filter((d) => rack.devices.includes(d.id));

        // Phase 3: Get connections involving these devices
        const portIds = devices.flatMap((d) => d.ports.map((p) => p.id));
        const connections = db.connections.filter(
            (c) => portIds.includes(c.portAId) || portIds.includes(c.portBId),
        );

        return { rack, floor, datacenter, devices, connections };
    },
);

/**
 * Fetches a floor and all its racks/devices for the 2D view.
 */
export const getFullFloorContext = createServerFn({ method: 'GET' }).handler(
    async (
        ctx: unknown,
    ): Promise<{
        floor: Floor;
        racks: Rack[];
        datacenter: DataCenter;
        allDevices: Device[];
        connections: Connection[];
    }> => {
        const { data: floorId } = ctx as { data: string };
        const db = await readDb();

        const floor = db.floors.find((f) => f.id === floorId);
        if (!floor) throw new Error('Floor not found');

        const datacenter = db.datacenters.find(
            (d) => d.id === floor.datacenterId,
        );
        if (!datacenter) throw new Error('DataCenter not found');

        const racks = db.racks.filter((r) => r.floorId === floorId);
        const deviceIds = racks.flatMap((r) => r.devices);
        const allDevices = db.devices.filter((d) => deviceIds.includes(d.id));

        // Phase 3: Get all connections on this floor
        const portIds = allDevices.flatMap((d) => d.ports.map((p) => p.id));
        const connections = db.connections.filter(
            (c) => portIds.includes(c.portAId) || portIds.includes(c.portBId),
        );

        return { floor, racks, datacenter, allDevices, connections };
    },
);

/**
 * Updates the devices within a rack.
 */
export const updateRackDevices = createServerFn({ method: 'POST' }).handler(
    async (ctx: unknown): Promise<{ success: boolean }> => {
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
    async (ctx: any): Promise<{ success: boolean; device: Device }> => {
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
    async (ctx: any): Promise<{ success: boolean }> => {
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
        const portIds = device.ports.map((p) => p.id);
        db.connections = db.connections.filter(
            (c) => !portIds.includes(c.portAId) && !portIds.includes(c.portBId),
        );

        await writeDb(db);
        return { success: true };
    },
);

/**
 * Updates a rack's (X, Y) position on the floor grid.
 */
export const updateRackPosition = createServerFn({ method: 'POST' }).handler(
    async (ctx: any): Promise<{ success: boolean }> => {
        const { data } = ctx;
        const db = await readDb();

        const rack = db.racks.find((r) => r.id === data.rackId);
        if (!rack) throw new Error('Rack not found');

        rack.x = data.x;
        rack.y = data.y;

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
            for (const port of device.ports) {
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
        const { data: connectionId } = ctx;
        const db = await readDb();

        const connection = db.connections.find((c) => c.id === connectionId);
        if (!connection) throw new Error('Connection not found');

        // Free ports
        for (const device of db.devices) {
            for (const port of device.ports) {
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
