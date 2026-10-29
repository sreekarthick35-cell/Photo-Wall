import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ADMIN_PASSWORD = 'test-password';
process.env.SESSION_SECRET = 'test-secret';
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
const { NextRequest } = await import('next/server');
const { setStore } = await import('../lib/server/store');
const { createLocalStore } = await import('../lib/server/local');
const cards = await import('../app/api/cards/route');
const login = await import('../app/api/admin/login/route');
const adminCards = await import('../app/api/admin/cards/route');
const adminCard = await import('../app/api/admin/cards/[id]/route');
const likeRoute = await import('../app/api/cards/[id]/like/route');
const commentRoute = await import('../app/api/cards/[id]/comments/route');
const engagementRoute = await import('../app/api/cards/[id]/engagement/route');
const adminComment = await import('../app/api/admin/comments/[id]/route');
const { pickSpot } = await import('../lib/placement');
const { validateJpeg } = await import('../lib/validate');

setStore(createLocalStore(fs.mkdtempSync(path.join(os.tmpdir(), 'pw-test-'))));

// Minimal structurally-valid JPEG: SOI, SOF0 (dims), padding, EOI.
function jpeg(w = 900, h = 1125, pad = 200) {
  const sof = Buffer.from([0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.alloc(pad, 1), Buffer.from([0xff, 0xd9])]);
}
function post(img: Buffer | null, fields: Record<string, string> = {}, device?: string) {
  const fd = new FormData();
  const all = { frameColor: 'blue', note: 'hi', authorName: 'Asha', instagram: '', ...fields };
  for (const [k, v] of Object.entries(all)) fd.append(k, v);
  if (img) fd.append('image', new Blob([new Uint8Array(img)], { type: 'image/jpeg' }), 'card.jpg');
  return cards.POST(new NextRequest('http://localhost/api/cards', { method: 'POST', body: fd, headers: device ? { cookie: `pw_device=${device}` } : {} }));
}
const uuid = () => crypto.randomUUID();

test('creates a card, then rate-limits the same device for 15s', async () => {
  const device = uuid();
  const r1 = await post(jpeg(), {}, device);
  assert.equal(r1.status, 201);
  const { card } = await r1.json();
  assert.ok(Math.abs(card.rotation) <= 8);
  assert.equal(card.hidden, false);
  const r2 = await post(jpeg(900, 1125, 300), {}, device);
  assert.equal(r2.status, 429);
  assert.ok((await r2.json()).retryAfter > 0);
  // a different device is not limited
  assert.equal((await post(jpeg(900, 1125, 400), {}, uuid())).status, 201);
});

test('rejects bad images and fields', async () => {
  assert.equal((await post(Buffer.from('<?php system($_GET[1]); ?>'.repeat(10)), {}, uuid())).status, 400);
  assert.equal((await post(jpeg(100, 100), {}, uuid())).status, 400);
  assert.equal((await post(null, {}, uuid())).status, 400);
  assert.equal((await post(jpeg(900, 1125, 501), { frameColor: 'pink' }, uuid())).status, 400);
  assert.equal((await post(jpeg(900, 1125, 502), { note: 'x'.repeat(141) }, uuid())).status, 400);
  assert.equal(validateJpeg(jpeg(900, 1125, 3 * 1024 * 1024)), 'The image is too large.');
});

test('public list hides hidden cards; admin can hide, show and delete', async () => {
  const { card } = await (await post(jpeg(900, 1125, 600), {}, uuid())).json();
  const listIds = async () => (await (await cards.GET()).json()).cards.map((c: { id: string }) => c.id);
  assert.ok((await listIds()).includes(card.id));

  // unauthenticated admin calls
  assert.equal((await adminCards.GET(new NextRequest('http://localhost/api/admin/cards'))).status, 401);
  const patch = (cookie?: string) => adminCard.PATCH(new NextRequest(`http://localhost/api/admin/cards/${card.id}`, { method: 'PATCH', body: JSON.stringify({ hidden: true }), headers: cookie ? { cookie } : {} }), { params: Promise.resolve({ id: card.id }) });
  assert.equal((await patch()).status, 401);
  assert.equal((await patch('pw_admin=forged.value')).status, 401);

  const bad = await login.POST(new NextRequest('http://localhost/api/admin/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'nope' }) }));
  assert.equal(bad.status, 401);
  const ok = await login.POST(new NextRequest('http://localhost/api/admin/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'test-password' }) }));
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get('set-cookie')!.split(';')[0];

  assert.equal((await patch(cookie)).status, 200);
  assert.ok(!(await listIds()).includes(card.id));
  const all = await (await adminCards.GET(new NextRequest('http://localhost/api/admin/cards', { headers: { cookie } }))).json();
  assert.ok(all.cards.some((c: { id: string; hidden: boolean }) => c.id === card.id && c.hidden));

  const del = await adminCard.DELETE(new NextRequest(`http://localhost/api/admin/cards/${card.id}`, { method: 'DELETE', headers: { cookie } }), { params: Promise.resolve({ id: card.id }) });
  assert.equal(del.status, 200);
});

test('admin: wrong username rejected, can create and edit a card', async () => {
  const L = (body: object) => login.POST(new NextRequest('http://localhost/api/admin/login', { method: 'POST', body: JSON.stringify(body) }));
  assert.equal((await L({ username: 'someone', password: 'test-password' })).status, 401);
  const cookie = (await L({ username: 'Admin', password: 'test-password' })).headers.get('set-cookie')!.split(';')[0];

  const create = (c?: string, fields: Record<string, string> = {}) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ frameColor: 'green', note: 'from admin', authorName: 'Boss', ...fields })) fd.append(k, v);
    fd.append('image', new Blob([new Uint8Array(jpeg(900, 1125, 700))], { type: 'image/jpeg' }), 'card.jpg');
    return adminCards.POST(new NextRequest('http://localhost/api/admin/cards', { method: 'POST', body: fd, headers: c ? { cookie: c } : {} }));
  };
  assert.equal((await create()).status, 401);
  assert.equal((await create(cookie, { note: 'x'.repeat(141) })).status, 400);
  const r = await create(cookie);
  assert.equal(r.status, 201);
  const { card } = await r.json();
  assert.equal(card.author_name, 'Boss');
  assert.ok((await (await cards.GET()).json()).cards.some((c: { id: string }) => c.id === card.id));

  const edit = (c: string | undefined, body: object) => adminCard.PATCH(new NextRequest('http://localhost/x', { method: 'PATCH', body: JSON.stringify(body), headers: c ? { cookie: c } : {} }), { params: Promise.resolve({ id: card.id }) });
  assert.equal((await edit(undefined, { note: 'hack' })).status, 401);
  assert.equal((await edit(cookie, { note: 'y'.repeat(141) })).status, 400);
  assert.equal((await edit(cookie, { note: 'edited', author_name: 'Renamed' })).status, 200);
  const after = (await (await cards.GET()).json()).cards.find((c: { id: string }) => c.id === card.id);
  assert.equal(after.note, 'edited');
  assert.equal(after.author_name, 'Renamed');
});

