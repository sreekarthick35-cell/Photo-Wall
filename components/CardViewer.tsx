'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import FlipCard from './FlipCard';
import NoteBack from './NoteBack';
import { NAME_MAX, COMMENT_MAX, type Card } from '@/lib/types';
import { useViewportHeight } from '@/hooks/useViewportHeight';

interface PublicComment { id: string; author_name: string; body: string; created_at: string }

const NAME_KEY = 'pw_comment_name';
const ACTIONS_H = 230; // space reserved below the card for hint + actions

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function CardViewer({ card, onClose, onCounts }: { card: Card; onClose: () => void; onCounts: (id: string, likes: number, comments: number) => void }) {
  const vvh = useViewportHeight();
  const [flipped, setFlipped] = useState(false);
  const [width, setWidth] = useState(320);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(card.like_count);
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [note, setNote] = useState('');
  const likeBusy = useRef(false);
  const listEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fit = () => setWidth(Math.max(200, Math.min(window.innerWidth - 40, 460, (window.innerHeight - ACTIONS_H) * 0.8)));
    fit();
    window.addEventListener('resize', fit);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    try { setName(localStorage.getItem(NAME_KEY) ?? ''); } catch { /* storage unavailable */ }
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('keydown', key); };
  }, [onClose]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/cards/${card.id}/engagement`, { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      setLiked(d.liked);
      setLikes(d.likes);
      setComments(d.comments);
      onCounts(card.id, d.likes, d.comments.length);
    } catch { /* keep what we have */ }
  }, [card.id, onCounts]);

  useEffect(() => { load(); }, [load]);
  // Keep comments fresh while the panel is open.
  useEffect(() => {
    if (!showComments) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [showComments, load]);
  useEffect(() => { if (showComments) listEnd.current?.scrollIntoView({ block: 'end' }); }, [comments.length, showComments]);

  async function toggleLike() {
    if (likeBusy.current) return;
    likeBusy.current = true;
    const prev = { liked, likes };
    setLiked(!liked); // optimistic
    setLikes(likes + (liked ? -1 : 1));
    try {
      const res = await fetch(`/api/cards/${card.id}/like`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setLiked(d.liked);
      setLikes(d.likes);
      onCounts(card.id, d.likes, comments.length);
    } catch {
      setLiked(prev.liked);
      setLikes(prev.likes);
      setNote('Couldn’t save your like. Check your connection.');
      setTimeout(() => setNote(''), 3000);
    } finally {
      likeBusy.current = false;
    }
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/cards/${card.id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ authorName: name, body: text }) });
      const d = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setText('');
        try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
        const next = [...comments, d.comment];
        setComments(next);
        onCounts(card.id, likes, next.length);
      } else setError(d.error || 'Couldn’t post your comment.');
    } catch {
      setError('We couldn’t reach the server. Your comment is still here — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (downloading) return;
    setDownloading(true);
    try {
      const blob = await (await fetch(card.image_url)).blob();
      const ext = blob.type.includes('svg') ? 'svg' : blob.type.includes('png') ? 'png' : 'jpg';
      const who = card.author_name ? `-${card.author_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` : '';
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `photo-card${who}.${ext}` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch {
      window.open(card.image_url, '_blank', 'noopener'); // fallback: let the browser handle it
    } finally {
      setDownloading(false);
    }
  }

  const alt = `Photo card${card.author_name ? ` from ${card.author_name}` : ''}`;
  const btn = 'btn-mono flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm shadow disabled:opacity-60';
  return (
    <div className="fixed inset-x-0 top-0 z-40 bg-black/60" style={{ height: vvh ?? '100dvh' }} onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-label={alt}>
      <div className="flex h-full flex-col items-center justify-center gap-3 overflow-y-auto p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="relative" style={{ width, containerType: 'inline-size' }}>
          <FlipCard
            width="100%"
            flipped={flipped}
            front={
              <button className="relative block h-full w-full" onClick={() => setFlipped(true)} aria-label="Flip card to read the note">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.image_url} alt={alt} className="h-full w-full" />
              </button>
            }
            back={
              <button className="block h-full w-full text-left" onClick={() => setFlipped(false)} aria-label="Flip card back to the photo">
                <NoteBack frameColor={card.frame_color} note={card.note} author={card.author_name} />
              </button>
            }
          />
        </div>
        <p className="text-xl italic text-white">tap the card to flip it</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button className={btn} onClick={toggleLike} aria-pressed={liked} aria-label={liked ? 'Unlike' : 'Like'}>
            <span aria-hidden className={liked ? 'text-red-500' : ''}>{liked ? '♥' : '♡'}</span>{likes}
          </button>
          <button className={btn} onClick={() => setShowComments((v) => !v)} aria-expanded={showComments} aria-label={`Comments (${comments.length})`}>
            <span aria-hidden>💬</span>{comments.length}
          </button>
          <button className={btn} onClick={download} disabled={downloading}>
            <span aria-hidden>⬇</span>{downloading ? '…' : 'Download'}
          </button>
          <button className={`${btn} !bg-ink !text-white`} onClick={onClose} autoFocus>Close</button>
        </div>
        {note && <p role="alert" className="rounded-full bg-red-100 px-4 py-1 text-lg text-red-800">{note}</p>}
      </div>

      {showComments && (
        <section className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl bg-cream shadow-2xl" style={{ height: 'min(72%, 560px)', paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Comments">
          <header className="flex items-center justify-between px-5 pt-3">
            <h2 className="text-3xl italic">comments ({comments.length})</h2>
            <button className="rounded-full px-3 py-1 text-2xl italic" onClick={() => setShowComments(false)} aria-label="Hide comments">✕</button>
          </header>
          <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-2" aria-live="polite">
            {comments.length === 0 && <li className="py-6 text-center text-2xl italic text-black/50">no comments yet — say something nice!</li>}
            {comments.map((c) => (
              <li key={c.id} className="rounded-2xl bg-white/70 px-4 py-2">
                <p className="text-xl leading-tight"><b>{c.author_name || 'Anonymous'}</b> <span className="text-base text-black/45">{timeAgo(c.created_at)}</span></p>
                <p className="break-words text-xl leading-snug" style={{ fontFamily: 'system-ui, sans-serif', fontSize: 15 }}>{c.body}</p>
              </li>
            ))}
            <div ref={listEnd} />
          </ul>
          <form onSubmit={sendComment} className="border-t border-black/10 px-4 py-3">
            {error && <p role="alert" className="mb-2 text-lg text-red-800">{error}</p>}
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} autoComplete="name" name="name" placeholder="name (optional)" aria-label="Your name (optional)" className="w-2/5 rounded-xl border border-black/20 bg-white px-3 py-2" style={{ fontSize: 16 }} />
              <input value={text} onChange={(e) => { setText(e.target.value); setError(''); }} maxLength={COMMENT_MAX} placeholder="add a comment…" aria-label="Comment" enterKeyHint="send" className="min-w-0 flex-1 rounded-xl border border-black/20 bg-white px-3 py-2" style={{ fontSize: 16 }} onFocus={(e) => { const el = e.currentTarget; setTimeout(() => el.scrollIntoView({ block: 'nearest' }), 300); }} />
              <button className="btn-mono rounded-xl bg-ink px-4 text-sm text-white disabled:opacity-50" disabled={busy || !text.trim()}>{busy ? '…' : 'Post'}</button>
            </div>
            <p className="mt-1 text-right text-base text-black/50">{text.length}/{COMMENT_MAX}</p>
          </form>
        </section>
      )}
    </div>
  );
}
