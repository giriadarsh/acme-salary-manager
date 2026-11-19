import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Pool } from 'pg';
import type { HrUser } from '../shared/compensation.ts';
import { SESSION_HOURS } from './config.ts';

const deriveKey = promisify(scrypt);
export const SESSION_COOKIE = 'acme_hr_session';
export const SESSION_MAX_AGE = SESSION_HOURS * 60 * 60 * 1000;
const fallbackHash = `${'0'.repeat(32)}:${'0'.repeat(128)}`;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, 64) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, hash: string) {
  const [salt, storedDigest] = hash.split(':');
  if (!salt || !storedDigest || storedDigest.length !== 128) return false;
  const computed = await deriveKey(password, salt, 64) as Buffer;
  return timingSafeEqual(Buffer.from(storedDigest, 'hex'), computed);
}

function digestToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function readSession(cookieHeader?: string) {
  const cookie = cookieHeader?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${SESSION_COOKIE}=`));
  const token = cookie?.slice(SESSION_COOKIE.length + 1);
  return token && /^[\da-f]{64}$/.test(token) ? token : undefined;
}

export async function createSession(pool: Pool, email: string, password: string) {
  const { rows: [record] } = await pool.query<HrUser & { hash: string }>(`SELECT id,
    display_name AS name, email, password_hash AS hash FROM hr_users WHERE email = $1`, [email]);
  const passwordMatches = await verifyPassword(password, record?.hash ?? fallbackHash);
  if (!record || !passwordMatches) return null;
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE);
  await pool.query('DELETE FROM hr_sessions WHERE expires_at <= now()');
  await pool.query('INSERT INTO hr_sessions VALUES ($1, $2, $3)', [digestToken(token), record.id, expiresAt]);
  const { id, name } = record;
  return { token, user: { id, name, email } };
}

export async function sessionUser(pool: Pool, token?: string): Promise<HrUser | null> {
  if (!token) return null;
  const { rows: [user] } = await pool.query<HrUser>(`SELECT u.id, u.email, u.display_name AS name
    FROM hr_sessions s JOIN hr_users u ON s.user_id = u.id
    WHERE s.token_hash = $1 AND s.expires_at > now()`, [digestToken(token)]);
  return user ?? null;
}

export async function revokeSession(pool: Pool, token?: string) {
  if (token) await pool.query('DELETE FROM hr_sessions WHERE token_hash = $1', [digestToken(token)]);
}
