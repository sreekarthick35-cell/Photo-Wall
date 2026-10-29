export const MAX_PHOTO_SIDE = 1600;
export const MAX_PHOTO_BYTES = 30 * 1024 * 1024;

export class PhotoError extends Error {}

/** Honours EXIF orientation, centre-crops to a square and downsizes to at most 1600px. */
export async function processPhoto(file: File): Promise<HTMLCanvasElement> {
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoError('That photo is too large. Please choose one under 30 MB.');
  if (file.type && !file.type.startsWith('image/')) throw new PhotoError('Please choose an image file.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoError('We couldn’t read that photo. Try another one.');
  }
  const side = Math.min(bitmap.width, bitmap.height);
  if (side < 200) throw new PhotoError('That photo is too small. Please choose a larger one.');
  const out = Math.min(side, MAX_PHOTO_SIDE);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  canvas.getContext('2d')!.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  bitmap.close();
  return canvas;
}
