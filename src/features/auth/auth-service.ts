import { createServerFn } from '@tanstack/react-start';
import { getCookie, setCookie } from '@tanstack/react-start/server';
import { createHash, randomBytes } from 'node:crypto';
import { getAuthDb } from './auth-db';
import { hashPassword, verifyPassword } from './passwords';

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'metrotech_dcim_v2_session';
const SESSION_EXPIRY_DAYS = 7;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 86400000;
const isSecureCookieEnabled = () => process.env.SESSION_COOKIE_SECURE !== 'false';
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export interface SessionUser {
    id: string;
    username: string;
    fullName: string;
    email: string;
    role: 'admin' | 'editor';
    mustChangePassword: boolean;
}
export interface CurrentSession { user: SessionUser; }

function findSession(): CurrentSession | null {
    const rawToken = getCookie(SESSION_COOKIE_NAME);
    if (!rawToken || !/^[a-f0-9]{64}$/.test(rawToken)) return null;
    const db = getAuthDb();
    const session = db.prepare(`
        SELECT s.expires_at, u.id, u.username, u.full_name, u.email, u.role,
               u.must_change_password, u.is_active
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token_hash = ?
    `).get(digest(rawToken)) as {
        expires_at: number; id: string; username: string; full_name: string;
        email: string | null; role: 'admin' | 'editor';
        must_change_password: number; is_active: number;
    } | undefined;
    if (!session) return null;
    if (session.expires_at <= Date.now() || session.is_active !== 1) {
        db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(rawToken));
        return null;
    }
    return {
        user: {
            id: session.id,
            username: session.username,
            fullName: session.full_name,
            email: session.email ?? '',
            role: session.role,
            mustChangePassword: session.must_change_password === 1,
        },
    };
}

export const getSession = createServerFn({ method: 'GET' })
    .handler(async (): Promise<CurrentSession | null> => findSession());

export const login = createServerFn({ method: 'POST' })
    .inputValidator((data: { username: string; password: string }) => data)
    .handler(async (ctx) => {
        const { username, password } = ctx.data;
        if (!username || !password || username.length > 80 || password.length > 256) {
            throw new Error('Invalid username or password');
        }
        const db = getAuthDb();
        const user = db.prepare(`
            SELECT id, password_hash, is_active, must_change_password
            FROM users WHERE username = ? COLLATE NOCASE
        `).get(username.trim()) as {
            id: string; password_hash: string; is_active: number;
            must_change_password: number;
        } | undefined;
        if (!user || user.is_active !== 1 || !verifyPassword(password, user.password_hash)) {
            throw new Error('Invalid username or password');
        }
        const token = randomBytes(32).toString('hex');
        const now = Date.now();
        db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
        db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
            .run(digest(token), user.id, now + SESSION_EXPIRY_MS, now);
        setCookie(SESSION_COOKIE_NAME, token, {
            httpOnly: true, secure: isSecureCookieEnabled(), sameSite: 'lax',
            path: '/', maxAge: SESSION_EXPIRY_MS / 1000,
        });
        return { success: true, mustChangePassword: user.must_change_password === 1 };
    });

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
    const token = getCookie(SESSION_COOKIE_NAME);
    if (token) getAuthDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
    setCookie(SESSION_COOKIE_NAME, '', {
        httpOnly: true, secure: isSecureCookieEnabled(), sameSite: 'lax',
        path: '/', maxAge: 0,
    });
    return { success: true };
});

export const changePassword = createServerFn({ method: 'POST' })
    .inputValidator((data: { currentPassword: string; newPassword: string }) => data)
    .handler(async ({ data }) => {
        const session = findSession();
        if (!session) throw new Error('Unauthorized');
        const db = getAuthDb();
        const row = db.prepare('SELECT password_hash FROM users WHERE id=?').get(session.user.id) as
            { password_hash: string } | undefined;
        if (!row || !verifyPassword(data.currentPassword, row.password_hash)) {
            throw new Error('Current password is incorrect');
        }
        if (data.newPassword === data.currentPassword) {
            throw new Error('New password must be different');
        }
        const passwordHash = hashPassword(data.newPassword);
        db.transaction(() => {
            db.prepare('UPDATE users SET password_hash=?, must_change_password=0, updated_at=? WHERE id=?')
                .run(passwordHash, Date.now(), session.user.id);
            const token = getCookie(SESSION_COOKIE_NAME);
            if (token) db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash <> ?')
                .run(session.user.id, digest(token));
        })();
        return { success: true };
    });
