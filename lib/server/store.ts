import type { Card, Comment } from '../types';
import { createLocalStore } from './local';
import { createSupabaseStore } from './supabase';

export type NewCard = Omit<Card, 'image_url' | 'created_at' | 'hidden' | 'like_count' | 'comment_count'>;
export type RateKind = 'post' | 'comment';

export interface Store {
  mode: 'supabase' | 'demo';
  list(opts: { includeHidden: boolean }): Promise<Card[]>;
  get(id: string): Promise<Card | null>;
  /** Milliseconds timestamp of this device's most recent action of this kind, if any. */
  lastAt(kind: RateKind, deviceId: string): Promise<number | null>;
  record(kind: RateKind, deviceId: string): Promise<void>;
  toggleLike(cardId: string, deviceId: string): Promise<{ liked: boolean; likes: number }>;
  hasLiked(cardId: string, deviceId: string): Promise<boolean>;
  listComments(cardId: string): Promise<Comment[]>;
  addComment(c: { card_id: string; author_name: string; body: string }): Promise<Comment>;
  removeComment(id: string): Promise<boolean>;
  allComments(): Promise<Comment[]>;
  save(card: NewCard, image: Buffer, contentType?: string): Promise<Card>;
  setHidden(id: string, hidden: boolean): Promise<boolean>;
  update(id: string, fields: { note?: string; author_name?: string }): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  readImage?(id: string): Promise<{ data: Buffer; type: string } | null>;
}

let instance: Store | undefined;
export function getStore(): Store {
  if (!instance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    instance = url && key ? createSupabaseStore(url, key) : createLocalStore(process.env.DATA_DIR || '.data');
  }
  return instance;
}
/** Test hook. */
export function setStore(s: Store | undefined) { instance = s; }
