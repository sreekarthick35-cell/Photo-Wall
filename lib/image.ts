export const MAX_PHOTO_SIDE = 1600;
export const MAX_PHOTO_BYTES = 30 * 1024 * 1024;

export class PhotoError extends Error {}

/** Honours EXIF orientation and keeps the whole picture (no cropping), downsizing so the longest side is at most 1600px. */
export async function processPhoto(file: File): Promise<HTMLCanvasElement> {
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoError('That photo is too large. Please choose one under 30 MB.');
  if (file.type && !file.type.startsWith('image/')) throw new PhotoError('Please choose an image file.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoError('We couldn’t read that photo. Try another one.');
  }
  if (Math.min(bitmap.width, bitmap.height) < 200) throw new PhotoError('That photo is too small. Please choose a larger one.');
  const k = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}
