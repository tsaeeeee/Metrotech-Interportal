import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Database as LegacyDatabase, Device } from '#/types/schema';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.sqlite');
const LEGACY_JSON_PATH = path.join(DATA_DIR, 'db.json');

let dbInstance: Database.Database | null = null;

function ensureSchema(db: Database.Database) {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS datacenters (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            code TEXT UNIQUE NOT NULL,
            location TEXT NOT NULL,
            owner_id TEXT NOT NULL REFERENCES users(id),
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at INTEGER NOT NULL
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

        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(floor_id, sort_order);
        CREATE INDEX IF NOT EXISTS idx_racks_room ON racks(room_id, sort_order);
        CREATE INDEX IF NOT EXISTS idx_devices_rack ON devices(rack_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    `);
}

function normalizeDevice(device: Device, rackId?: string): Device {
    return {
        ...device,
        rackId: rackId ?? device.rackId ?? '',
        uHeight: Number(device.uHeight) || 1,
        uPosition: Number(device.uPosition) || 1,
        depth: device.depth || 'full',
        status: device.status || 'active',
        ports: Array.isArray(device.ports) ? device.ports : [],
    };
}

function migrateLegacyJson(db: Database.Database) {
    if (!fs.existsSync(LEGACY_JSON_PATH)) return;

    const alreadyMigrated = db
        .prepare("SELECT value FROM app_meta WHERE key = 'legacy_json_migrated'")
        .get() as { value: string } | undefined;
    if (alreadyMigrated?.value === '1') return;

    try {
        const raw = fs.readFileSync(LEGACY_JSON_PATH, 'utf-8');
        const legacy = JSON.parse(raw) as Partial<LegacyDatabase>;

        const migrate = db.transaction(() => {
            const insertFloor = db.prepare(
                'INSERT OR IGNORE INTO floors (id, name, location) VALUES (?, ?, ?)',
            );
            const insertRoom = db.prepare(
                'INSERT OR IGNORE INTO rooms (id, name, floor_id, width, height, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
            );
            const insertRack = db.prepare(
                'INSERT OR IGNORE INTO racks (id, name, room_id, u_capacity, x, y, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
            );
            const insertDevice = db.prepare(
                'INSERT OR IGNORE INTO devices (id, rack_id, payload) VALUES (?, ?, ?)',
            );
            const insertInventory = db.prepare(
                'INSERT OR IGNORE INTO inventory (id, payload) VALUES (?, ?)',
            );
            const insertConnection = db.prepare(
                'INSERT OR IGNORE INTO connections (id, payload) VALUES (?, ?)',
            );

            for (const floor of legacy.floors || []) {
                insertFloor.run(floor.id, floor.name, floor.location || '');
            }

            for (const [index, room] of (legacy.rooms || []).entries()) {
                insertRoom.run(
                    room.id,
                    room.name,
                    room.floorId,
                    room.width || 12,
                    room.height || 10,
                    room.order ?? index + 1,
                );
            }

            for (const [index, rack] of (legacy.racks || []).entries()) {
                insertRack.run(
                    rack.id,
                    rack.name,
                    rack.roomId,
                    rack.uCapacity || 42,
                    Number.isFinite(rack.x) ? rack.x : 0,
                    Number.isFinite(rack.y) ? rack.y : 0,
                    rack.order ?? index + 1,
                );
            }

            for (const device of legacy.devices || []) {
                const normalized = normalizeDevice(device);
                if (!normalized.rackId) continue;
                insertDevice.run(
                    normalized.id,
                    normalized.rackId,
                    JSON.stringify(normalized),
                );
            }

            for (const asset of legacy.inventory || []) {
                const normalized = normalizeDevice(asset, '');
                insertInventory.run(normalized.id, JSON.stringify(normalized));
            }

            for (const connection of legacy.connections || []) {
                insertConnection.run(connection.id, JSON.stringify(connection));
            }

            db.prepare(
                "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('legacy_json_migrated', '1')",
            ).run();
        });

        migrate();
        console.info('[db] Migrated legacy data/db.json into SQLite.');
    } catch (error) {
        console.error('[db] Legacy JSON migration failed:', error);
    }
}

export function getDb(): Database.Database {
    if (!dbInstance) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        dbInstance = new Database(DB_PATH);
        ensureSchema(dbInstance);
        migrateLegacyJson(dbInstance);
    }

    return dbInstance;
}
