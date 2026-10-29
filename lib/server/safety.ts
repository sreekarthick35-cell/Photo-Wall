// Optional image content-safety check using Google Cloud Vision SafeSearch.
// Enabled only when GOOGLE_VISION_API_KEY is set. NOT exercised by the automated tests.
const BAD = new Set(['LIKELY', 'VERY_LIKELY']);

export const safetyEnabled = () => Boolean(process.env.GOOGLE_VISION_API_KEY);

export async function checkImageSafety(image: Buffer): Promise<{ ok: true } | { ok: false; reason: string }> {
  const key = process.env.GOOGLE_VISION_API_KEY;
  if (!key) return { ok: true };
  try {
    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ image: { content: image.toString('base64') }, features: [{ type: 'SAFE_SEARCH_DETECTION' }] }] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`vision ${res.status}`);
    const s = (await res.json()).responses?.[0]?.safeSearchAnnotation;
    if (s && (BAD.has(s.adult) || BAD.has(s.violence) || BAD.has(s.racy))) {
      return { ok: false, reason: 'That photo can’t be posted to the wall. Please try a different one.' };
    }
    return { ok: true };
  } catch (err) {
    // Fail open so an outage doesn't block the event; admin moderation remains the backstop.
    console.warn('content-safety check unavailable:', (err as Error).message);
    return { ok: true };
  }
}
