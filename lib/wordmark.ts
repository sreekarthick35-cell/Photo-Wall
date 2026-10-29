// Per-glyph "distortion" for the chunky wordmark, shared by the SVG logo and the canvas card.
export function glyphJitter(text: string) {
  return Array.from(text, (_, i) => ({
    rotate: (((i * 37) % 9) - 4) * 1.6, // degrees
    dy: (((i * 53) % 7) - 3) * 0.035, // em
    scale: 1 + (((i * 29) % 5) - 2) * 0.04,
  }));
}
