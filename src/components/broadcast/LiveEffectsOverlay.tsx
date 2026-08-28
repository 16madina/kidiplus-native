import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { useLiveEffects } from "../../lib/filters/live-effects-context";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

/**
 * Visual overlay for live effects (background blur, green screen image,
 * poster image). Renders on top of the camera feed.
 */
export function LiveEffectsOverlay() {
  const { backgroundMode, backgroundUrl, posterUrl, posterMode, posterTransform } = useLiveEffects();

  const hasBackground = backgroundMode !== "none";
  const hasPoster = !!posterUrl && posterMode !== "off";

  if (!hasBackground && !hasPoster) return null;

  return (
    <View style={FILL} pointerEvents="none">
      {backgroundMode === "blur" ? (
        <BlurView intensity={40} tint="dark" style={FILL} />
      ) : null}
      {backgroundMode === "image" && backgroundUrl ? (
        <Image source={{ uri: backgroundUrl }} style={FILL} contentFit="cover" />
      ) : null}
      {hasPoster && posterUrl ? (
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
      ) : null}
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
