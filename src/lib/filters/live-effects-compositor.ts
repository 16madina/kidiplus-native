/**
 * Shared types + native compositor API.
 * Web: Metro resolves `live-effects-compositor.web.ts` (MediaPipe WASM + canvas).
 * Native: this file talks to the `kidi-live-effects` Expo module (Vision / ML Kit)
 * which reproduces the same pipeline: soft mask, EMA 0.55/0.45, feathering, ladder.
 */

import { warmupNativeLiveEffects } from "./live-effects-native-bridge";

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
    x: Math.min(0.95, Math.max(0.05, t.x)),
    y: Math.min(0.95, Math.max(0.05, t.y)),
    scale: Math.min(3, Math.max(0.35, t.scale)),
  };
}

/** Render width ladder used by the perf guard (height follows the aspect). */
export const WIDTH_LADDER = [720, 540, 400] as const;

export const MASK_EMA_PREV = 0.55;
export const MASK_EMA_NEXT = 0.45;
export const MASK_FEATHER_RATIO = 0.008;
export const MASK_SOFT_LO = 0.35;
export const MASK_SOFT_HI = 0.65;

export type LiveEffectsConfig = {
  backgroundUrl: string | null;
  backgroundMode: BackgroundMode;
  posterUrl: string | null;
  posterMode: PosterMode;
  posterX?: number;
  posterY?: number;
  posterScale?: number;
  mirror: boolean;
  facing?: "user" | "environment";
  onUnavailable?: () => void;
};

export async function isSegmentationSupported(): Promise<boolean> {
  return warmupNativeLiveEffects();
}
