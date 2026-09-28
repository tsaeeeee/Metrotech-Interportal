import { createServerFn } from '@tanstack/react-start';
import { getCookie, setCookie } from '@tanstack/react-start/server';
import { getDb } from './sqlite';

const SESSION_COOKIE_NAME = 'session_token';
const SESSION_EXPIRY_DAYS = 7;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
const PASSWORD_ITERATIONS = 210_000;
const LEGACY_PASSWORD_ITERATIONS = 10_000;
const LEGACY_SALT = 'metrotech-salt';

async function getCrypto() {
    return import('node:crypto');
}

async function hashPassword(password: string, salt: string): Promise<string> {
    const crypto = await getCrypto();
    return crypto
        .pbkdf2Sync(
            password,
            salt,
            PASSWORD_ITERATIONS,
            64,
            'sha512',
        )
        .toString('hex');
}

async function hashLegacyPassword(password: string): Promise<string> {
    const crypto = await getCrypto();
    return crypto
        .pbkdf2Sync(
            password,
            LEGACY_SALT,
            LEGACY_PASSWORD_ITERATIONS,
            64,
            'sha512',
        )
        .toString('hex');
}

async function passwordMatches(left: string, right: string) {
    const crypto = await getCrypto();
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return (
        leftBuffer.length === rightBuffer.length &&
        crypto.timingSafeEqual(leftBuffer, rightBuffer)
    );
}

async function createSession(userId: string) {
    const crypto = await getCrypto();
    const db = getDb();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_EXPIRY_MS;

    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    db.prepare(
        'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
    ).run(token, userId, expiresAt);

    setCookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    });
}

export const signUp = createServerFn({ method: 'POST' })
    .inputValidator(
        (data: { fullName: string; email: string; password: string }) => data,
    )
    .handler(async (ctx) => {
        const fullName = ctx.data.fullName.trim();
        const email = ctx.data.email.trim().toLowerCase();
        const password = ctx.data.password;

        if (fullName.length < 2) {
            throw new Error('Full name is required');
        }
        if (!email || !email.includes('@')) {
            throw new Error('Enter a valid email address');
        }
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters');
        }

        const db = getDb();
        const existingUser = db
            .prepare('SELECT id FROM users WHERE email = ?')
            .get(email);
        if (existingUser) {
            throw new Error('An account with this email already exists');
        }

        const crypto = await getCrypto();
        const userId = `usr-${crypto.randomUUID()}`;
        const salt = crypto.randomBytes(24).toString('hex');
        const passwordHash = await hashPassword(password, salt);
        const now = Date.now();

        db.prepare(
            `INSERT INTO users
                (id, full_name, email, password_hash, password_salt, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(userId, fullName, email, passwordHash, salt, now);

        await createSession(userId);
        return { success: true };
    });

export const login = createServerFn({ method: 'POST' })
    .inputValidator((data: { email: string; password: string }) => data)
    .handler(async (ctx) => {
        const email = ctx.data.email.trim().toLowerCase();
        const password = ctx.data.password;
        const db = getDb();

        const user = db
            .prepare(
                `SELECT id, password_hash, password_salt
                 FROM users
                 WHERE email = ?`,
            )
            .get(email) as
            | {
                  id: string;
                  password_hash: string;
                  password_salt: string | null;
              }
            | undefined;

        if (!user) {
            throw new Error('Invalid email or password');
        }

        let valid = false;

        if (user.password_salt) {
            const passwordHash = await hashPassword(
                password,
                user.password_salt,
            );
            valid = await passwordMatches(user.password_hash, passwordHash);
        } else {
            const legacyHash = await hashLegacyPassword(password);
            valid = await passwordMatches(user.password_hash, legacyHash);

            if (valid) {
                const crypto = await getCrypto();
                const salt = crypto.randomBytes(24).toString('hex');
                const upgradedHash = await hashPassword(password, salt);
                db.prepare(
                    `UPDATE users
                     SET password_hash = ?, password_salt = ?
                     WHERE id = ?`,
                ).run(upgradedHash, salt, user.id);
            }
        }

        if (!valid) {
            throw new Error('Invalid email or password');
        }

        await createSession(user.id);
        return { success: true };
    });

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
    const token = getCookie(SESSION_COOKIE_NAME);
    if (token) {
        getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }

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
        if (!token) return null;

        const db = getDb();
        const session = db
            .prepare(`
                SELECT s.expires_at, u.id, u.full_name, u.email
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token = ?
            `)
            .get(token) as
            | {
                  expires_at: number;
                  id: string;
                  full_name: string;
                  email: string;
              }
            | undefined;

        if (!session) return null;

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
