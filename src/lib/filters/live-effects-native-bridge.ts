// Bridge JS ↔ module natif kidi-live-effects (Vision iOS / ML Kit Android).
// Tant que le module n’est pas lié (prebuild), les appels échouent proprement.

import { Platform } from "react-native";
import { KidiLiveEffects } from "../../../modules/kidi-live-effects/src";
import type { BackgroundMode, PosterMode } from "./live-effects-compositor";

export type NativeEffectsConfig = {
  backgroundUrl: string | null;
  backgroundMode: BackgroundMode;
  posterUrl: string | null;
  posterMode: PosterMode;
  posterX: number;
  posterY: number;
  posterScale: number;
  mirror: boolean;
  facing: "user" | "environment";
};

type NativeSub = { remove(): void };

export function isNativeLiveEffectsLinked(): boolean {
  return !!KidiLiveEffects && typeof KidiLiveEffects.warmup === "function";
}

export function isNativeLiveEffectsSupported(): boolean {
  if (Platform.OS === "web") return false;
  return isNativeLiveEffectsLinked();
}

export async function warmupNativeLiveEffects(): Promise<boolean> {
  if (!KidiLiveEffects) return false;
  try {
    const res = await KidiLiveEffects.warmup();
    return !!res.supported;
  } catch {
    return false;
  }
}

export async function preloadNativeBackground(url: string | null): Promise<void> {
  if (!url || !KidiLiveEffects?.preloadBackground) return;
  try {
    await KidiLiveEffects.preloadBackground(url);
  } catch {
    /* ignore */
  }
}

export async function startNativeLiveEffects(cfg: NativeEffectsConfig): Promise<void> {
  if (!KidiLiveEffects) throw new Error("kidi-live-effects module absent — rebuild natif requis");
  await KidiLiveEffects.start(cfg);
}

/** Compose on the Camera Kit frames already published. Does not open a camera. */
export async function attachPublishedLiveEffects(cfg: NativeEffectsConfig): Promise<void> {
  if (!KidiLiveEffects?.attachPublished) return;
  await KidiLiveEffects.attachPublished(cfg);
}

export async function detachPublishedLiveEffects(): Promise<void> {
  if (!KidiLiveEffects?.detachPublished) {
    await stopNativeLiveEffects();
    return;
  }
  await KidiLiveEffects.detachPublished();
}

export async function syncNativeLiveEffects(cfg: NativeEffectsConfig): Promise<void> {
  if (!KidiLiveEffects) return;
  try {
    await KidiLiveEffects.setConfig(cfg);
  } catch {
    /* session not started */
  }
}

export async function stopNativeLiveEffects(): Promise<void> {
  if (!KidiLiveEffects) return;
  try {
    await KidiLiveEffects.stop();
  } catch {
    /* ignore */
  }
}

export function subscribeNativeLiveEffectsUnavailable(cb: () => void): () => void {
  return subscribeNativeEvent("unavailable", cb);
}

export function subscribeNativeLiveEffectsFirstFrame(cb: () => void): () => void {
  return subscribeNativeEvent("firstFrame", cb);
}

function subscribeNativeEvent(event: string, cb: () => void): () => void {
  const mod = KidiLiveEffects as
    | (typeof KidiLiveEffects & {
        addListener?: (event: string, fn: () => void) => NativeSub;
      })
    | null;
  if (!mod?.addListener) return () => {};
  const sub = mod.addListener(event, cb);
  return () => sub.remove();
}
