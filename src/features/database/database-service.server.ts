import fs from 'node:fs/promises';
import path from 'node:path';
import { createServerFn } from '@tanstack/react-start';
import type { Database, DataCenter, Device, Floor, Rack } from '#/types/schema';

const DB_PATH = path.resolve(process.cwd(), 'data/db.json');

/**
 * Low-level helper to read the JSON database.
 */
async function readDb(): Promise<Database> {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        return JSON.parse(data);
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
 * Fetches a rack and its associated devices.
 */
export const getRackDetails = createServerFn({ method: 'GET' }).handler(
    async (ctx: unknown): Promise<Rack & { deviceObjects: Device[] }> => {
        const { data } = ctx as { data: string };
        const db = await readDb();
        const rack = db.racks.find((r) => r.id === data);
        if (!rack) throw new Error('Rack not found');

        const deviceObjects = db.devices.filter((d) =>
            rack.devices.includes(d.id),
        );
        return { ...rack, deviceObjects };
    },
);

/**
 * Updates the devices within a rack (used for drag-and-drop persistence).
 */
export const updateRackDevices = createServerFn({ method: 'POST' }).handler(
    async (ctx: unknown): Promise<{ success: boolean }> => {
        const { data } = ctx as { data: { rackId: string; devices: Device[] } };
        const { rackId, devices } = data;
        const db = await readDb();

        // Update devices list (replaces or adds)
        const otherDevices = db.devices.filter((d) => d.rackId !== rackId);
        db.devices = [...otherDevices, ...devices];

        // Update the rack's device ID pointer list
        const rackIndex = db.racks.findIndex((r) => r.id === rackId);
        if (rackIndex !== -1) {
            db.racks[rackIndex].devices = devices.map((d) => d.id);
        }

        await writeDb(db);
        return { success: true };
    },
);
