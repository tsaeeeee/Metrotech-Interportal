import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** Unique per-account salt, memory-hard hashing; no plaintext or shared salt. */
export function hashPassword(password: string): string {
    if (password.length < 12 || password.length > 256) {
        throw new Error('Password must be between 12 and 256 characters.');
    }
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
    const [algorithm, salt, expected] = stored.split(':');
    if (algorithm !== 'scrypt' || !salt || !expected || !/^[a-f0-9]{128}$/.test(expected) ||
        !/^[a-f0-9]{32}$/.test(salt) || password.length > 256) return false;
    const actual = scryptSync(password, salt, 64);
    return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
