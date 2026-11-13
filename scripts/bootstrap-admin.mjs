// One-time administrator setup: password is read from stdin (not argv/env/Git).
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import Database from 'better-sqlite3';

const dbPath = process.env.DCIM_AUTH_DB_PATH || path.resolve(process.cwd(), 'data/auth.sqlite');
const username = 'Administrator';
const password = fs.readFileSync(0, 'utf8').replace(/\r?\n$/, '');
if (password.length < 12 || password.length > 256) {
    console.error('Admin password must be 12–256 characters.'); process.exit(1);
}
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
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
`);
if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n !== 0) {
    console.error('Refusing to seed: auth database already has users.');
    db.close(); process.exit(2);
}
const salt = randomBytes(16).toString('hex');
const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const now = Date.now();
db.prepare(`
    INSERT INTO users (id, username, full_name, email, password_hash, role,
        is_active, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, NULL, ?, 'admin', 1, 1, ?, ?)
`).run(`usr-${randomUUID()}`, username, 'Administrator', hash, now, now);
db.close();
console.log('Administrator account created. Password change is required at first login.');
