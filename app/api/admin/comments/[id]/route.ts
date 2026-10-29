import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/server/store';
import { isAdmin, sameOrigin } from '@/lib/server/auth';

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Blocked.' }, { status: 403 });
  const { id } = await ctx.params;
  const ok = await getStore().removeComment(id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Comment not found.' }, { status: 404 });
}
