import crypto from 'node:crypto';
import { db } from './db';
import { getCookie, isUuid } from './http';

const COOKIE = 'rg_s';
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET ausente');
  return s;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex');
  return `pbkdf2$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const [alg, salt, hash] = String(stored || '').split('$');
  if (alg !== 'pbkdf2' || !salt || !hash) return false;
  const test = crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha256');
  const known = Buffer.from(hash, 'hex');
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function sessionCookie(userId) {
  const payload = Buffer.from(JSON.stringify({ u: userId, e: Date.now() + MAX_AGE * 1000 })).toString('base64url');
  const value = `${payload}.${sign(payload)}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function userIdFrom(req) {
  const raw = getCookie(req, COOKIE);
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.e || data.e < Date.now() || !isUuid(data.u)) return null;
    return data.u;
  } catch {
    return null;
  }
}

// Confere se o evento pertence ao palestrante logado.
export async function ownedEvent(req, eventId) {
  const uid = userIdFrom(req);
  if (!uid) return { status: 401 };
  if (!isUuid(eventId)) return { status: 404 };
  const sql = db();
  const rows = await sql`SELECT * FROM events WHERE id = ${eventId} AND owner_id = ${uid}`;
  if (!rows.length) return { status: 404 };
  return { uid, event: rows[0] };
}

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function randomPin() {
  return String(crypto.randomInt(100000, 1000000));
}
