import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashPassword, verifyPassword } from './passwords';

const folder = mkdtempSync(join(tmpdir(), 'metrotech-dcim-v2-'));
process.env.DCIM_AUTH_DB_PATH = join(folder, 'auth.sqlite');
process.env.DCIM_DB_PATH = join(folder, 'dcim.sqlite');

afterAll(() => {
    delete process.env.DCIM_AUTH_DB_PATH;
    delete process.env.DCIM_DB_PATH;
    rmSync(folder, { recursive: true, force: true });
});

describe('DCIM V2 database boundaries and password hashing', () => {
    it('stores credentials and DCIM assets in isolated SQLite files', async () => {
        const { getAuthDb } = await import('./auth-db');
        const { getDb } = await import('./sqlite');
        const auth = getAuthDb();
        const dcim = getDb();
        const authTables = auth.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
            .map(row => (row as {name:string}).name);
        const dcimTables = dcim.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
            .map(row => (row as {name:string}).name);

        expect(authTables).toContain('users');
        expect(authTables).toContain('sessions');
        expect(authTables).not.toContain('racks');
        expect(authTables).not.toContain('devices');
        expect(dcimTables).toContain('datacenters');
        expect(dcimTables).toContain('racks');
        expect(dcimTables).toContain('devices');
        expect(dcimTables).not.toContain('users');
        expect(dcimTables).not.toContain('sessions');

        expect((dcim.prepare('SELECT COUNT(*) AS n FROM datacenters').get() as {n:number}).n).toBe(0);
        auth.close();
        dcim.close();
    });

    it('uses per-password salted scrypt hashes and rejects mismatches', () => {
        const one = hashPassword('SafeExamplePassphrase-01');
        const two = hashPassword('SafeExamplePassphrase-01');
        expect(one).not.toEqual(two);
        expect(verifyPassword('SafeExamplePassphrase-01', one)).toBe(true);
        expect(verifyPassword('IncorrectPassphrase', one)).toBe(false);
        expect(verifyPassword('SafeExamplePassphrase-01', 'legacy:hash')).toBe(false);
        expect(() => hashPassword('short')).toThrow();
    });
});
