import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/server/store';
import { isAdmin } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

// Demo-mode image serving. In Supabase mode images come from Storage and this 404s.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = getStore();
  if (!/^[0-9a-f-]{36}$/.test(id) || !store.readImage) return new NextResponse(null, { status: 404 });
  const card = await store.get(id);
  if (!card || (card.hidden && !isAdmin(req))) return new NextResponse(null, { status: 404 });
  const img = await store.readImage(id);
  if (!img) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(img.data), { headers: { 'Content-Type': img.type, 'Cache-Control': 'public, max-age=3600' } });
}
