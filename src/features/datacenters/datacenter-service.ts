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

export const createDatacenter = createServerFn({ method: 'POST' }).handler(
    async (ctx: { data: { name: string; code: string; location: string } }) => {
        const session = await getSession();
        if (!session || !session.user) {
            throw new Error('Unauthorized');
        }

        const { name, code, location } = ctx.data;
        const db = getDb();

        // Check if code exists globally
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
            'INSERT INTO datacenters (id, name, code, location, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(id, name, code, location, session.user.id, now);

        return {
            success: true,
            datacenter: {
                id,
                name,
                code,
                location,
                owner_id: session.user.id,
                created_at: now,
            },
        };
    },
);

export const getDatacenters = createServerFn({ method: 'GET' }).handler(
    async (): Promise<Datacenter[]> => {
        const session = await getSession();
        if (!session || !session.user) {
            throw new Error('Unauthorized');
        }

        const db = getDb();
        const datacenters = db
            .prepare('SELECT * FROM datacenters ORDER BY created_at DESC')
            .all();

        return datacenters as Datacenter[];
    },
);

export const getDatacenterById = createServerFn({ method: 'GET' }).handler(
    async (ctx: { data: string }): Promise<Datacenter | null> => {
        const session = await getSession();
        if (!session || !session.user) {
            throw new Error('Unauthorized');
        }

        const id = ctx.data;
        const db = getDb();
        const datacenter = db
            .prepare('SELECT * FROM datacenters WHERE id = ?')
            .get(id);

        return datacenter as Datacenter | null;
    },
);
