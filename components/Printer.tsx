'use client';
import { motion } from 'framer-motion';

/** Printer slot with the card sliding out and a mechanical wobble (~2s). */
export default function Printer({ src, width, onDone }: { src: string; width: number; onDone: () => void }) {
  return (
    <div className="flex flex-col items-center" style={{ width: width + 40 }} aria-live="polite">
      <div className="relative z-10 h-24 w-full rounded-[28px] bg-[#2a2926] shadow-[0_10px_30px_rgba(0,0,0,.35)]">
        <div className="absolute left-5 top-4 flex gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#4ade80]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#facc15]" />
        </div>
        <div className="absolute bottom-3 left-1/2 h-3 -translate-x-1/2 rounded-full bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,.9)]" style={{ width: width + 12 }} />
        <span className="absolute right-5 top-3 text-lg italic text-white/80">printing…</span>
      </div>
      <div className="-mt-2 overflow-hidden" style={{ width: width + 12, paddingBottom: 24 }}>
        <motion.div
          initial={{ y: '-100%' }}
          animate={{ y: ['-100%', '-70%', '-72%', '-38%', '-40%', '-8%', '0%'], rotate: [0, -1.2, 1.4, -1, 1.2, -0.5, 0] }}
          transition={{ duration: 2.2, ease: 'easeInOut' }}
          onAnimationComplete={onDone}
          className="mx-auto"
          style={{ width }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Your printed card" className="block w-full rounded-md shadow-[0_8px_24px_rgba(0,0,0,.3)]" />
        </motion.div>
      </div>
    </div>
  );
}
