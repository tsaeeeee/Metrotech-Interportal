import { createServerFn } from '@tanstack/react-start';
import { randomUUID } from 'node:crypto';
import { getSession } from '../auth/auth-service';
import { getDb } from '../auth/sqlite';
import type { PlannerCell, PlannerFloor, PlannerLayout, PlannerOverview, PlannerRack, PlannerRoom } from './types';

type DbFloor = {
    id: string;
    datacenter_id: string;
    name: string;
    grid_width: number;
    grid_height: number;
    tile_cm: number;
    layout_json: string;
    version: number;
};

const EMPTY_LAYOUT: PlannerLayout = {
    runners: [],
    perforated: [],
    walls: [],
    blocked: [],
    entries: [],
};

function parseLayout(value: string): PlannerLayout {
    try {
        const data = JSON.parse(value) as Partial<PlannerLayout>;
        return {
            runners: Array.isArray(data.runners) ? data.runners : [],
            perforated: Array.isArray(data.perforated) ? data.perforated : [],
            walls: Array.isArray(data.walls) ? data.walls : [],
            blocked: Array.isArray(data.blocked) ? data.blocked : [],
            entries: Array.isArray(data.entries) ? data.entries : [],
        };
    } catch {
        return { ...EMPTY_LAYOUT };
    }
}

function toFloor(row: DbFloor): PlannerFloor {
    return {
        id: row.id,
        datacenterId: row.datacenter_id,
        name: row.name,
        gridWidth: row.grid_width,
        gridHeight: row.grid_height,
        tileCm: row.tile_cm,
        layout: parseLayout(row.layout_json),
        version: row.version,
    };
}

async function ownedDc(dcId: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');
    const dc = getDb().prepare(
        'SELECT id, name, code, location FROM datacenters WHERE id = ? AND owner_id = ?',
    ).get(dcId, session.user.id) as
        | { id: string; name: string; code: string; location: string }
        | undefined;
    if (!dc) throw new Error('Datacenter not found');
    return dc;
}

async function ownedFloor(floorId: string) {
    const session = await getSession();
    if (!session) throw new Error('Unauthorized');
    const row = getDb().prepare(
        `SELECT f.* FROM dc_planner_floors f
         JOIN datacenters d ON d.id = f.datacenter_id
         WHERE f.id = ? AND d.owner_id = ?`,
    ).get(floorId, session.user.id) as DbFloor | undefined;
    if (!row) throw new Error('Floor not found');
    return row;
}

function validCell(cell: PlannerCell, floor: DbFloor): boolean {
    if (!cell || typeof cell !== 'object') return false;
    return (
        Number.isInteger(cell.x) &&
        Number.isInteger(cell.y) &&
        cell.x >= 0 &&
        cell.y >= 0 &&
        cell.x < floor.grid_width &&
        cell.y < floor.grid_height
    );
}

function cellKey(cell: PlannerCell) {
    return `${cell.x},${cell.y}`;
}

function assertAvailableTile(floor: DbFloor, x: number, y: number, rackId?: string) {
    const cell = { x, y };
    if (!validCell(cell, floor)) throw new Error('Position is outside the floor grid');

    const layout = parseLayout(floor.layout_json);
    if (
        layout.walls.some((item) => cellKey(item) === cellKey(cell)) ||
        layout.blocked.some((item) => cellKey(item) === cellKey(cell))
    ) {
        throw new Error('Walls and blocked areas cannot contain racks');
    }

    const row = getDb().prepare(
        'SELECT rack_id FROM dc_planner_racks WHERE floor_id = ? AND x = ? AND y = ?',
    ).get(floor.id, x, y) as { rack_id: string } | undefined;
    if (row && row.rack_id !== rackId) throw new Error('This grid tile already has a rack');
}

