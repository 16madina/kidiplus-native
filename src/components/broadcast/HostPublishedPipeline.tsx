import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import type { CameraType } from "expo-camera";
import { applyBridgeLens, clearBridgeLens } from "../../lib/filters/camera-kit-bridge";
import { useFilter } from "../../lib/filters/filter-context";
import { publishedGreenScreenOn } from "../../lib/filters/host-pipeline-logic";
import { useLiveEffects } from "../../lib/filters/live-effects-context";
import {
  attachPublishedLiveEffects,
  detachPublishedLiveEffects,
  syncNativeLiveEffects,
  type NativeEffectsConfig,
} from "../../lib/filters/live-effects-native-bridge";

function publishedEffectsConfig(
  facing: CameraType,
  fx: ReturnType<typeof useLiveEffects>,
): NativeEffectsConfig {
  return {
    backgroundUrl: fx.backgroundUrl,
    backgroundMode: fx.backgroundMode,
    posterUrl: fx.posterUrl,
    posterMode: fx.posterMode,
    posterX: fx.posterTransform.x,
    posterY: fx.posterTransform.y,
    posterScale: fx.posterTransform.scale,
    mirror: facing !== "back",
    facing: facing === "back" ? "environment" : "user",
  };
}

/**
 * Camera → Snap filter → optional green screen / poster → published track.
 * iOS viewers (including the website) therefore receive the exact composed
 * pixels instead of depending on a second realtime overlay channel.
 */
export function HostPublishedPipeline({ facing }: { facing: CameraType }) {
  const effects = useLiveEffects();
  const { activeLens } = useFilter();
  const attachedRef = useRef(false);
  const lastEffectsKeyRef = useRef("");
  const lastLensRef = useRef("");

  useEffect(() => {
    const snapOn = !!activeLens.isSnapLens && activeLens.lensId !== "none";
    const lensKey = `${snapOn ? activeLens.lensId : "none"}:${activeLens.groupId ?? ""}`;
    if (lensKey === lastLensRef.current) return;
    lastLensRef.current = lensKey;
    let cancelled = false;
    void (async () => {
      if (snapOn) {
        await applyBridgeLens(activeLens).catch(() => undefined);
      } else {
        await clearBridgeLens().catch(() => undefined);
      }
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [activeLens]);

  useEffect(() => {
    // The Android host currently publishes its LiveKit CameraX track directly.
    // Starting the preview compositor here opens a second physical camera while
    // that track is active; choosing a background therefore tears down the
    // active camera and can leave the host with a black frame. iOS composes
    // inside its Camera Kit publish callback, so it remains safe there.
    const posterOn = !!effects.posterUrl && effects.posterMode !== "off";
    const effectsOn = publishedGreenScreenOn(effects.backgroundMode) || posterOn;
    const key = effectsOn
      ? `${effects.backgroundMode}:${effects.backgroundUrl ?? ""}:${effects.posterMode}:${effects.posterUrl ?? ""}:${effects.posterTransform.x}:${effects.posterTransform.y}:${effects.posterTransform.scale}:${facing}`
      : `off:${facing}`;
    if (key === lastEffectsKeyRef.current) return;
    lastEffectsKeyRef.current = key;

    let cancelled = false;
    void (async () => {
      if (Platform.OS === "android") {
        // Android already owns one effects camera/publisher for the whole
        // live. Only update its configuration; never attach another session.
        await syncNativeLiveEffects(publishedEffectsConfig(facing, effects));
        return;
      }
      if (effectsOn) {
        const cfg = publishedEffectsConfig(facing, effects);
        if (attachedRef.current) {
          await syncNativeLiveEffects(cfg);
        } else {
          await attachPublishedLiveEffects(cfg);
          attachedRef.current = true;
        }
        return;
      }
      if (attachedRef.current) {
        await detachPublishedLiveEffects();
        attachedRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    effects.backgroundMode,
    effects.backgroundUrl,
    effects.posterMode,
    effects.posterUrl,
    effects.posterTransform.x,
    effects.posterTransform.y,
    effects.posterTransform.scale,
    facing,
  ]);

  useEffect(() => {
    return () => {
      attachedRef.current = false;
      // `detachPublished` is an iOS-only operation. On Android the bridge
      // intentionally falls back to `stopNativeLiveEffects()` when that native
      // method is absent. Running this cleanup during React's effect probe
      // therefore stops the single CameraX/LiveKit publisher moments after it
      // starts and freezes the host video. The owner in BroadcastLiveHost is
      // responsible for stopping Android capture when the live really ends.
      if (Platform.OS !== "android") void detachPublishedLiveEffects();
    };
  }, []);

  return null;
}
