import { createClient } from '@supabase/supabase-js';
import type { Card, Comment } from '../types';
import type { Store } from './store';

const BUCKET = 'cards';
const COLUMNS = 'id,image_url,frame_color,note,author_name,instagram,x,y,rotation,pin_color,created_at,hidden,like_count,comment_count';

export function createSupabaseStore(url: string, serviceKey: string): Store {
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const fail = (what: string, error: { message: string } | null) => {
    if (error) throw new Error(`${what}: ${error.message}`);
  };

  return {
    mode: 'supabase',
    async list({ includeHidden }) {
      let q = db.from('cards').select(COLUMNS).order('created_at', { ascending: true }).limit(2000);
      if (!includeHidden) q = q.eq('hidden', false);
      const { data, error } = await q;
      fail('list cards', error);
      return (data ?? []) as Card[];
    },
    async get(id) {
      const { data, error } = await db.from('cards').select(COLUMNS).eq('id', id).maybeSingle();
      fail('get card', error);
      return (data as Card) ?? null;
    },
    async lastAt(kind, deviceId) {
      const { data, error } = await db.from('rate_log').select('created_at').eq('device_id', deviceId).eq('kind', kind).maybeSingle();
      fail('rate limit lookup', error);
      return data ? new Date(data.created_at).getTime() : null;
    },
    async record(kind, deviceId) {
      const { error } = await db.from('rate_log').upsert({ device_id: deviceId, kind, created_at: new Date().toISOString() });
      fail('rate limit record', error);
    },
    async save(card, image, contentType = 'image/jpeg') {
      const path = `${card.id}.${contentType === 'image/svg+xml' ? 'svg' : 'jpg'}`;
      const up = await db.storage.from(BUCKET).upload(path, image, { contentType, upsert: false, cacheControl: '31536000' });
      fail('upload image', up.error);
      const image_url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const { data, error } = await db.from('cards').insert({ ...card, image_url }).select(COLUMNS).single();
      if (error) {
        await db.storage.from(BUCKET).remove([path]);
        fail('insert card', error);
      }
      return data as Card;
    },
    async setHidden(id, hidden) {
      const { data, error } = await db.from('cards').update({ hidden }).eq('id', id).select('id');
      fail('update card', error);
      return (data?.length ?? 0) > 0;
    },
    async update(id, fields) {
      const { data, error } = await db.from('cards').update(fields).eq('id', id).select('id');
      fail('update card', error);
      return (data?.length ?? 0) > 0;
    },
    async remove(id) {
      const { data, error } = await db.from('cards').delete().eq('id', id).select('id');
      fail('delete card', error);
      await db.storage.from(BUCKET).remove([`${id}.jpg`, `${id}.svg`]);
      return (data?.length ?? 0) > 0;
    },
    async toggleLike(cardId, deviceId) {
      const del = await db.from('likes').delete().eq('card_id', cardId).eq('device_id', deviceId).select('card_id');
      fail('unlike', del.error);
      let liked = false;
      if (!del.data?.length) {
        const ins = await db.from('likes').insert({ card_id: cardId, device_id: deviceId });
        fail('like', ins.error);
        liked = true;
      }
      const { data, error } = await db.from('cards').select('like_count').eq('id', cardId).single();
      fail('like count', error);
      return { liked, likes: (data as { like_count: number }).like_count };
    },
    async hasLiked(cardId, deviceId) {
      const { data, error } = await db.from('likes').select('card_id').eq('card_id', cardId).eq('device_id', deviceId).maybeSingle();
      fail('like lookup', error);
      return Boolean(data);
    },
    async listComments(cardId) {
      const { data, error } = await db.from('comments').select('id,card_id,author_name,body,created_at').eq('card_id', cardId).order('created_at', { ascending: true }).limit(500);
      fail('list comments', error);
      return (data ?? []) as Comment[];
    },
    async addComment(c) {
      const { data, error } = await db.from('comments').insert(c).select('id,card_id,author_name,body,created_at').single();
      fail('add comment', error);
      return data as Comment;
    },
    async removeComment(id) {
      const { data, error } = await db.from('comments').delete().eq('id', id).select('id');
      fail('delete comment', error);
      return (data?.length ?? 0) > 0;
    },
    async allComments() {
      const { data, error } = await db.from('comments').select('id,card_id,author_name,body,created_at').order('created_at', { ascending: true }).limit(5000);
      fail('list comments', error);
      return (data ?? []) as Comment[];
    },
  };
}
