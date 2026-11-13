import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DCIM_AUTH_DB_PATH || path.resolve(process.cwd(), 'data/auth.sqlite');
let instance: Database.Database | null = null;

export function getAuthDb(): Database.Database {
    if (!instance) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        const db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        db.pragma('busy_timeout = 5000');
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'editor')),
                is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
                must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0,1)),
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
        `);
        instance = db;
    }
    return instance;
}
