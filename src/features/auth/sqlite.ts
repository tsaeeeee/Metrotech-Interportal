import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * Independent DCIM store. The old data/db.sqlite is deliberately untouched.
 * Fresh V2 install starts with zero datacenters, rooms, racks and assets.
 */
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = process.env.DCIM_DB_PATH || path.join(DATA_DIR, 'dcim.sqlite');
let dbInstance: Database.Database | null = null;

function ensureSchema(db: Database.Database) {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.exec(`
        CREATE TABLE IF NOT EXISTS datacenters (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            code TEXT NOT NULL UNIQUE,
            location TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS floors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            location TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            floor_id TEXT NOT NULL,
            width INTEGER NOT NULL DEFAULT 12,
            height INTEGER NOT NULL DEFAULT 10,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS racks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
            u_capacity INTEGER NOT NULL DEFAULT 42,
            x INTEGER NOT NULL DEFAULT 0,
            y INTEGER NOT NULL DEFAULT 0,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            rack_id TEXT NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
            payload TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS inventory (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS connections (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS dc_planner_floors (
            id TEXT PRIMARY KEY,
            datacenter_id TEXT NOT NULL REFERENCES datacenters(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            grid_width INTEGER NOT NULL DEFAULT 48,
            grid_height INTEGER NOT NULL DEFAULT 22,
            tile_cm INTEGER NOT NULL DEFAULT 60,
            layout_json TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS dc_planner_room_floors (
            room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
            floor_id TEXT NOT NULL REFERENCES dc_planner_floors(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS dc_planner_racks (
            rack_id TEXT PRIMARY KEY REFERENCES racks(id) ON DELETE CASCADE,
            floor_id TEXT NOT NULL REFERENCES dc_planner_floors(id) ON DELETE CASCADE,
            x INTEGER NOT NULL,
            y INTEGER NOT NULL,
            UNIQUE(floor_id, x, y)
        );

        CREATE INDEX IF NOT EXISTS idx_planner_floors_dc ON dc_planner_floors(datacenter_id);
        CREATE INDEX IF NOT EXISTS idx_planner_room_floor ON dc_planner_room_floors(floor_id);
        CREATE INDEX IF NOT EXISTS idx_planner_racks_floor ON dc_planner_racks(floor_id);

        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(floor_id, sort_order);
        CREATE INDEX IF NOT EXISTS idx_racks_room ON racks(room_id, sort_order);
        CREATE INDEX IF NOT EXISTS idx_devices_rack ON devices(rack_id);

        CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(floor_id, sort_order);
        CREATE INDEX IF NOT EXISTS idx_racks_room ON racks(room_id, sort_order);
        CREATE INDEX IF NOT EXISTS idx_devices_rack ON devices(rack_id);
    `);
}

export function getDb(): Database.Database {
    if (!dbInstance) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        dbInstance = new Database(DB_PATH);
        ensureSchema(dbInstance);
    }
    return dbInstance;
}
