import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/server/store';
import { getDevice } from '@/lib/server/device';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const store = getStore();
  const { deviceId, apply } = getDevice(req);
  const card = await store.get(id);
  if (!card || card.hidden) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const [liked, comments] = await Promise.all([store.hasLiked(id, deviceId), store.listComments(id)]);
  return apply(NextResponse.json({ liked, likes: card.like_count, comments: comments.map(({ id, author_name, body, created_at }) => ({ id, author_name, body, created_at })) }, { headers: { 'Cache-Control': 'no-store' } }));
}
