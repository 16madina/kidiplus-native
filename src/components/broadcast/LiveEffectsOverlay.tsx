import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useLiveEffects } from "../../lib/filters/live-effects-context";
import { isNativeLiveEffectsSupported } from "../../lib/filters/live-effects-native-bridge";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

/**
 * Fallback overlay used only when the native compositor is not linked.
 * Never draws a full-screen blur/image on top of the person (that was the
 * old fake effect). Poster can still sit above the raw camera.
 */
export function LiveEffectsOverlay() {
  const { posterUrl, posterMode, posterTransform } = useLiveEffects();

  if (isNativeLiveEffectsSupported()) return null;

  const hasPoster = !!posterUrl && posterMode !== "off";
  if (!hasPoster || !posterUrl) return null;

  return (
    <View style={FILL} pointerEvents="none">
      <View
        style={[
          styles.posterWrap,
          {
            left: `${Math.round(posterTransform.x * 100)}%` as unknown as number,
            top: `${Math.round(posterTransform.y * 100)}%` as unknown as number,
            transform: [
              { translateX: -100 },
              { translateY: -80 },
              { scale: posterTransform.scale },
            ],
          },
        ]}
      >
        <Image source={{ uri: posterUrl }} style={styles.posterImg} contentFit="contain" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  posterWrap: {
    position: "absolute",
    width: 200,
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(232,185,59,0.85)",
  },
  posterImg: { width: "100%", height: "100%" },
});
