import type { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

const DEVICE_COOKIE = 'pw_device';

/** Anonymous per-browser id (httpOnly cookie) used for rate limits and one-like-per-device. */
export function getDevice(req: NextRequest) {
  const existing = req.cookies.get(DEVICE_COOKIE)?.value;
  const deviceId = existing && /^[0-9a-f-]{36}$/.test(existing) ? existing : crypto.randomUUID();
  return {
    deviceId,
    apply<T extends NextResponse>(res: T): T {
      if (deviceId !== existing) {
        res.cookies.set(DEVICE_COOKIE, deviceId, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365, path: '/', secure: process.env.NODE_ENV === 'production' });
      }
      return res;
    },
  };
}
