# EasyStepIn Anniversary Photo Wall

Mobile-first collaborative wall of printed-style photo cards. Next.js (App Router) + TypeScript + Tailwind v4, Framer Motion, @use-gesture, Supabase (Postgres + Storage + Realtime).

## Quick start (demo mode, no Supabase needed)

```bash
npm install
cp .env.example .env      # set ADMIN_PASSWORD and SESSION_SECRET
npm run seed              # ~12 sample cards (clearly labelled "sample card")
npm run dev               # http://localhost:3000   (admin: /admin)
npm test && npm run lint  # API tests + type check
```

With no Supabase variables set the app runs in **demo mode**: cards and images are stored on local disk in `.data/`, and the wall polls every 3s instead of using realtime. A "demo mode" badge is shown. This is for local use only: serverless disks (e.g. Vercel) are ephemeral.

## Production setup (Supabase + Vercel)

1. Create a Supabase project. In the SQL editor, run [supabase/schema.sql](supabase/schema.sql) (tables, RLS, realtime publication, public `cards` storage bucket).
2. Set these env vars locally and on Vercel:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser: realtime subscription and read-only access to visible cards |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** All writes (uploads, inserts, moderation) go through API routes |
| `ADMIN_USERNAME` (default `admin`), `ADMIN_PASSWORD`, `SESSION_SECRET` | `/admin` login; `openssl rand -hex 32` for the secret |
| `NEXT_PUBLIC_EVENT_NAME`, `NEXT_PUBLIC_WORDMARK`, `NEXT_PUBLIC_COMMUNITY_NAME` | Copy shown on the wall and cards |
| `GOOGLE_VISION_API_KEY` | Optional content-safety check (see below) |

3. `npm run seed` (optional), deploy to Vercel.

## How it works

- **Wall:** pan/zoom canvas (drag, pinch, trackpad, +/− buttons), Recenter animation, random ±8° rotation and pin colour, drop-in animation for cards arriving live, tap a card to flip and read the note.
- **Add photo:** Photo library / Choose file → centre-crop square, EXIF-aware, max 1600px → printer animation → frame colour (4 swatches) → note on the back (140 chars, From) → Share (Web Share API, PNG download fallback) → Pin to wall.
- **The card image** (frame + wordmark + photo + footer) is composed in the browser (`lib/compose.ts`) so preview, share PNG and upload are identical. The server stores the JPEG and places it at a free spot (`lib/placement.ts`).
- **Safe areas / keyboard:** `viewport-fit=cover`, `interactive-widget=resizes-content`, `visualViewport` sizing and scroll-into-view so the note field stays visible; inputs are ≥16px to avoid iOS zoom.

## Likes, comments, download

Open a card to ♥ like it, 💬 read/post comments, or ⬇ download the card image. The wall shows a small ♥/💬 count under cards that have any.
- **Likes:** one per device per card (toggle), enforced server-side by the anonymous device cookie. Clearing cookies lets someone like again.
- **Comments:** anonymous, optional name, max 200 chars, one per 5s per device, newest last, refreshed every 5s while the panel is open. Admins delete comments in `/admin` (shown under each card). There is no automated text filtering.
- **Download:** saves the card image as shown on the wall (seed cards download as SVG). It does not include the note.
- **Supabase:** re-run [supabase/schema.sql](supabase/schema.sql) (adds `likes`, `comments`, `rate_log` and counter triggers; `post_log` is replaced by `rate_log`). Counts live on `cards.like_count` / `comment_count`, so realtime UPDATE events carry them.

## Safety and moderation

- Posts are **live immediately** (per the brief); admins hide/unhide/delete at `/admin` (password, signed HttpOnly SameSite=Strict cookie, login throttling). Hidden cards disappear from all walls (realtime + 30s fallback poll).
- Server validates JPEG structure and exact 900×1125 dimensions, size ≤ 2 MB, and all text fields; it does not trust the MIME type or client checks.
- **Rate limit:** one post per 15s per device (httpOnly cookie, enforced server-side in `post_log`; UI shows "Posted – wait Ns"). A user who clears cookies can bypass it; add edge/IP limits (e.g. Vercel Firewall) if abuse is a concern. IP limiting isn't built in because event Wi-Fi shares one IP.
- **Content safety:** optional Google Cloud Vision SafeSearch (`GOOGLE_VISION_API_KEY`) rejects LIKELY/VERY_LIKELY adult/violence/racy images. **This code path is untested** (no key was available), and it fails open if the API is down. Without a key there is no automated image screening; admin moderation is the safeguard.
- Hidden cards' image URLs remain reachable by direct link in Supabase Storage (unguessable UUIDs, public bucket); deleting removes the file.

## Known limitations

- Supabase mode (realtime, storage, RLS) was **not exercised** here; only demo mode was run end to end. Verify with your project before the event.
- Tested in desktop Chrome with mobile emulation, not on real iOS Safari/Android devices. The Web Share file sheet needs a real device check.
- Crop is automatic centre-crop (no manual reposition). HEIC works only where the browser can decode it.
- Colours/fonts are provisional (no official EasyStepIn brand assets supplied); the wordmark is the Chango font with per-letter jitter, not an official logo. Edit `lib/types.ts` (frame colours) and `lib/config.ts`.
- Retention/privacy: there is no consent or privacy notice in this brief's flow. Add one if your policy requires it.
- The previous Express app is archived in `legacy-express-app.tgz`.

## Who can do what

- **Employees:** open the site URL (`/`). No login. They can view the wall, add a photo, like and comment.
- **Admin:** `/admin` with username + password. Can create a card (photo, frame, note, name), edit a card's note and name, hide/show, delete a card, and delete comments. Admin-created cards skip the 15s cooldown and the optional image-safety check. A card's photo and frame colour are baked into its image, so to change those, delete the card and create a new one.
