import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { KidiLiveEffectsPreviewNative } from "../../../modules/kidi-live-effects/src";
import { LiveEffectsVideoProcessor } from "../../lib/filters/live-effects-processor";
import { useLiveEffects } from "../../lib/filters/live-effects-context";
import {
  isNativeLiveEffectsSupported,
  subscribeNativeLiveEffectsFirstFrame,
} from "../../lib/filters/live-effects-native-bridge";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

/**
 * Full-bleed native compositor preview (person mask + blur / green screen).
 * Poster stays a RN overlay. Never covers the camera with a "rebuild" screen.
 */
export function LiveEffectsPreview({
  facing,
  revealWhenReady = false,
}: {
  facing: "user" | "environment" | "front" | "back";
  /** Studio: stay transparent until the compositor paints, so the LiveKit preview is not covered in black. */
  revealWhenReady?: boolean;
}) {
  const effects = useLiveEffects();
  const facingNorm: "user" | "environment" =
    facing === "back" || facing === "environment" ? "environment" : "user";
  const NativePreview = KidiLiveEffectsPreviewNative;
  const processorRef = useRef<LiveEffectsVideoProcessor | null>(null);
  const [ready, setReady] = useState(!revealWhenReady);

  useEffect(() => subscribeNativeLiveEffectsFirstFrame(() => setReady(true)), []);

  useEffect(() => {
    const wantsNativeBg =
      isNativeLiveEffectsSupported() && effects.backgroundMode !== "none";
    if (!wantsNativeBg) {
      void processorRef.current?.destroy();
      processorRef.current = null;
      if (revealWhenReady) setReady(false);
      return;
    }
    const cfg = {
      backgroundUrl: effects.backgroundUrl,
      backgroundMode: effects.backgroundMode,
      posterUrl: null,
      posterMode: "off" as const,
      posterX: 0.5,
      posterY: 0.4,
      posterScale: 1,
      mirror: facingNorm !== "environment",
      facing: facingNorm,
      onUnavailable: effects.markBackgroundUnavailable,
    };
    if (!processorRef.current) {
      const processor = new LiveEffectsVideoProcessor(cfg);
      processorRef.current = processor;
      void processor.start();
    } else {
      void processorRef.current.setConfig(cfg);
    }
  }, [
    effects.backgroundUrl,
    effects.backgroundMode,
    effects.markBackgroundUnavailable,
    facingNorm,
    revealWhenReady,
  ]);

  useEffect(() => {
    return () => {
      void processorRef.current?.destroy();
      processorRef.current = null;
    };
  }, []);

  if (!isNativeLiveEffectsSupported() || !NativePreview) {
    return null;
  }

  if (revealWhenReady && !ready) return null;

  return (
    <View style={FILL} pointerEvents="none">
      <NativePreview style={FILL} pointerEvents="none" />
    </View>
  );
}
