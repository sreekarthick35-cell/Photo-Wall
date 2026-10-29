import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, SESSION_SECONDS, adminConfigured, isAdmin, loginAllowed, makeSessionValue, credentialsMatch, sameOrigin } from '@/lib/server/auth';

export async function GET(req: NextRequest) {
  return NextResponse.json({ signedIn: isAdmin(req), configured: adminConfigured() });
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Blocked.' }, { status: 403 });
  if (!adminConfigured()) return NextResponse.json({ error: 'Admin is not configured. Set ADMIN_PASSWORD on the server.' }, { status: 503 });
  const key = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local';
  if (!loginAllowed(key)) return NextResponse.json({ error: 'Too many attempts. Wait a few minutes.' }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.password !== 'string' || typeof body.username !== 'string' || !credentialsMatch(body.username, body.password)) {
    return NextResponse.json({ error: 'Wrong username or password.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeSessionValue(), { httpOnly: true, sameSite: 'strict', path: '/', maxAge: SESSION_SECONDS, secure: process.env.NODE_ENV === 'production' });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  return res;
}
