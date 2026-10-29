'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card } from '@/lib/types';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';

export type WallMode = 'supabase' | 'demo';

export function useCards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [mode, setMode] = useState<WallMode | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const known = useRef<Set<string>>(new Set());
  const loaded = useRef(false);

  const mark = useCallback((incoming: Card[]) => {
    const isNew = incoming.filter((c) => !known.current.has(c.id)).map((c) => c.id);
    incoming.forEach((c) => known.current.add(c.id));
    if (loaded.current && isNew.length) setFresh((prev) => new Set([...prev, ...isNew]));
  }, []);

  const upsert = useCallback((card: Card) => {
    if (card.hidden) return setCards((p) => p.filter((c) => c.id !== card.id));
    mark([card]);
    setCards((p) => (p.some((c) => c.id === card.id) ? p.map((c) => (c.id === card.id ? card : c)) : [...p, card]));
  }, [mark]);

  const patch = useCallback((id: string, fields: Partial<Card>) => {
    setCards((p) => p.map((c) => (c.id === id ? { ...c, ...fields } : c)));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/cards', { cache: 'no-store' });
      if (!res.ok) throw new Error('bad status');
      const data = (await res.json()) as { mode: WallMode; cards: Card[] };
      mark(data.cards);
      loaded.current = true;
      setMode(data.mode);
      setCards(data.cards);
      setStatus('ready');
    } catch {
      if (!loaded.current) setStatus('error');
    }
  }, [mark]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Demo mode: poll. Supabase mode: realtime + slow poll as a safety net.
  useEffect(() => {
    if (!mode) return;
    const timer = setInterval(refresh, mode === 'demo' ? 3000 : 30000);
    let cleanup = () => {};
    if (mode === 'supabase' && SUPABASE_URL && SUPABASE_ANON_KEY) {
      import('@supabase/supabase-js').then(({ createClient }) => {
        const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const channel = sb
          .channel('cards-live')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, (payload) => {
            if (payload.eventType === 'DELETE') {
              const id = (payload.old as { id?: string }).id;
              if (id) setCards((p) => p.filter((c) => c.id !== id));
            } else {
              upsert(payload.new as Card);
            }
          })
          .subscribe();
        cleanup = () => { sb.removeChannel(channel); };
      });
    }
    return () => { clearInterval(timer); cleanup(); };
  }, [mode, refresh, upsert]);

  return { cards, mode, status, fresh, refresh, upsert, patch };
}
