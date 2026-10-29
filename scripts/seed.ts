// Seeds ~12 clearly-labelled sample cards (SVG artwork, no real people).
// Works against whichever store is configured (Supabase or local demo).
// Usage: npm run seed            (skips if cards already exist)
//        npm run seed -- --force (adds them anyway)
import crypto from 'node:crypto';
import { getStore } from '../lib/server/store';
import { pickSpot } from '../lib/placement';
import { FRAME_COLORS, FRAME_KEYS, PIN_COLORS, type FrameColor } from '../lib/types';

const SAMPLES = [
  ['Asha', 'Eight years and still learning something new every week.', 'sky'],
  ['Dev', 'Best offsites, best snacks. Cheers, team!', 'sunset'],
  ['Meera', 'Remember the 2am launch? Never again. (Again.)', 'hills'],
  ['Karthik', 'Proud to build this with you all.', 'sky'],
  ['Priya', '', 'sunset'],
  ['Rohan', 'Here is to the next chapter!', 'hills'],
  ['Sana', 'Coffee, code, and great company.', 'sky'],
  ['Vikram', 'One team. Always.', 'sunset'],
  ['Lakshmi', 'Thank you for every little win along the way.', 'hills'],
  ['Arjun', '', 'sky'],
  ['Nisha', 'Cake first, speeches later.', 'sunset'],
  ['Imran', 'Day one feels like yesterday.', 'hills'],
] as const;

const SCENES = {
  sky: ['#79a8ff', '#d9ecff', '<circle cx="640" cy="230" r="90" fill="#fff6c9"/><ellipse cx="260" cy="320" rx="140" ry="44" fill="#fff"/><ellipse cx="360" cy="296" rx="100" ry="40" fill="#fff"/>'],
  sunset: ['#ff9966', '#ffd28a', '<circle cx="396" cy="520" r="150" fill="#ffe9a8"/><rect y="560" width="792" height="232" fill="#c95d63"/>'],
  hills: ['#9be0c0', '#e8f7d4', '<path d="M0 560 Q200 380 400 520 T792 460 V792 H0Z" fill="#3f9d6b"/><path d="M0 660 Q260 520 520 640 T792 600 V792 H0Z" fill="#2b7a52"/>'],
} as const;

function svg(name: string, scene: keyof typeof SCENES, color: FrameColor) {
  const [a, b, art] = SCENES[scene];
  const c = FRAME_COLORS[color].hex;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1125" viewBox="0 0 900 1125">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><clipPath id="p"><rect x="54" y="150" width="792" height="792" rx="10"/></clipPath></defs>
<rect width="900" height="1125" fill="${c}"/>
<text x="450" y="112" text-anchor="middle" font-family="Impact, 'Arial Black', sans-serif" font-size="96" fill="#fff" textLength="620" lengthAdjust="spacingAndGlyphs">EasyStepIn</text>
<g clip-path="url(#p)"><rect x="54" y="150" width="792" height="792" fill="url(#g)"/><g transform="translate(54 150)">${art}</g></g>
<text x="450" y="1050" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="52" fill="#fff">Built with ♥ by EasyStepIn</text>
<text x="450" y="1000" text-anchor="middle" font-family="Georgia, serif" font-size="32" fill="#fff" opacity=".8">sample card · ${name}</text>
</svg>`;
}

const store = getStore();
const existing = await store.list({ includeHidden: true });
if (existing.length && !process.argv.includes('--force')) {
  console.log(`Wall already has ${existing.length} cards; skipping (use --force to add anyway).`);
  process.exit(0);
}
const placed: { x: number; y: number }[] = [...existing];
for (const [i, [name, note, scene]] of SAMPLES.entries()) {
  const frame = FRAME_KEYS[i % FRAME_KEYS.length];
  const spot = pickSpot(placed);
  placed.push(spot);
  await store.save(
    {
      id: crypto.randomUUID(),
      frame_color: frame,
      note,
      author_name: name,
      instagram: '',
      x: spot.x,
      y: spot.y,
      rotation: Math.round((Math.random() * 16 - 8) * 10) / 10,
      pin_color: PIN_COLORS[i % PIN_COLORS.length],
    },
    Buffer.from(svg(name, scene, frame)),
    'image/svg+xml',
  );
}
console.log(`Seeded ${SAMPLES.length} sample cards into the ${store.mode} store.`);
