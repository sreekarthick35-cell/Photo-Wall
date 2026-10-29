'use client';
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import NoteBack from './NoteBack';
import PushPin from './PushPin';
import { WALL_CARD_H, WALL_CARD_W, type Card } from '@/lib/types';

export default function WallCard({ card, isNew, onOpen }: { card: Card; isNew: boolean; onOpen: (c: Card) => void }) {
  // Tap detection from pointer events (gesture handling on the wall can swallow synthesized clicks).
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const [peek, setPeek] = useState(false); // mouse hover shows the back (note + name)
  return (
    <motion.div
      className="absolute"
      style={{ left: card.x - WALL_CARD_W / 2, top: card.y - WALL_CARD_H / 2, width: WALL_CARD_W, height: WALL_CARD_H, containerType: 'inline-size' }}
      initial={isNew ? { y: -700, opacity: 0, rotate: card.rotation + 24, scale: 1.25 } : false}
      animate={{ y: 0, opacity: 1, rotate: card.rotation, scale: 1 }}
      transition={{ type: 'spring', stiffness: 150, damping: 13, mass: 1.1 }}
    >
      <button
        className="block h-full w-full cursor-pointer transition-transform hover:scale-[1.04]"
        style={{ perspective: 900 }}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setPeek(true); }}
        onPointerLeave={() => setPeek(false)}
        onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY, t: Date.now() }; }}
        onPointerUp={(e) => {
          const d = down.current;
          down.current = null;
          if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8 && Date.now() - d.t < 600) onOpen(card);
        }}
        onClick={(e) => { if (e.detail === 0) onOpen(card); }} // keyboard activation
        aria-label={`Open photo card${card.author_name ? ` from ${card.author_name}` : ''}`}
      >
        <motion.span className="relative block h-full w-full" style={{ transformStyle: 'preserve-3d' }} animate={{ rotateY: peek ? 180 : 0 }} transition={{ type: 'spring', stiffness: 140, damping: 17 }}>
          <span className="face absolute inset-0 block overflow-hidden rounded-[5px] shadow-[0_6px_18px_rgba(40,30,10,.3)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.image_url} alt="" draggable={false} loading="lazy" className="pointer-events-none h-full w-full select-none" />
          </span>
          <span className="face pointer-events-none absolute inset-0 block overflow-hidden rounded-[5px] text-left shadow-[0_6px_18px_rgba(40,30,10,.3)]" style={{ transform: 'rotateY(180deg)' }} aria-hidden>
            <NoteBack frameColor={card.frame_color} note={card.note} author={card.author_name} />
          </span>
        </motion.span>
      </button>
      {(card.like_count > 0 || card.comment_count > 0) && (
        <span className="pointer-events-none absolute left-1/2 top-full mt-2 flex -translate-x-1/2 gap-2 whitespace-nowrap rounded-full bg-white/95 px-3 py-0.5 text-sm shadow btn-mono" aria-label={`${card.like_count} likes, ${card.comment_count} comments`}>
          {card.like_count > 0 && <span><span className="text-red-500">♥</span> {card.like_count}</span>}
          {card.comment_count > 0 && <span>💬 {card.comment_count}</span>}
        </span>
      )}
      <PushPin />
    </motion.div>
  );
}
