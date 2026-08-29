export type PosterMode = "off" | "cover";
export type BackgroundMode = "none" | "blur" | "image";

export type PosterTransform = { x: number; y: number; scale: number };

export const DEFAULT_POSTER_TRANSFORM: PosterTransform = {
  x: 0.5,
  y: 0.4,
  scale: 1,
};

export function clampPosterTransform(t: PosterTransform): PosterTransform {
  return {
    x: Math.min(0.95, Math.max(0.05, Number.isFinite(t.x) ? t.x : DEFAULT_POSTER_TRANSFORM.x)),
    y: Math.min(0.95, Math.max(0.05, Number.isFinite(t.y) ? t.y : DEFAULT_POSTER_TRANSFORM.y)),
    scale: Math.min(3, Math.max(0.35, Number.isFinite(t.scale) ? t.scale : DEFAULT_POSTER_TRANSFORM.scale)),
  };
}
