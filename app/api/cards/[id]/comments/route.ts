import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/server/store';
import { getDevice } from '@/lib/server/device';
import { sameOrigin } from '@/lib/server/auth';
import { validateComment } from '@/lib/validate';
import { COMMENT_COOLDOWN_MS } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Blocked.' }, { status: 403 });
  const { id } = await ctx.params;
  const store = getStore();
  const { deviceId, apply } = getDevice(req);
  const respond = (body: unknown, status: number, headers?: HeadersInit) => apply(NextResponse.json(body, { status, headers }));
  try {
    const card = await store.get(id);
    if (!card || card.hidden) return respond({ error: 'Not found.' }, 404);
    const last = await store.lastAt('comment', deviceId);
    if (last && Date.now() - last < COMMENT_COOLDOWN_MS) {
      const retryAfter = Math.ceil((COMMENT_COOLDOWN_MS - (Date.now() - last)) / 1000);
      return respond({ error: `Wait ${retryAfter}s before commenting again.`, retryAfter }, 429, { 'Retry-After': String(retryAfter) });
    }
    const body = await req.json().catch(() => ({}));
    const v = validateComment(body);
    if (!v.ok) return respond({ error: v.error }, 400);
    await store.record('comment', deviceId);
    const comment = await store.addComment({ card_id: id, author_name: v.author_name, body: v.body });
    const { id: cid, author_name, body: text, created_at } = comment;
    return respond({ comment: { id: cid, author_name, body: text, created_at } }, 201);
  } catch (err) {
    console.error('comment failed:', (err as Error).message); // never log comment text
    return respond({ error: 'Couldn’t post your comment. Try again.' }, 500);
  }
}
