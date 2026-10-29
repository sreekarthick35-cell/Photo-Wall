import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';

export const ADMIN_COOKIE = 'pw_admin';
export const SESSION_SECONDS = 8 * 60 * 60;

const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
const digest = (v: string) => crypto.createHash('sha256').update(v).digest();
const sign = (payload: string) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

export const adminConfigured = () => Boolean(process.env.ADMIN_PASSWORD);

export const adminUsername = () => process.env.ADMIN_USERNAME || 'admin';

export function credentialsMatch(username: string, password: string) {
  if (!adminConfigured()) return false;
  // Evaluate both so timing doesn't reveal which one was wrong.
  const u = crypto.timingSafeEqual(digest(username.trim().toLowerCase()), digest(adminUsername().toLowerCase()));
  const p = crypto.timingSafeEqual(digest(password), digest(process.env.ADMIN_PASSWORD!));
  return u && p;
}

export function passwordMatches(candidate: string) {
  if (!adminConfigured()) return false;
  return crypto.timingSafeEqual(digest(candidate), digest(process.env.ADMIN_PASSWORD!));
}

export function makeSessionValue() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_SECONDS * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function isAdmin(req: NextRequest) {
  if (!adminConfigured()) return false;
  const raw = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!raw) return false;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return false;
  const a = Buffer.from(sign(payload));
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
  } catch {
    return false;
  }
}

/** Mutations must come from our own origin (defence in depth on top of SameSite=Strict). */
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  return !origin || new URL(origin).host === req.headers.get('host');
}

// Small in-memory limiter for admin login attempts (per server instance).
const attempts = new Map<string, number[]>();
export function loginAllowed(key: string) {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < 15 * 60_000);
  if (recent.length >= 8) return false;
  recent.push(now);
  attempts.set(key, recent);
  return true;
}
