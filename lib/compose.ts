import { CARD_H, CARD_W, FRAME_COLORS, type FrameColor } from './types';
import { COMMUNITY, WORDMARK } from './config';
import { glyphJitter } from './wordmark';

// Layout of the card image (px).
export const PHOTO = { x: 54, y: 150, size: 792 };

const cssVar = (name: string, fallback: string) =>
  (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;

async function fonts() {
  const display = cssVar('--font-display', 'Impact, sans-serif');
  const script = cssVar('--font-script', 'cursive');
  const mono = cssVar('--font-mono', 'monospace');
  await Promise.all([
    document.fonts.load(`80px ${display}`, WORDMARK),
    document.fonts.load(`italic 56px ${script}`, 'Built with by'),
    document.fonts.load(`700 30px ${mono}`, '@abc'),
  ]).catch(() => undefined);
  return { display, script, mono };
}

function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.6, cy - s * 1.1, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.1, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9);
  ctx.fill();
}

export function drawWordmark(ctx: CanvasRenderingContext2D, family: string, cx: number, baseline: number, targetWidth: number, color: string) {
  const text = WORDMARK;
  const jit = glyphJitter(text);
  ctx.font = `100px ${family}`;
  const widths = Array.from(text, (ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  const size = Math.min(110, (100 * targetWidth) / total);
  const k = size / 100;
  let x = cx - (total * k) / 2;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  Array.from(text).forEach((ch, i) => {
    const w = widths[i] * k;
    ctx.save();
    ctx.translate(x + w / 2, baseline + jit[i].dy * size);
    ctx.rotate((jit[i].rotate * Math.PI) / 180);
    ctx.scale(jit[i].scale, jit[i].scale);
    ctx.font = `${size}px ${family}`;
    ctx.textAlign = 'center';
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    x += w;
  });
}

export interface ComposeOptions {
  photo: HTMLCanvasElement;
  frameColor: FrameColor;
}

export async function composeCard({ photo, frameColor }: ComposeOptions): Promise<HTMLCanvasElement> {
  const f = await fonts();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  const color = FRAME_COLORS[frameColor].hex;

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  g.addColorStop(0, 'rgba(255,255,255,.14)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  drawWordmark(ctx, f.display, CARD_W / 2, 112, 640, '#ffffff');

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.roundRect(PHOTO.x, PHOTO.y, PHOTO.size, PHOTO.size, 10);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(PHOTO.x, PHOTO.y, PHOTO.size, PHOTO.size, 10);
  ctx.clip();
  ctx.drawImage(photo, 0, 0, photo.width, photo.height, PHOTO.x, PHOTO.y, PHOTO.size, PHOTO.size);
  ctx.restore();

  // Footer: "Built with ♥ by <community>"
  const size = 56;
  ctx.font = `italic ${size}px ${f.script}`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const a = 'Built with';
  const b = `by ${COMMUNITY}`;
  const wa = ctx.measureText(a).width;
  const wb = ctx.measureText(b).width;
  const hs = 17;
  const total = wa + 24 + hs * 2 + 24 + wb;
  let x = (CARD_W - total) / 2;
  const base = 1052;
  ctx.fillText(a, x, base);
  x += wa + 24;
  heart(ctx, x + hs, base - 20, hs);
  x += hs * 2 + 24;
  ctx.fillText(b, x, base);

  return canvas;
}

export const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image'))), type, quality));
