'use client';
import { useRef } from 'react';
import { FRAME_COLORS, NAME_MAX, NOTE_MAX, type FrameColor } from '@/lib/types';

interface Props {
  frameColor: FrameColor;
  note: string;
  author: string;
  editable?: boolean;
  onNote?: (v: string) => void;
  onAuthor?: (v: string) => void;
}

/** Back of the card: solid brand colour with ruled notebook lines. */
export default function NoteBack({ frameColor, note, author, editable, onNote, onAuthor }: Props) {
  const area = useRef<HTMLTextAreaElement>(null);
  const keepVisible = (e: React.FocusEvent<HTMLElement>) => {
    const el = e.currentTarget;
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  };
  const field = 'w-full rounded-lg bg-white/15 px-[3cqw] text-white placeholder:text-white/60 outline-none focus:bg-white/25';
  return (
    <div className="flex h-full w-full flex-col text-white" style={{ background: FRAME_COLORS[frameColor].hex, containerType: 'inline-size', padding: editable ? 24 : '7cqw' }}>
      {editable ? (
        <>
          <textarea
            ref={area}
            value={note}
            maxLength={NOTE_MAX}
            onChange={(e) => onNote?.(e.target.value)}
            onFocus={keepVisible}
            placeholder="write your message here…"
            aria-label="Your note"
            enterKeyHint="done"
            className="ruled min-h-0 flex-1 resize-none bg-transparent italic text-white placeholder:text-white/65 outline-none"
            style={{ fontSize: 'max(16px, 7cqw)' }}
          />
          <div className="mt-[1cqw] text-right text-[4cqw] opacity-80" aria-live="polite">{note.length}/{NOTE_MAX}</div>
          <div className="mt-[2cqw] flex flex-col gap-[2cqw] italic" style={{ fontSize: 'max(16px, 6cqw)' }}>
            <label className="flex items-center gap-[2cqw]"><span className="shrink-0">from:</span>
              <input value={author} maxLength={NAME_MAX} onChange={(e) => onAuthor?.(e.target.value)} onFocus={keepVisible} autoComplete="name" name="name" placeholder="your name (optional)" className={field} style={{ height: '11cqw' }} />
            </label>
          </div>
        </>
      ) : (
        <>
          <p className="ruled min-h-0 flex-1 overflow-hidden whitespace-pre-wrap break-words italic" style={{ fontSize: '7cqw' }}>{note || 'No note on this one.'}</p>
          {author && <p className="mt-[3cqw] text-right italic" style={{ fontSize: '7cqw' }}>— {author}</p>}
        </>
      )}
    </div>
  );
}
