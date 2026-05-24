import sharp from 'sharp';
import type { ResizeStrategy } from './fileService.js';

/**
 * Scale down proportionally to fit within maxWidth x maxHeight.
 * Never upscales. Used for general image uploads.
 */
export function getMaxWidthHeightStrategy(maxWidth: number, maxHeight: number): ResizeStrategy {
  const fn = async (buffer: Buffer): Promise<Buffer> => {
    const result = await sharp(buffer)
      .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();
    return result;
  };
  // We can't know exact dimensions until after processing,
  // but these are approximate max bounds
  fn.outputWidth = maxWidth;
  fn.outputHeight = maxHeight;
  return fn;
}

/**
 * Square crop at a configurable offset from the top-left corner.
 * Used for user profile photos (sideSize=120, leftTopPercent=10).
 * 
 * The Java implementation:
 *   - If width > height: crop horizontally starting at leftTopPercent of (width - height)
 *   - If height > width: crop vertically starting at leftTopPercent of (height - width)
 *   - Then resize to sideSize x sideSize
 */
export function getCuttingSquareStrategy(sideSize: number, leftTopPercent: number): ResizeStrategy {
  const fn = async (buffer: Buffer): Promise<Buffer> => {
    const metadata = await sharp(buffer).metadata();
    const sw = metadata.width ?? sideSize;
    const sh = metadata.height ?? sideSize;

    let sx1: number, sy1: number, sx2: number, sy2: number;

    if (sw > sh) {
      sy1 = 0;
      sy2 = sh;
      sx1 = Math.round((sw - sh) * leftTopPercent / 100);
      sx2 = sx1 + sh;
    } else {
      sx1 = 0;
      sx2 = sw;
      sy1 = Math.round((sh - sw) * leftTopPercent / 100);
      sy2 = sy1 + sw;
    }

    const result = await sharp(buffer)
      .extract({ left: sx1, top: sy1, width: sx2 - sx1, height: sy2 - sy1 })
      .resize(sideSize, sideSize)
      .toBuffer();
    return result;
  };
  fn.outputWidth = sideSize;
  fn.outputHeight = sideSize;
  return fn;
}

/**
 * Cover image strategy: enforce 10:3 aspect ratio CROP (not resize).
 * 
 * If the source image is already wider than 10:3 ratio, return as-is.
 * Otherwise, crop the HEIGHT to achieve the 10:3 ratio.
 * No width scaling.
 */
export function getCoverImageStrategy(): ResizeStrategy {
  const REQUIRED_RATIO = 10 / 3;

  const fn = async (buffer: Buffer): Promise<Buffer> => {
    const metadata = await sharp(buffer).metadata();
    const sw = metadata.width ?? 1200;
    const sh = metadata.height ?? 360;

    if (sw / sh >= REQUIRED_RATIO) {
      // Already wide enough — return as-is
      fn.outputWidth = sw;
      fn.outputHeight = sh;
      return buffer;
    }

    // Crop height
    const resH = Math.max(1, Math.floor(sw / REQUIRED_RATIO));
    if (resH >= sh) {
      // Too small to crop meaningfully — return as-is
      fn.outputWidth = sw;
      fn.outputHeight = sh;
      return buffer;
    }

    const result = await sharp(buffer)
      .extract({ left: 0, top: 0, width: sw, height: resH })
      .toBuffer();
    fn.outputWidth = sw;
    fn.outputHeight = resH;
    return result;
  };
  fn.outputWidth = 0;
  fn.outputHeight = 0;
  return fn;
}
