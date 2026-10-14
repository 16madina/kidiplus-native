/** Longest side of an uploaded photo. Enough for full-screen on a phone. */
export const MAX_IMAGE_SIDE = 1600;
export const JPEG_QUALITY = 0.8;

/**
 * Size to resize to so the longest side fits `maxSide`, or null when the
 * image is already small enough (never upscale).
 */
export function fitWithin(
  width: number | null | undefined,
  height: number | null | undefined,
  maxSide = MAX_IMAGE_SIDE,
): { width: number; height: number } | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  const longest = Math.max(width, height);
  if (longest <= maxSide) return null;
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function isPngMime(mime: string | null | undefined): boolean {
  return (mime ?? "").toLowerCase().includes("png");
}