export const getPlannerOverview = createServerFn({ method: 'GET' })
    .inputValidator((data: { dcId: string }) => data)
    .handler(async ({ data }): Promise<PlannerOverview> => {
        const dc = await ownedDc(data.dcId);
        const db = getDb();

        const ensure = db.transaction(() => {
            const defaultId = `floor-${dc.id}`;
            const existing = db.prepare(
                'SELECT id FROM dc_planner_floors WHERE datacenter_id = ? ORDER BY created_at, id LIMIT 1',
            ).get(dc.id) as { id: string } | undefined;
            if (!existing) {
                db.prepare(
                    `INSERT OR IGNORE INTO dc_planner_floors
                     (id, datacenter_id, name, grid_width, grid_height, tile_cm, layout_json, version, created_at)
                     VALUES (?, ?, 'Floor 1', 48, 22, 60, ?, 0, ?)`,
                ).run(defaultId, dc.id, JSON.stringify(EMPTY_LAYOUT), Date.now());
            }
            const firstFloor = existing?.id ?? defaultId;
            // Preserve existing rooms: assign unassigned rooms to the first floor.
            db.prepare(
                `INSERT OR IGNORE INTO dc_planner_room_floors (room_id, floor_id)
                 SELECT r.id, ? FROM rooms r WHERE r.floor_id = ?`,
            ).run(firstFloor, dc.code);
        });
        ensure();

        const floors = (db.prepare(
            'SELECT * FROM dc_planner_floors WHERE datacenter_id = ? ORDER BY created_at, id',
        ).all(dc.id) as DbFloor[]).map(toFloor);

        const rooms = db.prepare(
            `SELECT r.id, r.name, r.floor_id AS dc_code, m.floor_id AS planner_floor_id
             FROM rooms r
             JOIN dc_planner_room_floors m ON m.room_id = r.id
             JOIN dc_planner_floors f ON f.id = m.floor_id
             WHERE f.datacenter_id = ?
             ORDER BY f.created_at, r.sort_order, r.name`,
        ).all(dc.id) as { id: string; name: string; dc_code: string; planner_floor_id: string }[];

        const racks = db.prepare(
            `SELECT r.id, r.name, r.room_id, r.u_capacity, COUNT(d.id) AS device_count,
                    p.floor_id, p.x, p.y
             FROM racks r
             JOIN dc_planner_room_floors rf ON rf.room_id = r.room_id
             JOIN dc_planner_floors f ON f.id = rf.floor_id
             LEFT JOIN dc_planner_racks p ON p.rack_id = r.id
             LEFT JOIN devices d ON d.rack_id = r.id
             WHERE f.datacenter_id = ?
             GROUP BY r.id
             ORDER BY r.name`,
        ).all(dc.id) as {
            id: string; name: string; room_id: string; u_capacity: number;
            device_count: number; floor_id: string | null; x: number | null; y: number | null;
        }[];

        return {
            datacenter: dc,
            floors,
            rooms: rooms.map((room): PlannerRoom => ({
                id: room.id,
                name: room.name,
                floorId: room.planner_floor_id,
            })),
            racks: racks.map((rack): PlannerRack => ({
                id: rack.id,
                name: rack.name,
                roomId: rack.room_id,
                floorId: rack.floor_id ?? null,
                uCapacity: rack.u_capacity,
                deviceCount: rack.device_count,
                x: rack.x,
                y: rack.y,
            })),
        };
    });

