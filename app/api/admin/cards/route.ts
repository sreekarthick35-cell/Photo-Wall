import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/server/store';
import crypto from 'node:crypto';
import { isAdmin, sameOrigin } from '@/lib/server/auth';
import { validateFields, validateJpeg } from '@/lib/validate';
import { pickSpot } from '@/lib/placement';
import { PIN_COLORS } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const store = getStore();
  const [cards, comments] = await Promise.all([store.list({ includeHidden: true }), store.allComments()]);
  return NextResponse.json({ cards: cards.reverse().map((c) => ({ ...c, comments: comments.filter((x) => x.card_id === c.id) })) });
}

/** Admin-created card: same validation as a public post, but no cooldown and no content-safety gate. */
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Blocked.' }, { status: 403 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 }); }
  const v = validateFields(Object.fromEntries([...form.entries()].filter(([, val]) => typeof val === 'string')));
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const file = form.get('image');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'Please add a photo.' }, { status: 400 });
  const image = Buffer.from(await file.arrayBuffer());
  const bad = validateJpeg(image);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  const store = getStore();
  const spot = pickSpot(await store.list({ includeHidden: true }));
  const card = await store.save(
    { id: crypto.randomUUID(), ...v.fields, x: spot.x, y: spot.y, rotation: Math.round((Math.random() * 16 - 8) * 10) / 10, pin_color: PIN_COLORS[0] },
    image,
  );
  return NextResponse.json({ card }, { status: 201 });
}
