import { useEffect, useRef } from "react";
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
    mirror: false,
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
    const posterOn = !!effects.posterUrl && effects.posterMode !== "off";
    const effectsOn = publishedGreenScreenOn(effects.backgroundMode) || posterOn;
    const key = effectsOn
      ? `${effects.backgroundMode}:${effects.backgroundUrl ?? ""}:${effects.posterMode}:${effects.posterUrl ?? ""}:${effects.posterTransform.x}:${effects.posterTransform.y}:${effects.posterTransform.scale}:${facing}`
      : `off:${facing}`;
    if (key === lastEffectsKeyRef.current) return;
    lastEffectsKeyRef.current = key;

    let cancelled = false;
    void (async () => {
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
      void detachPublishedLiveEffects();
    };
  }, []);

  return null;
}
