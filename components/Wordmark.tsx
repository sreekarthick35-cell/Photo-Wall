import { WORDMARK } from '@/lib/config';
import { glyphJitter } from '@/lib/wordmark';

/** Chunky, slightly distorted SVG wordmark. `distort` adds a wobbly displacement + offset shadow (big logo). */
export default function Wordmark({ color = '#1d1b18', shadow, distort = false, className }: { color?: string; shadow?: string; distort?: boolean; className?: string }) {
  const jit = glyphJitter(WORDMARK);
  const rotate = jit.map((j) => j.rotate).join(' ');
  const dy = jit.map((j, i) => `${(j.dy - (jit[i - 1]?.dy ?? 0)) * 120}`).join(' ');
  const common = {
    x: 300, y: 108, textAnchor: 'middle' as const, rotate, dy, textLength: 560, lengthAdjust: 'spacingAndGlyphs' as const,
    style: { fontFamily: 'var(--font-display), Impact, sans-serif', fontSize: 120 },
  };
  return (
    <svg viewBox="0 0 600 150" className={className} role="img" aria-label={WORDMARK}>
      {distort && (
        <filter id="wobble" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.03" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="9" />
        </filter>
      )}
      <g filter={distort ? 'url(#wobble)' : undefined}>
        {shadow && <text {...common} x={308} y={116} fill={shadow}>{WORDMARK}</text>}
        <text {...common} fill={color}>{WORDMARK}</text>
      </g>
    </svg>
  );
}
