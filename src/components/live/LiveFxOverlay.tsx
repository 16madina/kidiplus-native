import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import {
  liveFxHasVisual,
  posterTransformOf,
  type LiveFxPayload,
} from "../../lib/live-fx";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
const POSTER_W = 200;
const POSTER_H = 160;

/**
 * Read-only reconstruction of the host FX stack on the viewer (and host tint/blur).
 * Poster drag stays on `PosterGestureLayer` for the host.
 */
export function LiveFxOverlay({
  fx,
  includePoster = true,
}: {
  fx: LiveFxPayload;
  includePoster?: boolean;
}) {
  if (!liveFxHasVisual(fx)) return null;
  const transform = posterTransformOf(fx);
  const showPoster = includePoster && fx.posterMode === "cover" && !!fx.posterUrl;
  const tint = fx.tint && fx.tint !== "transparent" ? fx.tint : null;
  const showBlur = fx.backgroundMode === "blur";

  return (
    <View pointerEvents="none" style={styles.layer} collapsable={false}>
      {showBlur ? (
        Platform.OS === "ios" ? (
          <BlurView intensity={48} tint="dark" style={FILL} />
        ) : (
          <View style={[FILL, styles.androidBlur]} />
        )
      ) : null}
      {tint ? <View style={[FILL, { backgroundColor: tint }]} /> : null}
      {showPoster ? (
        <View
          style={[
            styles.posterWrap,
            {
              left: `${transform.x * 100}%`,
              top: `${transform.y * 100}%`,
              marginLeft: -POSTER_W / 2,
              marginTop: -POSTER_H / 2,
              transform: [{ scale: transform.scale }],
            },
          ]}
        >
          <Image source={{ uri: fx.posterUrl! }} style={styles.posterImg} contentFit="contain" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...FILL, zIndex: 3, elevation: 3 },
  androidBlur: { backgroundColor: "rgba(12,14,24,0.42)" },
  posterWrap: {
    position: "absolute",
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(232,185,59,0.85)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  posterImg: { width: "100%", height: "100%" },
});
