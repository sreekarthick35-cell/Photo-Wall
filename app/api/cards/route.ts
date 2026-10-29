import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getDevice } from '@/lib/server/device';
import { getStore } from '@/lib/server/store';
import { validateFields, validateJpeg } from '@/lib/validate';
import { pickSpot } from '@/lib/placement';
import { checkImageSafety } from '@/lib/server/safety';
import { COOLDOWN_MS, PIN_COLORS } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const store = getStore();
  try {
    const cards = await store.list({ includeHidden: false });
    return NextResponse.json({ mode: store.mode, cards }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('list failed:', (err as Error).message);
    return NextResponse.json({ error: 'Could not load the wall.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const store = getStore();
  const { deviceId, apply } = getDevice(req);
  const respond = (body: unknown, status: number, extra?: HeadersInit) => apply(NextResponse.json(body, { status, headers: extra }));

  try {
    // 1. Rate limit: one post per 15 seconds per device.
    const last = await store.lastAt('post', deviceId);
    if (last && Date.now() - last < COOLDOWN_MS) {
      const retryAfter = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
      return respond({ error: `Posted — wait ${retryAfter}s before pinning another.`, retryAfter }, 429, { 'Retry-After': String(retryAfter) });
    }

    // 2. Validate input.
    let form: FormData;
    try { form = await req.formData(); } catch { return respond({ error: 'Invalid upload.' }, 400); }
    const v = validateFields(Object.fromEntries([...form.entries()].filter(([, val]) => typeof val === 'string')));
    if (!v.ok) return respond({ error: v.error }, 400);
    const file = form.get('image');
    if (!(file instanceof Blob)) return respond({ error: 'Please add a photo.' }, 400);
    const image = Buffer.from(await file.arrayBuffer());
    const bad = validateJpeg(image);
    if (bad) return respond({ error: bad }, 400);

    // Reserve the slot before the slower checks so rapid retries can't hammer them.
    await store.record('post', deviceId);

    // 3. Content safety (no-op unless configured).
    const safe = await checkImageSafety(image);
    if (!safe.ok) return respond({ error: safe.reason }, 422);

    // 4. Pick a free spot and save.
    const existing = await store.list({ includeHidden: true });
    const spot = pickSpot(existing);
    const card = await store.save(
      {
        id: crypto.randomUUID(),
        ...v.fields,
        x: spot.x,
        y: spot.y,
        rotation: Math.round((Math.random() * 16 - 8) * 10) / 10,
        pin_color: PIN_COLORS[Math.floor(Math.random() * PIN_COLORS.length)],
      },
      image,
    );
    return respond({ card }, 201);
  } catch (err) {
    console.error('post failed:', (err as Error).message); // never log images or notes
    return respond({ error: 'Something went wrong on our side. Please try again.' }, 500);
  }
}
