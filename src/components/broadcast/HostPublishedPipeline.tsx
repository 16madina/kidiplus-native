import { useEffect, useRef } from "react";
import type { CameraType } from "expo-camera";
import { applyBridgeLens, clearBridgeLens } from "../../lib/filters/camera-kit-bridge";
import { useFilter } from "../../lib/filters/filter-context";
import { hostPipelineMode } from "../../lib/filters/host-pipeline-logic";
import { useLiveEffects } from "../../lib/filters/live-effects-context";
import {
  attachPublishedLiveEffects,
  detachPublishedLiveEffects,
  syncNativeLiveEffects,
  type NativeEffectsConfig,
} from "../../lib/filters/live-effects-native-bridge";

function effectsConfig(facing: CameraType, fx: ReturnType<typeof useLiveEffects>): NativeEffectsConfig {
  return {
    backgroundUrl: fx.backgroundUrl,
    backgroundMode: fx.backgroundMode,
    posterUrl: fx.posterUrl,
    posterMode: fx.posterMode,
    posterX: fx.posterTransform.x,
    posterY: fx.posterTransform.y,
    posterScale: fx.posterTransform.scale,
    mirror: facing === "front",
    facing: facing === "back" ? "environment" : "user",
  };
}

/**
 * Same exclusive pipeline as kidiplus.com applyHostPipeline:
 * effects OR Snap on the published Camera Kit track — never a 2nd camera.
 */
export function HostPublishedPipeline({ facing }: { facing: CameraType }) {
  const effects = useLiveEffects();
  const { activeLens } = useFilter();
  const attachedRef = useRef(false);
  const lastKeyRef = useRef("");

  useEffect(() => {
    const mode = hostPipelineMode({
      hasEffects: effects.hasEffects,
      snapLens: !!activeLens.isSnapLens && activeLens.lensId !== "none",
      cameraKit: true,
    });
    const key =
      mode === "effects"
        ? `fx:${effects.backgroundMode}:${effects.backgroundUrl ?? ""}:${effects.posterUrl ?? ""}:${effects.posterMode}:${effects.posterTransform.x}:${effects.posterTransform.y}:${effects.posterTransform.scale}:${facing}`
        : `${mode}:${activeLens.lensId}:${facing}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    let cancelled = false;
    void (async () => {
      if (mode === "effects") {
        await clearBridgeLens().catch(() => undefined);
        if (cancelled) return;
        const cfg = effectsConfig(facing, effects);
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
      if (cancelled) return;
      if (mode === "snap") {
        await applyBridgeLens(activeLens).catch(() => undefined);
      } else {
        await clearBridgeLens().catch(() => undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    effects,
    effects.hasEffects,
    effects.backgroundMode,
    effects.backgroundUrl,
    effects.posterUrl,
    effects.posterMode,
    effects.posterTransform.x,
    effects.posterTransform.y,
    effects.posterTransform.scale,
    activeLens,
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
