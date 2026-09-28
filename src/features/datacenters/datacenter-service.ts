import { createServerFn } from '@tanstack/react-start';
import { getSession } from '../auth/auth-service';
import { getDb } from '../auth/sqlite';

export interface Datacenter {
    id: string;
    name: string;
    code: string;
    location: string;
    owner_id: string;
    created_at: number;
}

async function requireUser() {
    const session = await getSession();
    if (!session?.user) throw new Error('Unauthorized');
    return session.user;
}

export const createDatacenter = createServerFn({ method: 'POST' }).handler(
    async (ctx: unknown) => {
        const { data } = ctx as {
            data: { name: string; code: string; location: string };
        };
        const user = await requireUser();
        const db = getDb();

        const name = data.name.trim();
        const code = data.code.trim().toUpperCase();
        const location = data.location.trim();

        if (!name) throw new Error('Datacenter name is required');
        if (!code) throw new Error('Datacenter code is required');
        if (!/^[A-Z0-9][A-Z0-9-]{1,15}$/.test(code)) {
            throw new Error(
                'DC code must use letters, numbers, or dashes (2–16 characters)',
            );
        }
        if (!location) throw new Error('Location is required');

        const existing = db
            .prepare('SELECT id FROM datacenters WHERE code = ?')
            .get(code);
        if (existing) {
            throw new Error('A datacenter with this code already exists');
        }

        const crypto = await import('node:crypto');
        const id = `dc-${crypto.randomUUID()}`;
        const now = Date.now();

        db.prepare(
            `INSERT INTO datacenters
                (id, name, code, location, owner_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(id, name, code, location, user.id, now);

        return {
            success: true,
            datacenter: {
                id,
                name,
                code,
                location,
                owner_id: user.id,
                created_at: now,
            },
        };
    },
);

export const getDatacenters = createServerFn({ method: 'GET' }).handler(
    async (): Promise<Datacenter[]> => {
        const user = await requireUser();

        return getDb()
            .prepare(
                `SELECT *
                 FROM datacenters
                 WHERE owner_id = ?
                 ORDER BY created_at DESC`,
            )
            .all(user.id) as Datacenter[];
    },
);

export const getDatacenterById = createServerFn({ method: 'GET' }).handler(
    async (ctx: unknown): Promise<Datacenter | null> => {
        const { data: id } = ctx as { data: string };
        const user = await requireUser();

        const datacenter = getDb()
            .prepare(
                `SELECT *
                 FROM datacenters
                 WHERE id = ? AND owner_id = ?`,
            )
            .get(id, user.id);

        return (datacenter as Datacenter | undefined) || null;
    },
);

export const updateDatacenter = createServerFn({ method: 'POST' }).handler(
    async (ctx: unknown) => {
        const { data } = ctx as {
            data: { id: string; name: string; location: string };
        };
        const user = await requireUser();
        const name = data.name.trim();
        const location = data.location.trim();

        if (!name) throw new Error('Datacenter name is required');
        if (!location) throw new Error('Location is required');

        const result = getDb()
            .prepare(
                `UPDATE datacenters
                 SET name = ?, location = ?
                 WHERE id = ? AND owner_id = ?`,
            )
            .run(name, location, data.id, user.id);

        if (result.changes === 0) throw new Error('Datacenter not found');
        return { success: true };
    },
);

export const deleteDatacenter = createServerFn({ method: 'POST' }).handler(
    async (ctx: unknown) => {
        const { data: id } = ctx as { data: string };
        const user = await requireUser();
        const db = getDb();

        const datacenter = db
            .prepare(
                'SELECT code FROM datacenters WHERE id = ? AND owner_id = ?',
            )
            .get(id, user.id) as { code: string } | undefined;

        if (!datacenter) throw new Error('Datacenter not found');

        const transaction = db.transaction(() => {
            // Rooms reference the stable DC code. Their racks, devices, ports,
            // and connections are removed through SQLite cascade relations.
            db.prepare('DELETE FROM rooms WHERE floor_id = ?').run(
                datacenter.code,
            );
            db.prepare(
                'DELETE FROM datacenters WHERE id = ? AND owner_id = ?',
            ).run(id, user.id);
        });

        transaction();
        return { success: true };
    },
);
