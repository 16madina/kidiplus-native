import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KidiLiveEffectsPreviewNative } from "../../../modules/kidi-live-effects/src";
import { LiveEffectsVideoProcessor } from "../../lib/filters/live-effects-processor";
import { useLiveEffects } from "../../lib/filters/live-effects-context";
import {
  isNativeLiveEffectsSupported,
  subscribeNativeLiveEffectsFirstFrame,
} from "../../lib/filters/live-effects-native-bridge";
import { GOLD } from "../../theme";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

/**
 * Full-bleed native compositor preview (person mask + blur / green screen + poster).
 * Requires a native rebuild that links `kidi-live-effects`.
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
    if (!isNativeLiveEffectsSupported() || !effects.hasEffects) {
      void processorRef.current?.destroy();
      processorRef.current = null;
      if (revealWhenReady) setReady(false);
      return;
    }
    const cfg = {
      backgroundUrl: effects.backgroundUrl,
      backgroundMode: effects.backgroundMode,
      posterUrl: effects.posterUrl,
      posterMode: effects.posterMode,
      posterX: effects.posterTransform.x,
      posterY: effects.posterTransform.y,
      posterScale: effects.posterTransform.scale,
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
    effects.hasEffects,
    effects.backgroundUrl,
    effects.backgroundMode,
    effects.posterUrl,
    effects.posterMode,
    effects.posterTransform.x,
    effects.posterTransform.y,
    effects.posterTransform.scale,
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
    if (revealWhenReady) return null;
    return (
      <View style={[FILL, styles.fallback]}>
        <Text style={styles.title}>Fond virtuel</Text>
        <Text style={styles.body}>
          Rebuild natif requis :{"\n"}
          npm run rebuild:ios
        </Text>
      </View>
    );
  }

  if (revealWhenReady && !ready) return null;

  return (
    <View style={FILL}>
      <NativePreview style={FILL} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: "#05060a",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 12,
  },
  title: { color: GOLD, fontWeight: "900", fontSize: 18 },
  body: {
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 22,
    fontSize: 13,
  },
});