test('placement avoids overlaps and the centre logo', () => {
  const placed: { x: number; y: number }[] = [];
  for (let i = 0; i < 80; i++) placed.push(pickSpot(placed));
  for (const p of placed) assert.ok(!(Math.abs(p.x) < 440 && Math.abs(p.y) < 340), 'inside logo zone');
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j];
    assert.ok(!(Math.abs(a.x - b.x) < 200 && Math.abs(a.y - b.y) < 250), `overlap ${i}/${j}`);
  }
});

test('likes are one per device and toggle; counts show in the list', async () => {
  const { card } = await (await post(jpeg(900, 1125, 700), {}, uuid())).json();
  const params = { params: Promise.resolve({ id: card.id }) };
  const like = (dev: string) => likeRoute.POST(new NextRequest(`http://localhost/api/cards/${card.id}/like`, { method: 'POST', headers: { cookie: `pw_device=${dev}` } }), params);
  const a = uuid(), b = uuid();
  assert.deepEqual(await (await like(a)).json(), { liked: true, likes: 1 });
  assert.deepEqual(await (await like(b)).json(), { liked: true, likes: 2 });
  assert.deepEqual(await (await like(a)).json(), { liked: false, likes: 1 });
  const eng = await (await engagementRoute.GET(new NextRequest('http://localhost/x', { headers: { cookie: `pw_device=${b}` } }), params)).json();
  assert.equal(eng.liked, true);
  const listed = (await (await cards.GET()).json()).cards.find((c: { id: string }) => c.id === card.id);
  assert.equal(listed.like_count, 1);
  const missing = await likeRoute.POST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: uuid() }) });
  assert.equal(missing.status, 404);
});

test('comments: validation, cooldown, listing, admin delete', async () => {
  const { card } = await (await post(jpeg(900, 1125, 800), {}, uuid())).json();
  const params = { params: Promise.resolve({ id: card.id }) };
  const comment = (body: unknown, dev: string) => commentRoute.POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(body), headers: { cookie: `pw_device=${dev}` } }), params);
  const dev = uuid();
  assert.equal((await comment({ body: '   ' }, dev)).status, 400);
  assert.equal((await comment({ body: 'x'.repeat(201) }, dev)).status, 400);
  const ok = await comment({ authorName: 'Ravi', body: 'Great photo!' }, dev);
  assert.equal(ok.status, 201);
  const { comment: created } = await ok.json();
  assert.equal((await comment({ body: 'again' }, dev)).status, 429);
  assert.equal((await comment({ body: 'other person' }, uuid())).status, 201);
  const eng = await (await engagementRoute.GET(new NextRequest('http://localhost/x'), params)).json();
  assert.equal(eng.comments.length, 2);
  assert.equal((await (await cards.GET()).json()).cards.find((c: { id: string }) => c.id === card.id).comment_count, 2);

  const del = (cookie?: string) => adminComment.DELETE(new NextRequest('http://localhost/x', { method: 'DELETE', headers: cookie ? { cookie } : {} }), { params: Promise.resolve({ id: created.id }) });
  assert.equal((await del()).status, 401);
  const ok2 = await login.POST(new NextRequest('http://localhost/api/admin/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'test-password' }) }));
  assert.equal((await del(ok2.headers.get('set-cookie')!.split(';')[0])).status, 200);
  assert.equal((await (await engagementRoute.GET(new NextRequest('http://localhost/x'), params)).json()).comments.length, 1);
});
