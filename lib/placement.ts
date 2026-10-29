import { WALL_CARD_H, WALL_CARD_W } from './types';

type Pt = { x: number; y: number };

// The centre logo occupies this box around the world origin.
const LOGO_HALF_W = 330;
const LOGO_HALF_H = 210;

const overlaps = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < WALL_CARD_W * 0.92 && Math.abs(a.y - b.y) < WALL_CARD_H * 0.92;
const hitsLogo = (p: Pt) => Math.abs(p.x) < LOGO_HALF_W + WALL_CARD_W / 2 && Math.abs(p.y) < LOGO_HALF_H + WALL_CARD_H / 2;

/** Finds a free spot, spiralling out from the centre. `rand` is injectable for tests. */
export function pickSpot(existing: Pt[], rand: () => number = Math.random): Pt {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const start = Math.floor(rand() * 40);
  for (let i = 0; i < 4000; i++) {
    const n = i + start;
    const r = 60 * Math.sqrt(n) * 1.9;
    const a = n * golden;
    const p = {
      x: Math.round(Math.cos(a) * r * 1.35 + (rand() - 0.5) * 30),
      y: Math.round(Math.sin(a) * r + (rand() - 0.5) * 30),
    };
    if (!hitsLogo(p) && !existing.some((e) => overlaps(p, e))) return p;
  }
  const far = 3000 + existing.length * 4;
  return { x: Math.round((rand() - 0.5) * far * 2), y: Math.round((rand() - 0.5) * far * 2) };
}
