export type AffichePoint = { x: number; y: number; scale: number };

export const AFFICHE_BOX_MIN = 64;
export const AFFICHE_SCALE_MIN = 0.4;
export const AFFICHE_SCALE_MAX = 3.2;

export function clampAfficheLayer(t: AffichePoint): AffichePoint {
  "worklet";
  return {
    x: Math.min(0.94, Math.max(0.06, Number.isFinite(t.x) ? t.x : 0.5)),
    y: Math.min(0.94, Math.max(0.06, Number.isFinite(t.y) ? t.y : 0.5)),
    scale: Math.min(
      AFFICHE_SCALE_MAX,
      Math.max(AFFICHE_SCALE_MIN, Number.isFinite(t.scale) ? t.scale : 1),
    ),
  };
}

export function applyAffichePan(opts: {
  originX: number;
  originY: number;
  originScale: number;
  translationX: number;
  translationY: number;
  boxW: number;
  boxH: number;
}): AffichePoint {
  "worklet";
  const { originX, originY, originScale, translationX, translationY, boxW, boxH } = opts;
  if (boxW < AFFICHE_BOX_MIN || boxH < AFFICHE_BOX_MIN) {
    return { x: originX, y: originY, scale: originScale };
  }
  return clampAfficheLayer({
    x: originX + translationX / boxW,
    y: originY + translationY / boxH,
    scale: originScale,
  });
}

export function applyAffichePinch(originScale: number, pinchScale: number): number {
  "worklet";
  const s = Number.isFinite(pinchScale) && pinchScale > 0.05 ? pinchScale : 1;
  return clampAfficheLayer({ x: 0.5, y: 0.5, scale: originScale * s }).scale;
}
