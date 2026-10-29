'use client';
import { useCallback, useEffect, useState } from 'react';
import { FRAME_COLORS, FRAME_KEYS, NAME_MAX, NOTE_MAX, type Card, type Comment, type FrameColor } from '@/lib/types';
import { canvasToBlob, composeCard } from '@/lib/compose';
import { PhotoError, processPhoto } from '@/lib/image';

type AdminCard = Card & { comments: Comment[] };

export default function Admin() {
  const [state, setState] = useState<'loading' | 'out' | 'in'>('loading');
  const [configured, setConfigured] = useState(true);
  const [cards, setCards] = useState<AdminCard[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [editing, setEditing] = useState<{ id: string; note: string; author: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [nc, setNc] = useState<{ file: File | null; frame: FrameColor; note: string; author: string; busy: boolean }>({ file: null, frame: 'blue', note: '', author: '', busy: false });
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/cards', { cache: 'no-store' });
    if (res.status === 401) return setState('out');
    setCards((await res.json()).cards);
    setState('in');
  }, []);

  useEffect(() => {
    fetch('/api/admin/login').then((r) => r.json()).then((s) => { setConfigured(s.configured); if (s.signedIn) load(); else setState('out'); });
  }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    if (res.ok) { setPassword(''); load(); } else setMsg((await res.json()).error);
  }
  async function act(id: string, run: () => Promise<Response>) {
    const res = await run();
    if (res.status === 401) return setState('out');
    if (!res.ok) setMsg((await res.json()).error);
    await load();
  }
  const delComment = (id: string) => confirm('Delete this comment?') && act(id, () => fetch(`/api/admin/comments/${id}`, { method: 'DELETE' }));
  const hide = (c: Card) => act(c.id, () => fetch(`/api/admin/cards/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hidden: !c.hidden }) }));
  const del = (c: Card) => confirm('Permanently delete this card?') && act(c.id, () => fetch(`/api/admin/cards/${c.id}`, { method: 'DELETE' }));
  const saveEdit = async () => {
    if (!editing) return;
    await act(editing.id, () => fetch(`/api/admin/cards/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: editing.note, author_name: editing.author }) }));
    setEditing(null);
  };
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!nc.file) return setMsg('Choose a photo first.');
    setMsg('');
    setNc((v) => ({ ...v, busy: true }));
    try {
      const canvas = await composeCard({ photo: await processPhoto(nc.file), frameColor: nc.frame });
      const fd = new FormData();
      fd.append('image', await canvasToBlob(canvas, 'image/jpeg', 0.85), 'card.jpg');
      fd.append('frameColor', nc.frame);
      fd.append('note', nc.note);
      fd.append('authorName', nc.author);
      const res = await fetch('/api/admin/cards', { method: 'POST', body: fd });
      if (res.status === 401) return setState('out');
      if (!res.ok) return setMsg((await res.json().catch(() => ({}))).error || 'Could not create the card.');
      setNc({ file: null, frame: 'blue', note: '', author: '', busy: false });
      setCreating(false);
      load();
    } catch (err) {
      setMsg(err instanceof PhotoError ? err.message : 'Could not create the card.');
    } finally {
      setNc((v) => ({ ...v, busy: false }));
    }
  }
  async function logout() { await fetch('/api/admin/login', { method: 'DELETE' }); setState('out'); }

  return (
    <main className="mx-auto min-h-dvh max-w-5xl p-4 font-sans" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
        <div className="flex gap-2">
          {state === 'in' && <button className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white" onClick={() => setCreating((v) => !v)}>{creating ? 'Cancel' : '+ New card'}</button>}
          <a className="rounded-full border px-4 py-2 text-sm" href="/">← wall</a>
          {state === 'in' && <button className="rounded-full border px-4 py-2 text-sm" onClick={logout}>Sign out</button>}
        </div>
      </header>
      {msg && <p role="alert" className="mb-3 rounded bg-red-100 p-3 text-red-900">{msg}</p>}
      {state === 'loading' && <p>Loading…</p>}
      {state === 'out' && (
        <form onSubmit={login} className="mx-auto mt-10 max-w-sm space-y-3 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold">Admin sign-in</h2>
          {!configured && <p className="rounded bg-amber-100 p-3 text-sm">Admin isn’t configured. Set ADMIN_USERNAME and ADMIN_PASSWORD on the server and restart.</p>}
          <label className="block text-sm font-semibold">Username
            <input autoComplete="username" autoCapitalize="none" className="mt-1 w-full rounded border p-3 text-base" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="block text-sm font-semibold">Password
            <input type="password" autoComplete="current-password" className="mt-1 w-full rounded border p-3 text-base" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="w-full rounded-full bg-black py-3 font-semibold text-white">Sign in</button>
        </form>
      )}
      {state === 'in' && creating && (
        <form onSubmit={create} className="mb-4 space-y-3 rounded-2xl bg-white p-4 shadow">
          <h2 className="text-lg font-bold">New card</h2>
          <label className="block text-sm font-semibold">Photo
            <input type="file" accept="image/*" className="mt-1 block w-full text-base" onChange={(e) => setNc((v) => ({ ...v, file: e.target.files?.[0] ?? null }))} />
          </label>
          <fieldset className="flex items-center gap-2 text-sm font-semibold">Frame
            {FRAME_KEYS.map((k) => (
              <button type="button" key={k} aria-label={`${k} frame`} aria-pressed={nc.frame === k} onClick={() => setNc((v) => ({ ...v, frame: k }))}
                className={`h-8 w-8 rounded-full border-2 ${nc.frame === k ? 'border-black' : 'border-transparent'}`} style={{ background: FRAME_COLORS[k].hex }} />
            ))}
          </fieldset>
          <label className="block text-sm font-semibold">Note
            <textarea maxLength={NOTE_MAX} rows={3} className="mt-1 w-full rounded border p-3 text-base" value={nc.note} onChange={(e) => setNc((v) => ({ ...v, note: e.target.value }))} />
          </label>
          <label className="block text-sm font-semibold">From
            <input maxLength={NAME_MAX} className="mt-1 w-full rounded border p-3 text-base" value={nc.author} onChange={(e) => setNc((v) => ({ ...v, author: e.target.value }))} />
          </label>
          <button disabled={nc.busy} className="rounded-full bg-black px-6 py-3 font-semibold text-white disabled:opacity-60">{nc.busy ? 'Creating…' : 'Create & pin to wall'}</button>
        </form>
      )}
      {state === 'in' && (
        cards.length === 0 ? <p className="rounded-2xl bg-white p-8 text-center text-gray-600">No cards yet.</p> : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <li key={c.id} className="rounded-2xl bg-white p-3 shadow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.image_url} alt="Card" className={`aspect-[4/5] w-full rounded-lg object-cover ${c.hidden ? 'opacity-40' : ''}`} />
                {editing?.id === c.id ? (
                  <div className="mt-2 space-y-2">
                    <input aria-label="Name" maxLength={NAME_MAX} placeholder="Name" className="w-full rounded border p-2 text-base" value={editing.author} onChange={(e) => setEditing({ ...editing, author: e.target.value })} />
                    <textarea aria-label="Note" maxLength={NOTE_MAX} rows={3} placeholder="Note" className="w-full rounded border p-2 text-base" value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
                    <div className="flex gap-2">
                      <button className="flex-1 rounded-full bg-black py-2 text-sm font-semibold text-white" onClick={saveEdit}>Save</button>
                      <button className="flex-1 rounded-full border py-2 text-sm font-semibold" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm"><b>{c.author_name || 'Anonymous'}</b>{c.hidden && <span className="ml-2 rounded bg-red-100 px-2 text-red-800">hidden</span>}</p>
                    <p className="min-h-5 text-sm text-gray-600">{c.note}</p>
                  </>
                )}
                <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString()} · ♥ {c.like_count} · 💬 {c.comment_count}</p>
                {c.comments.length > 0 && (
                  <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t pt-2 text-sm">
                    {c.comments.map((m) => (
                      <li key={m.id} className="flex items-start justify-between gap-2"><span className="break-words"><b>{m.author_name || 'Anonymous'}:</b> {m.body}</span>
                        <button className="shrink-0 text-xs text-red-700 underline" onClick={() => delComment(m.id)} aria-label={`Delete comment by ${m.author_name || 'Anonymous'}`}>delete</button></li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex gap-2">
                  <button className="flex-1 rounded-full border py-2 text-sm font-semibold" onClick={() => setEditing({ id: c.id, note: c.note, author: c.author_name })}>Edit</button>
                  <button className="flex-1 rounded-full border py-2 text-sm font-semibold" onClick={() => hide(c)}>{c.hidden ? 'Show' : 'Hide'}</button>
                  <button className="flex-1 rounded-full border border-red-600 py-2 text-sm font-semibold text-red-700" onClick={() => del(c)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </main>
  );
}
