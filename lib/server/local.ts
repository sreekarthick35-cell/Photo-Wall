// DEMO persistence: JSON + image files on local disk. Not for production
// (serverless disks are ephemeral). Used when Supabase env vars are absent.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Card, Comment } from '../types';
import type { Store } from './store';

type Stored = Omit<Card, 'like_count' | 'comment_count'>;
interface Data {
  cards: Stored[];
  rate: Record<string, number>;
  likes: Record<string, string[]>; // cardId -> deviceIds
  comments: Comment[];
}

export function createLocalStore(dir: string): Store {
  const root = path.resolve(dir);
  const dbFile = path.join(root, 'cards.json');
  let data: Data | null = null;
  let chain: Promise<unknown> = Promise.resolve();

  async function load(): Promise<Data> {
    if (data) return data;
    await fs.mkdir(path.join(root, 'img'), { recursive: true });
    let raw: Partial<Data> & { posts?: Record<string, number> } = {};
    try {
      raw = JSON.parse(await fs.readFile(dbFile, 'utf8'));
    } catch { /* first run */ }
    data = {
      cards: raw.cards ?? [],
      rate: raw.rate ?? Object.fromEntries(Object.entries(raw.posts ?? {}).map(([k, v]) => [`post:${k}`, v])),
      likes: raw.likes ?? {},
      comments: raw.comments ?? [],
    };
    return data;
  }
  const persist = () => {
    chain = chain.then(async () => {
      const tmp = `${dbFile}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(data));
      await fs.rename(tmp, dbFile);
    });
    return chain;
  };
  const imgPath = (id: string) => path.join(root, 'img', `${id}.bin`);
  const withCounts = (d: Data, c: Stored): Card => ({
    ...c,
    like_count: d.likes[c.id]?.length ?? 0,
    comment_count: d.comments.filter((x) => x.card_id === c.id).length,
  });

  return {
    mode: 'demo',
    async list({ includeHidden }) {
      const d = await load();
      return d.cards.filter((c) => includeHidden || !c.hidden).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((c) => withCounts(d, c));
    },
    async get(id) {
      const d = await load();
      const c = d.cards.find((x) => x.id === id);
      return c ? withCounts(d, c) : null;
    },
    async lastAt(kind, deviceId) {
      return (await load()).rate[`${kind}:${deviceId}`] ?? null;
    },
    async record(kind, deviceId) {
      const d = await load();
      d.rate[`${kind}:${deviceId}`] = Date.now();
      await persist();
    },
    async save(card, image) {
      const d = await load();
      await fs.writeFile(imgPath(card.id), image);
      const full: Stored = { ...card, image_url: `/api/img/${card.id}`, created_at: new Date().toISOString(), hidden: false };
      d.cards.push(full);
      await persist();
      return withCounts(d, full);
    },
    async setHidden(id, hidden) {
      const c = (await load()).cards.find((x) => x.id === id);
      if (!c) return false;
      c.hidden = hidden;
      await persist();
      return true;
    },
    async update(id, fields) {
      const c = (await load()).cards.find((x) => x.id === id);
      if (!c) return false;
      if (fields.note !== undefined) c.note = fields.note;
      if (fields.author_name !== undefined) c.author_name = fields.author_name;
      await persist();
      return true;
    },
    async remove(id) {
      const d = await load();
      const i = d.cards.findIndex((x) => x.id === id);
      if (i < 0) return false;
      d.cards.splice(i, 1);
      delete d.likes[id];
      d.comments = d.comments.filter((c) => c.card_id !== id);
      await persist();
      await fs.rm(imgPath(id), { force: true });
      return true;
    },
    async readImage(id) {
      try {
        const buf = await fs.readFile(imgPath(id));
        return { data: buf, type: buf.subarray(0, 64).toString('utf8').includes('<svg') ? 'image/svg+xml' : 'image/jpeg' };
      } catch {
        return null;
      }
    },
    async toggleLike(cardId, deviceId) {
      const d = await load();
      const set = new Set(d.likes[cardId] ?? []);
      const liked = !set.delete(deviceId);
      if (liked) set.add(deviceId);
      d.likes[cardId] = [...set];
      await persist();
      return { liked, likes: set.size };
    },
    async hasLiked(cardId, deviceId) {
      return (await load()).likes[cardId]?.includes(deviceId) ?? false;
    },
    async listComments(cardId) {
      return (await load()).comments.filter((c) => c.card_id === cardId).sort((a, b) => a.created_at.localeCompare(b.created_at));
    },
    async addComment(c) {
      const d = await load();
      const comment: Comment = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...c };
      d.comments.push(comment);
      await persist();
      return comment;
    },
    async removeComment(id) {
      const d = await load();
      const i = d.comments.findIndex((c) => c.id === id);
      if (i < 0) return false;
      d.comments.splice(i, 1);
      await persist();
      return true;
    },
    async allComments() {
      return [...(await load()).comments];
    },
  };
}
