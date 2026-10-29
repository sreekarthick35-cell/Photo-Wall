import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/server/store';
import { getDevice } from '@/lib/server/device';
import { sameOrigin } from '@/lib/server/auth';

type Ctx = { params: Promise<{ id: string }> };

/** Toggles this device's like. One like per device per card is enforced by the store. */
export async function POST(req: NextRequest, ctx: Ctx) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Blocked.' }, { status: 403 });
  const { id } = await ctx.params;
  const store = getStore();
  const { deviceId, apply } = getDevice(req);
  try {
    const card = await store.get(id);
    if (!card || card.hidden) return apply(NextResponse.json({ error: 'Not found.' }, { status: 404 }));
    return apply(NextResponse.json(await store.toggleLike(id, deviceId)));
  } catch (err) {
    console.error('like failed:', (err as Error).message);
    return apply(NextResponse.json({ error: 'Couldn’t save your like. Try again.' }, { status: 500 }));
  }
}
