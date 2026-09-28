import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Database as LegacyDatabase, Device, Rack, Room } from '#/types/schema';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.sqlite');
const LEGACY_JSON_PATH = path.join(DATA_DIR, 'db.json');

let dbInstance: Database.Database | null = null;

function hasColumn(
    db: Database.Database,
    table: string,
    column: string,
): boolean {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
        name: string;
    }[];
    return columns.some((entry) => entry.name === column);
}

function initializeSchema(db: Database.Database) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

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

        CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            floor_id TEXT NOT NULL,
            width INTEGER NOT NULL DEFAULT 12,
            height INTEGER NOT NULL DEFAULT 10,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS racks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
            u_capacity INTEGER NOT NULL DEFAULT 42,
            x INTEGER NOT NULL DEFAULT 0,
            y INTEGER NOT NULL DEFAULT 0,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            rack_id TEXT NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
            u_height INTEGER NOT NULL,
            u_position INTEGER NOT NULL,
            type TEXT NOT NULL,
            depth TEXT NOT NULL,
            asset_tag TEXT,
            serial_number TEXT,
            model TEXT,
            manufacturer TEXT,
            status TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ports (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
            status TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS connections (
            id TEXT PRIMARY KEY,
            port_a_id TEXT NOT NULL REFERENCES ports(id) ON DELETE CASCADE,
            port_b_id TEXT NOT NULL REFERENCES ports(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            color TEXT,
            status TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS inventory_assets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            u_height INTEGER NOT NULL,
            type TEXT NOT NULL,
            depth TEXT NOT NULL,
            asset_tag TEXT,
            serial_number TEXT,
            model TEXT,
            manufacturer TEXT,
            status TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS inventory_ports (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            asset_id TEXT NOT NULL REFERENCES inventory_assets(id) ON DELETE CASCADE,
            status TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_rooms_floor_id
            ON rooms(floor_id);
        CREATE INDEX IF NOT EXISTS idx_racks_room_id
            ON racks(room_id);
        CREATE INDEX IF NOT EXISTS idx_devices_rack_id
            ON devices(rack_id);
        CREATE INDEX IF NOT EXISTS idx_ports_device_id
            ON ports(device_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_ports_asset_id
            ON inventory_ports(asset_id);
        CREATE INDEX IF NOT EXISTS idx_connections_port_a
            ON connections(port_a_id);
        CREATE INDEX IF NOT EXISTS idx_connections_port_b
            ON connections(port_b_id);
    `);

    if (!hasColumn(db, 'users', 'password_salt')) {
        db.exec('ALTER TABLE users ADD COLUMN password_salt TEXT');
    }
}

function migrateLegacyJson(db: Database.Database) {
    const migrationKey = 'legacy_json_migrated_v1';
    const migrated = db
        .prepare('SELECT value FROM app_meta WHERE key = ?')
        .get(migrationKey) as { value: string } | undefined;

    if (migrated) return;

    const markMigrated = db.prepare(
        'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)',
    );

    if (!fs.existsSync(LEGACY_JSON_PATH)) {
        markMigrated.run(migrationKey, 'no-file');
        return;
    }

    let legacy: Partial<LegacyDatabase>;
    try {
        legacy = JSON.parse(
            fs.readFileSync(LEGACY_JSON_PATH, 'utf-8'),
        ) as Partial<LegacyDatabase>;
    } catch (error) {
        console.warn('Legacy JSON migration skipped: invalid db.json', error);
        markMigrated.run(migrationKey, 'invalid-json');
        return;
    }

    const now = Date.now();

    const migrate = db.transaction(() => {
        const insertRoom = db.prepare(`
            INSERT OR IGNORE INTO rooms
                (id, name, floor_id, width, height, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const [index, room] of (legacy.rooms || []).entries()) {
            insertRoom.run(
                room.id,
                room.name,
                room.floorId,
                room.width || 12,
                room.height || 10,
                room.order ?? index + 1,
                now,
            );
        }

        const insertRack = db.prepare(`
            INSERT OR IGNORE INTO racks
                (id, name, room_id, u_capacity, x, y, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const [index, rack] of (legacy.racks || []).entries()) {
            insertRack.run(
                rack.id,
                rack.name,
                rack.roomId,
                rack.uCapacity || 42,
                Number.isFinite(rack.x) ? rack.x : 0,
                Number.isFinite(rack.y) ? rack.y : 0,
                rack.order ?? index + 1,
                now,
            );
        }

        const insertDevice = db.prepare(`
            INSERT OR IGNORE INTO devices
                (
                    id, name, rack_id, u_height, u_position, type, depth,
                    asset_tag, serial_number, model, manufacturer, status,
                    created_at, updated_at
                )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertPort = db.prepare(`
            INSERT OR IGNORE INTO ports
                (id, name, type, device_id, status)
            VALUES (?, ?, ?, ?, ?)
        `);

        for (const device of legacy.devices || []) {
            insertDevice.run(
                device.id,
                device.name,
                device.rackId,
                device.uHeight || 1,
                device.uPosition || 1,
                device.type,
                device.depth || 'full',
                device.assetTag || null,
                device.serialNumber || null,
                device.model || null,
                device.manufacturer || null,
                device.status || 'active',
                now,
                now,
            );

            for (const port of device.ports || []) {
                insertPort.run(
                    port.id,
                    port.name,
                    port.type,
                    device.id,
                    port.status || 'up',
                );
            }
        }

        const insertInventory = db.prepare(`
            INSERT OR IGNORE INTO inventory_assets
                (
                    id, name, u_height, type, depth, asset_tag, serial_number,
                    model, manufacturer, status, created_at, updated_at
                )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertInventoryPort = db.prepare(`
            INSERT OR IGNORE INTO inventory_ports
                (id, name, type, asset_id, status)
            VALUES (?, ?, ?, ?, ?)
        `);

        for (const asset of legacy.inventory || []) {
            insertInventory.run(
                asset.id,
                asset.name,
                asset.uHeight || 1,
                asset.type,
                asset.depth || 'full',
                asset.assetTag || null,
                asset.serialNumber || null,
                asset.model || null,
                asset.manufacturer || null,
                asset.status || 'active',
                now,
                now,
            );

            for (const port of asset.ports || []) {
                insertInventoryPort.run(
                    port.id,
                    port.name,
                    port.type,
                    asset.id,
                    port.status || 'up',
                );
            }
        }

        const insertConnection = db.prepare(`
            INSERT OR IGNORE INTO connections
                (id, port_a_id, port_b_id, type, color, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const connection of legacy.connections || []) {
            const portAExists = db
                .prepare('SELECT 1 FROM ports WHERE id = ?')
                .get(connection.portAId);
            const portBExists = db
                .prepare('SELECT 1 FROM ports WHERE id = ?')
                .get(connection.portBId);

            if (portAExists && portBExists) {
                insertConnection.run(
                    connection.id,
                    connection.portAId,
                    connection.portBId,
                    connection.type,
                    connection.color || null,
                    connection.status || 'active',
                    now,
                );
            }
        }

        markMigrated.run(migrationKey, 'done');
    });

    migrate();
}

export function getDb(): Database.Database {
    if (dbInstance) return dbInstance;

    fs.mkdirSync(DATA_DIR, { recursive: true });

    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('busy_timeout = 5000');

    initializeSchema(dbInstance);
    migrateLegacyJson(dbInstance);

    return dbInstance;
}
