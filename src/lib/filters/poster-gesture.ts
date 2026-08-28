import type { PosterTransform } from "./live-effects-compositor";

/** Ignore layout that hasn't measured yet — a 1×1 box turns a tap into a jump to the corner. */
export const POSTER_BOX_MIN = 64;

function clampWorklet(t: PosterTransform): PosterTransform {
  "worklet";
  return {
    x: Math.min(0.95, Math.max(0.05, t.x)),
    y: Math.min(0.95, Math.max(0.05, t.y)),
    scale: Math.min(3, Math.max(0.35, t.scale)),
  };
}

export function applyPosterPan(opts: {
  originX: number;
  originY: number;
  originScale: number;
  translationX: number;
  translationY: number;
  boxW: number;
  boxH: number;
}): PosterTransform {
  "worklet";
  const { originX, originY, originScale, translationX, translationY, boxW, boxH } = opts;
  if (boxW < POSTER_BOX_MIN || boxH < POSTER_BOX_MIN) {
    return { x: originX, y: originY, scale: originScale };
  }
  return clampWorklet({
    x: originX + translationX / boxW,
    y: originY + translationY / boxH,
    scale: originScale,
  });
}

export function applyPosterPinch(originScale: number, pinchScale: number): number {
  "worklet";
  const s = Number.isFinite(pinchScale) && pinchScale > 0.05 ? pinchScale : 1;
  return clampWorklet({ x: 0.5, y: 0.4, scale: originScale * s }).scale;
}
