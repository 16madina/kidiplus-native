/**
 * Shared types + native compositor API.
 * Web: Metro resolves `live-effects-compositor.web.ts` (MediaPipe WASM + canvas).
 * Native: this file talks to the `kidi-live-effects` Expo module (Vision / ML Kit)
 * which reproduces the same pipeline: soft mask, EMA 0.55/0.45, feathering, ladder.
 */

import { warmupNativeLiveEffects } from "./live-effects-native-bridge";
import type { BackgroundMode, PosterMode, PosterTransform } from "./live-effects-compositor-math";

export type { BackgroundMode, PosterMode, PosterTransform };
export { clampPosterTransform, DEFAULT_POSTER_TRANSFORM } from "./live-effects-compositor-math";

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
