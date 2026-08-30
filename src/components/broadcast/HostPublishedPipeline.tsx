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

function greenScreenConfig(facing: CameraType, fx: ReturnType<typeof useLiveEffects>): NativeEffectsConfig {
  return {
    backgroundUrl: fx.backgroundUrl,
    backgroundMode: fx.backgroundMode,
    posterUrl: null,
    posterMode: "off",
    posterX: 0.5,
    posterY: 0.4,
    posterScale: 1,
    mirror: false,
    facing: facing === "back" ? "environment" : "user",
  };
}

/**
 * Camera → Snap filter → optional green screen → published track.
 * Poster is not baked; viewers draw it via LiveFxOverlay.
 */
export function HostPublishedPipeline({ facing }: { facing: CameraType }) {
  const effects = useLiveEffects();
  const { activeLens } = useFilter();
  const attachedRef = useRef(false);
  const lastBgKeyRef = useRef("");
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
    const greenOn = publishedGreenScreenOn(effects.backgroundMode);
    const key = greenOn
      ? `${effects.backgroundMode}:${effects.backgroundUrl ?? ""}:${facing}`
      : `off:${facing}`;
    if (key === lastBgKeyRef.current) return;
    lastBgKeyRef.current = key;

    let cancelled = false;
    void (async () => {
      if (greenOn) {
        const cfg = greenScreenConfig(facing, effects);
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
  }, [effects.backgroundMode, effects.backgroundUrl, facing, effects]);

  useEffect(() => {
    return () => {
      attachedRef.current = false;
      void detachPublishedLiveEffects();
    };
  }, []);

  return null;
}
