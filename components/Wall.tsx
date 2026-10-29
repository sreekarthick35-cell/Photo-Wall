'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'framer-motion';
import { useGesture } from '@use-gesture/react';
import Wordmark from './Wordmark';
import WallCard from './WallCard';
import AddFlow from './AddFlow';
import CardViewer from './CardViewer';
import { useCards } from '@/hooks/useCards';
import { COMMUNITY, EVENT_NAME } from '@/lib/config';
import { COOLDOWN_MS, type Card } from '@/lib/types';

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;
const COOLDOWN_KEY = 'pw_cooldown_until';
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function Wall() {
  const { cards, mode, status, fresh, refresh, upsert, patch } = useCards();
  const onCounts = useCallback((id: string, likes: number, comments: number) => patch(id, { like_count: likes, comment_count: comments }), [patch]);
  const [viewer, setViewer] = useState<Card | null>(null);
  const [adding, setAdding] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const box = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const homeScale = useRef(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);

  useEffect(() => {
    homeScale.current = window.innerWidth < 640 ? 0.7 : 1;
    scale.set(homeScale.current);
    try {
      const saved = Number(localStorage.getItem(COOLDOWN_KEY));
      if (saved > Date.now()) setCooldownUntil(saved);
    } catch { /* storage unavailable */ }
  }, [scale]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [cooldownUntil]);
  const wait = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const startCooldown = useCallback((seconds = COOLDOWN_MS / 1000) => {
    const until = Date.now() + seconds * 1000;
    setCooldownUntil(until);
    setNow(Date.now());
    try { localStorage.setItem(COOLDOWN_KEY, String(until)); } catch { /* ignore */ }
  }, []);

  const zoomAbout = useCallback((ox: number, oy: number, next: number) => {
    const s = scale.get();
    const target = clamp(next, MIN_SCALE, MAX_SCALE);
    const r = target / s;
    x.set(ox - (ox - x.get()) * r);
    y.set(oy - (oy - y.get()) * r);
    scale.set(target);
  }, [scale, x, y]);
  const centreOf = () => {
    const r = box.current!.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };

  useGesture(
    {
      onDrag: ({ delta: [dx, dy], tap, pinching, cancel }) => {
        if (pinching) return cancel();
        if (!tap) moved.current = true;
        x.set(x.get() + dx);
        y.set(y.get() + dy);
      },
      onPinch: ({ offset: [s], origin: [ox, oy] }) => {
        moved.current = true;
        const { cx, cy } = centreOf();
        zoomAbout(ox - cx, oy - cy, s);
      },
      onWheel: ({ event, delta: [dx, dy] }) => {
        if (event.ctrlKey || event.metaKey) return; // handled as pinch
        x.set(x.get() - dx);
        y.set(y.get() - dy);
      },
    },
    {
      target: box,
      eventOptions: { passive: false },
      drag: { filterTaps: true, pointer: { touch: true } },
      pinch: { from: () => [scale.get(), 0], scaleBounds: { min: MIN_SCALE, max: MAX_SCALE }, rubberband: true },
    },
  );

  const glideTo = (wx: number, wy: number, s = scale.get()) => {
    const opts = { type: 'spring' as const, stiffness: 90, damping: 18 };
    animate(x, -wx * s, opts);
    animate(y, -wy * s, opts);
    animate(scale, s, opts);
  };
  const recenter = () => glideTo(0, 0, homeScale.current);
  const zoomButton = (f: number) => zoomAbout(0, 0, scale.get() * f); // (0,0) = viewport centre

  function onPosted(card: Card) {
    upsert(card);
    startCooldown();
    setAdding(false);
    glideTo(card.x, card.y, Math.max(scale.get(), homeScale.current));
  }
  const open = (c: Card) => setViewer(c);

  return (
    <main className="fixed inset-0 overflow-hidden">
      <div ref={box} onPointerDownCapture={() => { moved.current = false; }} className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing" aria-label="Photo wall. Drag to explore, pinch to zoom.">
        <motion.div className="absolute left-1/2 top-1/2 h-0 w-0" style={{ x, y, scale, transformOrigin: '0 0' }}>
          <div className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 select-none flex-col items-center" style={{ width: 480 }}>
            <Wordmark className="w-full" distort color="#1d1b18" shadow="#ff7417" />
            <h1 className="-mt-2 text-5xl italic">{EVENT_NAME}</h1>
            <span className="mt-3 rounded-full bg-ink px-4 py-1 text-xl italic text-white">Built with <span aria-label="love" className="text-red-400">❤</span> by {COMMUNITY}</span>
          </div>
          {cards.map((c) => (
            <WallCard key={c.id} card={c} isNew={fresh.has(c.id)} onOpen={open} />
          ))}
        </motion.div>
      </div>

      {status === 'loading' && <p className="pointer-events-none absolute inset-x-0 top-24 text-center text-3xl italic" role="status">loading the wall…</p>}
      {status === 'error' && (
        <div className="absolute inset-x-4 top-20 mx-auto max-w-sm rounded-2xl bg-red-100 p-4 text-center text-xl text-red-900" role="alert">
          We couldn’t load the wall. Check your connection.
          <button className="btn-mono mt-3 block w-full rounded-full bg-ink py-3 text-sm text-white" onClick={refresh}>Try again</button>
        </div>
      )}
      {status === 'ready' && cards.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-32 text-center text-3xl italic">the wall is empty — be the first to pin a photo!</p>
      )}
      {mode === 'demo' && <p className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-base italic text-white" style={{ marginTop: 'env(safe-area-inset-top)' }}>demo mode · local storage</p>}

      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2" style={{ marginRight: 'env(safe-area-inset-right)' }}>
        <button className="btn-mono h-11 w-11 rounded-full bg-white/90 text-xl shadow" onClick={() => zoomButton(1.25)} aria-label="Zoom in">+</button>
        <button className="btn-mono h-11 w-11 rounded-full bg-white/90 text-xl shadow" onClick={() => zoomButton(0.8)} aria-label="Zoom out">−</button>
      </div>

      <nav className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 px-4 pt-3" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }} aria-label="Wall actions">
        <button className="btn-mono rounded-full bg-white/95 px-5 py-4 text-sm shadow-lg" onClick={recenter}>Recenter</button>
        <button
          className="btn-mono rounded-full bg-ink px-6 py-4 text-sm text-white shadow-lg disabled:opacity-70"
          onClick={() => setAdding(true)}
          disabled={wait > 0}
        >
          {wait > 0 ? `Posted – wait ${wait}s` : '+ Add photo'}
        </button>
      </nav>

      {adding && <AddFlow onClose={() => setAdding(false)} onPosted={onPosted} onCooldown={startCooldown} />}
      {viewer && <CardViewer card={viewer} onClose={() => setViewer(null)} onCounts={onCounts} />}
    </main>
  );
}
