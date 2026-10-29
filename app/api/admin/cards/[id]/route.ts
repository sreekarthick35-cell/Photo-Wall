import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/server/store';
import { isAdmin, sameOrigin } from '@/lib/server/auth';
import { NAME_MAX, NOTE_MAX } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

function guard(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Blocked.' }, { status: 403 });
  return null;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = guard(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const store = getStore();
  const fields: { note?: string; author_name?: string } = {};
  if (body.note !== undefined) {
    const note = typeof body.note === 'string' ? body.note.trim() : null;
    if (note === null || note.length > NOTE_MAX) return NextResponse.json({ error: `Notes can be up to ${NOTE_MAX} characters.` }, { status: 400 });
    fields.note = note;
  }
  if (body.author_name !== undefined) {
    const name = typeof body.author_name === 'string' ? body.author_name.trim().replace(/\s+/g, ' ') : null;
    if (name === null || name.length > NAME_MAX) return NextResponse.json({ error: `Names can be up to ${NAME_MAX} characters.` }, { status: 400 });
    fields.author_name = name;
  }
  const hasFields = Object.keys(fields).length > 0;
  if (!hasFields && typeof body.hidden !== 'boolean') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  let ok = true;
  if (hasFields) ok = await store.update(id, fields);
  if (ok && typeof body.hidden === 'boolean') ok = await store.setHidden(id, body.hidden);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Card not found.' }, { status: 404 });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = guard(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const ok = await getStore().remove(id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Card not found.' }, { status: 404 });
}