export const addPlannerFloor = createServerFn({ method: 'POST' })
    .inputValidator(
        (data: { dcId: string; name: string; gridWidth: number; gridHeight: number; tileCm: number }) => data,
    )
    .handler(async ({ data }) => {
        const dc = await ownedDc(data.dcId);
        const name = data.name.trim();
        if (!name || name.length > 80) throw new Error('Floor name must contain 1–80 characters');
        if (!Number.isInteger(data.gridWidth) || data.gridWidth < 10 || data.gridWidth > 100 ||
            !Number.isInteger(data.gridHeight) || data.gridHeight < 10 || data.gridHeight > 80) {
            throw new Error('Floor grid must be between 10×10 and 100×80');
        }
        if (!Number.isInteger(data.tileCm) || data.tileCm < 10 || data.tileCm > 200) {
            throw new Error('Tile size must be between 10 and 200 cm');
        }
        const id = `floor-${randomUUID()}`;
        const db = getDb();
        const exists = db.prepare(
            'SELECT id FROM dc_planner_floors WHERE datacenter_id = ? AND lower(name) = lower(?)',
        ).get(dc.id, name);
        if (exists) throw new Error('This floor name already exists');
        db.prepare(
            `INSERT INTO dc_planner_floors
             (id, datacenter_id, name, grid_width, grid_height, tile_cm, layout_json, version, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        ).run(id, dc.id, name, data.gridWidth, data.gridHeight, data.tileCm,
            JSON.stringify(EMPTY_LAYOUT), Date.now());
        return { id };
    });

export const addPlannerRoom = createServerFn({ method: 'POST' })
    .inputValidator((data: { floorId: string; name: string }) => data)
    .handler(async ({ data }) => {
        const floor = await ownedFloor(data.floorId);
        const name = data.name.trim();
        if (!name || name.length > 80) throw new Error('Room name must contain 1–80 characters');
        const db = getDb();
        const dc = db.prepare('SELECT code FROM datacenters WHERE id = ?')
            .get(floor.datacenter_id) as { code: string };
        const id = `rm-${randomUUID()}`;
        db.transaction(() => {
            const max = db.prepare(
                'SELECT COALESCE(MAX(sort_order), 0) AS value FROM rooms WHERE floor_id = ?',
            ).get(dc.code) as { value: number };
            db.prepare(
                'INSERT INTO rooms (id, name, floor_id, width, height, sort_order) VALUES (?, ?, ?, 12, 10, ?)',
            ).run(id, name, dc.code, max.value + 1);
            db.prepare(
                'INSERT INTO dc_planner_room_floors (room_id, floor_id) VALUES (?, ?)',
            ).run(id, floor.id);
        })();
        return { id };
    });

export const addPlannerRack = createServerFn({ method: 'POST' })
    .inputValidator((data: {
        floorId: string; roomId: string; name: string;
        uCapacity: number; x: number; y: number;
    }) => data)
    .handler(async ({ data }) => {
        const floor = await ownedFloor(data.floorId);
        if (![42, 48, 52].includes(data.uCapacity)) throw new Error('Choose 42U, 48U, or 52U');
        const name = data.name.trim();
        if (!name || name.length > 80) throw new Error('Rack name must contain 1–80 characters');

        const db = getDb();
        const room = db.prepare(
            `SELECT r.id, r.width, r.height FROM rooms r
             JOIN dc_planner_room_floors rf ON rf.room_id = r.id
             WHERE r.id = ? AND rf.floor_id = ?`,
        ).get(data.roomId, floor.id) as { id: string; width: number; height: number } | undefined;
        if (!room) throw new Error('Select a room belonging to this floor');
        const id = `rk-${randomUUID()}`;

        db.transaction(() => {
            assertAvailableTile(floor, data.x, data.y);
            const occupied = new Set(
                (db.prepare('SELECT x, y FROM racks WHERE room_id = ?')
                    .all(room.id) as { x: number; y: number }[])
                    .map((item) => `${item.x},${item.y}`),
            );
            let roomX = -1;
            let roomY = -1;
            for (let y = 0; y < room.height && roomX < 0; y += 1) {
                for (let x = 0; x < room.width; x += 1) {
                    if (!occupied.has(`${x},${y}`)) {
                        roomX = x; roomY = y; break;
                    }
                }
            }
            if (roomX < 0) throw new Error('No free logical rack slots in this room');
            const max = db.prepare(
                'SELECT COALESCE(MAX(sort_order), 0) AS value FROM racks WHERE room_id = ?',
            ).get(room.id) as { value: number };
            db.prepare(
                `INSERT INTO racks (id, name, room_id, u_capacity, x, y, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ).run(id, name, room.id, data.uCapacity, roomX, roomY, max.value + 1);
            db.prepare(
                'INSERT INTO dc_planner_racks (rack_id, floor_id, x, y) VALUES (?, ?, ?, ?)',
            ).run(id, floor.id, data.x, data.y);
        })();
        return { id };
    });

