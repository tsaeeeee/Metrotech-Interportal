import { randomUUID } from 'node:crypto';
import { createServerFn } from '@tanstack/react-start';
import { getSession } from '../auth/auth-service';
import { getAuthDb } from '../auth/auth-db';
import { hashPassword } from '../auth/passwords';

async function requireAdmin() {
    const session = await getSession();
    if (!session || session.user.role !== 'admin' || session.user.mustChangePassword) {
        throw new Error('Administrator access required');
    }
    return session;
}

export interface ManagedUser {
    id: string;
    username: string;
    fullName: string;
    email: string;
    role: 'admin' | 'editor';
    isActive: boolean;
    createdAt: number;
}

export const listUsers = createServerFn({ method: 'GET' }).handler(async (): Promise<ManagedUser[]> => {
    await requireAdmin();
    const db = getAuthDb();
    const rows = db.prepare(
        'SELECT id, username, full_name, email, role, is_active, created_at FROM users ORDER BY created_at'
    ).all() as Array<{
        id: string; username: string; full_name: string; email: string | null;
        role: 'admin' | 'editor'; is_active: number; created_at: number;
    }>;
    return rows.map(r => ({
        id: r.id, username: r.username, fullName: r.full_name, email: r.email ?? '',
        role: r.role, isActive: r.is_active === 1, createdAt: r.created_at,
    }));
});

export const createUser = createServerFn({ method: 'POST' })
    .inputValidator((data: {
        username: string; fullName: string; email: string; password: string;
    }) => data)
    .handler(async ({ data }) => {
        await requireAdmin();
        const username = data.username?.trim();
        const fullName = data.fullName?.trim();
        const email = data.email?.trim().toLowerCase();
        if (!username || !/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(username)) {
            throw new Error('Username must be 3–32 characters: letters, numbers, dots, underscores or hyphens.');
        }
        if (!fullName || fullName.length > 120) throw new Error('Invalid full name');
        if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Invalid email address');
        }
        const passwordHash = hashPassword(data.password);
        const now = Date.now();
        const db = getAuthDb();
        const exists = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE')
            .get(username, email);
        if (exists) throw new Error('Username or email is already in use');
        db.prepare(`
            INSERT INTO users (id, username, full_name, email, password_hash,
                role, is_active, must_change_password, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'editor', 1, 1, ?, ?)
        `).run(`usr-${randomUUID()}`, username, fullName, email, passwordHash, now, now);
        return { success: true };
    });
