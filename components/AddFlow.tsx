'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import FlipCard from './FlipCard';
import NoteBack from './NoteBack';
import Printer from './Printer';
import { canvasToBlob, composeCard } from '@/lib/compose';
import { PhotoError, processPhoto } from '@/lib/image';
import { FRAME_COLORS, FRAME_KEYS, type Card, type FrameColor } from '@/lib/types';
import { useViewportHeight } from '@/hooks/useViewportHeight';
import { EVENT_NAME } from '@/lib/config';

type Step = 'sheet' | 'processing' | 'printing' | 'preview' | 'note';

interface Props {
  onClose: () => void;
  onPosted: (card: Card) => void;
  onCooldown: (seconds: number) => void;
}

const HEADER_H = 60;
const CONTROLS_H = 170;

export default function AddFlow({ onClose, onPosted, onCooldown }: Props) {
  const vvh = useViewportHeight();
  const [step, setStep] = useState<Step>('sheet');
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [frame, setFrame] = useState<FrameColor>('blue');
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [author, setAuthor] = useState('');
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const libRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stableH = useRef(typeof window === 'undefined' ? 700 : window.innerHeight);

  // Card width is fixed per session of the flow (ignores the keyboard) so the flip doesn't jump.
  const cardW = useMemo(() => {
    const vw = typeof window === 'undefined' ? 390 : window.innerWidth;
    return Math.max(240, Math.min(vw - 40, 400, (stableH.current - HEADER_H - CONTROLS_H) * 0.8));
  }, []);

  // Re-compose the preview whenever the photo or frame colour changes.
  useEffect(() => {
    if (!photo) return;
    let live = true;
    composeCard({ photo, frameColor: frame }).then((c) => live && setPreview(c.toDataURL('image/jpeg', 0.9)));
    return () => { live = false; };
  }, [photo, frame]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !posting && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, posting]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setStep('processing');
    try {
      const canvas = await processPhoto(file);
      setPhoto(canvas);
      setStep('printing');
    } catch (err) {
      setError(err instanceof PhotoError ? err.message : 'Something went wrong with that photo.');
      setStep('sheet');
    }
  }

  async function share() {
    if (!photo || sharing) return;
    setSharing(true);
    setError('');
    try {
      const canvas = await composeCard({ photo, frameColor: frame });
      const blob = await canvasToBlob(canvas, 'image/png');
      const file = new File([blob], 'my-photo-card.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: EVENT_NAME });
      } else {
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'my-photo-card.png' });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError('Couldn’t share the card. Try again.');
    } finally {
      setSharing(false);
    }
  }

  async function pin() {
    if (!photo || posting) return;
    setPosting(true);
    setError('');
    try {
      const canvas = await composeCard({ photo, frameColor: frame });
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
      const fd = new FormData();
      fd.append('image', blob, 'card.jpg');
      fd.append('frameColor', frame);
      fd.append('note', note);
      fd.append('authorName', author);
      const res = await fetch('/api/cards', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) return onPosted(data.card as Card);
      if (res.status === 429) onCooldown(data.retryAfter ?? 15);
      setError(data.error || 'Something went wrong. Please try again.');
    } catch {
      setError('We couldn’t reach the server. Your card is still here — try again.');
    } finally {
      setPosting(false);
    }
  }

  const pickers = (
    <>
      <input ref={libRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
    </>
  );

  if (step === 'sheet' || step === 'processing') {
    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/45" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {pickers}
        <motion.div initial={{ y: 200 }} animate={{ y: 0 }} className="w-full rounded-t-3xl bg-cream p-5 shadow-2xl" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }} role="dialog" aria-label="Add a photo">
          <p className="mb-3 text-center text-3xl italic">add a photo</p>
          {error && <p role="alert" className="mb-3 rounded-xl bg-red-100 px-4 py-2 text-center text-xl text-red-800">{error}</p>}
          {step === 'processing' ? (
            <p className="py-8 text-center text-2xl italic" role="status">getting your photo ready…</p>
          ) : (
            <div className="flex flex-col gap-3">
              <button className="btn-mono rounded-full bg-ink py-4 text-white" onClick={() => libRef.current?.click()}>Photo library</button>
              <button className="btn-mono rounded-full border-2 border-ink py-4" onClick={() => fileRef.current?.click()}>Choose file</button>
              <button className="py-2 text-2xl italic underline" onClick={onClose}>cancel</button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  const inNote = step === 'note';
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex flex-col bg-cream" style={{ height: vvh ?? '100dvh', paddingTop: 'env(safe-area-inset-top)' }} role="dialog" aria-label="Your photo card">
      <header className="flex shrink-0 items-center justify-between px-4" style={{ height: HEADER_H }}>
        <button className="rounded-full px-3 py-2 text-2xl italic" onClick={onClose} disabled={posting} aria-label="Close">✕ close</button>
        <span className="text-3xl italic">{step === 'printing' ? 'printing…' : inNote ? 'write a note' : 'your photo'}</span>
        <span className="w-20" />
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 pb-4">
        {step === 'printing' && preview ? (
          <Printer src={preview} width={cardW} onDone={() => setStep('preview')} />
        ) : (
          <div className="my-auto py-2">
            <FlipCard
              width={cardW}
              flipped={inNote}
              front={preview ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt="Your photo in a framed card" className="h-full w-full" /> : <div className="h-full w-full animate-pulse bg-black/10" />}
              back={<NoteBack frameColor={frame} note={note} author={author} editable onNote={setNote} onAuthor={setAuthor} />}
            />
          </div>
        )}
        {error && step !== 'printing' && <p role="alert" className="mb-2 max-w-sm rounded-xl bg-red-100 px-4 py-2 text-center text-xl text-red-800">{error}</p>}
      </main>

      {step !== 'printing' && (
        <footer className="shrink-0 border-t border-black/10 bg-cream px-4 pt-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {!inNote && (
            <div className="mb-3 flex items-center justify-center gap-3" role="radiogroup" aria-label="Frame colour">
              {FRAME_KEYS.map((k) => (
                <button key={k} role="radio" aria-checked={frame === k} aria-label={FRAME_COLORS[k].label} onClick={() => setFrame(k)}
                  className="h-10 w-10 rounded-full border-4 transition-transform active:scale-90" style={{ background: FRAME_COLORS[k].hex, borderColor: frame === k ? '#1d1b18' : 'white', transform: frame === k ? 'scale(1.15)' : undefined }} />
              ))}
            </div>
          )}
          <div className="mx-auto flex max-w-md items-center gap-2">
            {inNote ? (
              <button className="btn-mono rounded-full border-2 border-ink px-4 py-3 text-sm" onClick={() => { setStep('preview'); setError(''); }} disabled={posting}>← photo</button>
            ) : (
              <>
                <button className="btn-mono rounded-full border-2 border-ink px-4 py-3 text-sm" onClick={() => setStep('note')}>✎ note</button>
                <button className="btn-mono rounded-full border-2 border-ink px-4 py-3 text-sm disabled:opacity-50" onClick={share} disabled={!preview || sharing}>{sharing ? '…' : 'Share'}</button>
              </>
            )}
            <button className="btn-mono flex-1 rounded-full bg-ink px-4 py-3 text-sm text-white disabled:opacity-60" onClick={pin} disabled={posting || !preview}>{posting ? 'Pinning…' : 'Pin to wall'}</button>
          </div>
        </footer>
      )}
    </div>
  );
}