export const placePlannerRack = createServerFn({ method: 'POST' })
    .inputValidator(
        (data: { floorId: string; rackId: string; x: number; y: number }) => data,
    )
    .handler(async ({ data }) => {
        const floor = await ownedFloor(data.floorId);
        const db = getDb();
        const belongs = db.prepare(
            `SELECT r.id FROM racks r
             JOIN dc_planner_room_floors rf ON rf.room_id = r.room_id
             WHERE r.id = ? AND rf.floor_id = ?`,
        ).get(data.rackId, floor.id);
        if (!belongs) throw new Error('Rack does not belong to this floor');
        db.transaction(() => {
            assertAvailableTile(floor, data.x, data.y, data.rackId);
            db.prepare(
                `INSERT INTO dc_planner_racks (rack_id, floor_id, x, y)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(rack_id) DO UPDATE SET
                   floor_id = excluded.floor_id, x = excluded.x, y = excluded.y`,
            ).run(data.rackId, floor.id, data.x, data.y);
        })();
        return { success: true };
    });

export const unplacePlannerRack = createServerFn({ method: 'POST' })
    .inputValidator((data: { floorId: string; rackId: string }) => data)
    .handler(async ({ data }) => {
        const floor = await ownedFloor(data.floorId);
        const db = getDb();
        db.prepare(
            'DELETE FROM dc_planner_racks WHERE rack_id = ? AND floor_id = ?',
        ).run(data.rackId, floor.id);
        return { success: true };
    });

export const savePlannerLayout = createServerFn({ method: 'POST' })
    .inputValidator(
        (data: { floorId: string; layout: PlannerLayout; expectedVersion: number }) => data,
    )
    .handler(async ({ data }) => {
        const floor = await ownedFloor(data.floorId);
        const db = getDb();
        if (!Number.isInteger(data.expectedVersion) || data.expectedVersion < 0) {
            throw new Error('Invalid floor layout version');
        }

        const layout: PlannerLayout = {
            runners: [], perforated: [], walls: [], blocked: [], entries: [],
        };
        for (const layer of Object.keys(layout) as (keyof PlannerLayout)[]) {
            const points = data.layout?.[layer];
            if (!Array.isArray(points) || points.length > floor.grid_width * floor.grid_height) {
                throw new Error(`Invalid ${layer} layer`);
            }
            const seen = new Set<string>();
            for (const point of points) {
                if (!validCell(point, floor)) throw new Error(`Invalid ${layer} coordinate`);
                const key = cellKey(point);
                if (!seen.has(key)) {
                    layout[layer].push({ x: point.x, y: point.y });
                    seen.add(key);
                }
            }
        }

        const restricted = new Set([
            ...layout.walls.map(cellKey),
            ...layout.blocked.map(cellKey),
        ]);
        const positionedRacks = db.prepare(
            'SELECT x, y FROM dc_planner_racks WHERE floor_id = ?',
        ).all(floor.id) as PlannerCell[];
        if (positionedRacks.some((rack) => restricted.has(cellKey(rack)))) {
            throw new Error('Move racks before placing a wall or blocked area on them');
        }
        const result = db.prepare(
            `UPDATE dc_planner_floors SET layout_json = ?, version = version + 1
             WHERE id = ? AND version = ?`,
        ).run(JSON.stringify(layout), floor.id, data.expectedVersion);
        if (result.changes === 0) {
            throw new Error('Floor layout changed elsewhere. Reload before saving');
        }
        return { version: data.expectedVersion + 1 };
    });
