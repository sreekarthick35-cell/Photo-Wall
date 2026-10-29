'use client';
import { motion } from 'framer-motion';

/** 3D rotateY flip between a front and a back face. Only the visible face is interactive. */
export default function FlipCard({ flipped, front, back, width }: { flipped: boolean; front: React.ReactNode; back: React.ReactNode; width: number | string }) {
  return (
    <div style={{ width, aspectRatio: '4 / 5', perspective: 1400 }}>
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 16 }}
      >
        <div className="face absolute inset-0 overflow-hidden rounded-md shadow-[0_14px_40px_rgba(0,0,0,.28)]" style={{ pointerEvents: flipped ? 'none' : 'auto' }} aria-hidden={flipped}>{front}</div>
        <div className="face absolute inset-0 overflow-hidden rounded-md shadow-[0_14px_40px_rgba(0,0,0,.28)]" style={{ transform: 'rotateY(180deg)', pointerEvents: flipped ? 'auto' : 'none' }} aria-hidden={!flipped}>{back}</div>
      </motion.div>
    </div>
  );
}
