import { createServerFn } from '@tanstack/react-start';
import { getCookie, setCookie } from '@tanstack/react-start/server';
import { getDb } from './sqlite';

const SESSION_COOKIE_NAME = 'session_token';
const SESSION_EXPIRY_DAYS = 7;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

async function hashPassword(password: string): Promise<string> {
    const crypto = await import('node:crypto');
    // Basic pbkdf2 implementation with a static salt for simplicity
    // In a real app, you'd use a unique random salt per user
    const salt = 'metrotech-salt';
    return crypto
        .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
        .toString('hex');
}

export const signUp = createServerFn({ method: 'POST' }).handler(
    async (ctx: {
        data: { fullName: string; email: string; password: string };
    }) => {
        const { fullName, email, password } = ctx.data;
        const db = getDb();

        const existingUser = db
            .prepare('SELECT id FROM users WHERE email = ?')
            .get(email);
        if (existingUser) {
            throw new Error('An account with this email already exists');
        }

        const crypto = await import('node:crypto');
        const userId = `usr-${crypto.randomUUID()}`;
        const passwordHash = await hashPassword(password);
        const now = Date.now();

        // Insert user
        db.prepare(
            'INSERT INTO users (id, full_name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
        ).run(userId, fullName, email, passwordHash, now);

        // Create session
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = now + SESSION_EXPIRY_MS;

        db.prepare(
            'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
        ).run(token, userId, expiresAt);

        // Set cookie
        setCookie(SESSION_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
        });

        return { success: true };
    },
);

export const login = createServerFn({ method: 'POST' }).handler(
    async (ctx: { data: { email: string; password: string } }) => {
        const { email, password } = ctx.data;
        const db = getDb();

        const user = db
            .prepare('SELECT * FROM users WHERE email = ?')
            .get(email) as { id: string; password_hash: string } | undefined;
        if (!user) {
            throw new Error('Invalid email or password');
        }

        const passwordHash = await hashPassword(password);
        if (user.password_hash !== passwordHash) {
            throw new Error('Invalid email or password');
        }

        const crypto = await import('node:crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + SESSION_EXPIRY_MS;

        db.prepare(
            'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
        ).run(token, user.id, expiresAt);

        setCookie(SESSION_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
        });

        return { success: true };
    },
);

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
    const token = getCookie(SESSION_COOKIE_NAME);
    if (token) {
        const db = getDb();
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }

    // Clear cookie
    setCookie(SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });

    return { success: true };
});

export const getSession = createServerFn({ method: 'GET' }).handler(
    async () => {
        const token = getCookie(SESSION_COOKIE_NAME);
        if (!token) {
            return null;
        }

        const db = getDb();

        // Get session with user info
        const session = db
            .prepare(`
        SELECT s.expires_at, u.id, u.full_name, u.email 
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.token = ?
    `)
            .get(token) as { expires_at: number; id: string; full_name: string; email: string } | undefined;

        if (!session) {
            return null;
        }

        // Check expiry
        if (session.expires_at < Date.now()) {
            db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
            return null;
        }

        return {
            user: {
                id: session.id,
                fullName: session.full_name,
                email: session.email,
            },
        };
    },
);
