import { CARD_H, CARD_W, COMMENT_MAX, FRAME_KEYS, NAME_MAX, NOTE_MAX, type FrameColor } from './types';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// eslint-disable-next-line no-control-regex
const clean = (v: unknown) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();

export interface CardFields {
  frame_color: FrameColor;
  note: string;
  author_name: string;
  instagram: string;
}

export function validateFields(input: Record<string, unknown>): { ok: true; fields: CardFields } | { ok: false; error: string } {
  const frame = String(input.frameColor ?? '');
  if (!FRAME_KEYS.includes(frame as FrameColor)) return { ok: false, error: 'Please choose a frame colour.' };
  const note = clean(input.note);
  if (note.length > NOTE_MAX) return { ok: false, error: `Notes can be up to ${NOTE_MAX} characters.` };
  const author = clean(input.authorName).replace(/\s+/g, ' ');
  if (author.length > NAME_MAX) return { ok: false, error: `Names can be up to ${NAME_MAX} characters.` };
  return { ok: true, fields: { frame_color: frame as FrameColor, note, author_name: author, instagram: '' } };
}

/** Verifies real JPEG structure and the exact card dimensions (not the file extension/MIME header). */
export function validateJpeg(buf: Buffer): string | null {
  if (buf.length < 128) return 'The image is empty or damaged.';
  if (buf.length > MAX_IMAGE_BYTES) return 'The image is too large.';
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return 'The card image must be a JPEG.';
  if (buf[buf.length - 2] !== 0xff || buf[buf.length - 1] !== 0xd9) return 'The image is incomplete.';
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return 'The image is damaged.';
    const marker = buf[i + 1];
    if (marker === 0xff) { i++; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc2) {
      const h = buf.readUInt16BE(i + 5);
      const w = buf.readUInt16BE(i + 7);
      return w === CARD_W && h === CARD_H ? null : 'The image has unexpected dimensions.';
    }
    if (marker === 0xda) break;
    i += 2 + len;
  }
  return 'The image is damaged.';
}

export function validateComment(input: { authorName?: unknown; body?: unknown }): { ok: true; author_name: string; body: string } | { ok: false; error: string } {
  const body = clean(input.body).replace(/\s+/g, ' ');
  if (!body) return { ok: false, error: 'Write a comment first.' };
  if (body.length > COMMENT_MAX) return { ok: false, error: `Comments can be up to ${COMMENT_MAX} characters.` };
  const author = clean(input.authorName).replace(/\s+/g, ' ');
  if (author.length > NAME_MAX) return { ok: false, error: `Names can be up to ${NAME_MAX} characters.` };
  return { ok: true, author_name: author, body };
}
