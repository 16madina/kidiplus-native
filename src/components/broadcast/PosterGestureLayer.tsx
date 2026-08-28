import { useCallback, useEffect } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, runOnJS } from "react-native-reanimated";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useLiveEffects, clampPosterTransform } from "../../lib/filters/live-effects-context";
import { GOLD } from "../../theme";

const POSTER_W = 200;
const POSTER_H = 160;

/**
 * Draggable / pinchable poster overlay. Must not pass JS refs into worklets
 * (that crashed Reanimated and killed the app). Shared values only.
 */
export function PosterGestureLayer() {
  const { t } = useTranslation();
  const { posterUrl, posterMode, posterTransform, setPosterTransform } = useLiveEffects();

  const boxW = useSharedValue(1);
  const boxH = useSharedValue(1);
  const tx = useSharedValue(posterTransform.x);
  const ty = useSharedValue(posterTransform.y);
  const sc = useSharedValue(posterTransform.scale);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startSc = useSharedValue(1);

  useEffect(() => {
    tx.value = posterTransform.x;
    ty.value = posterTransform.y;
    sc.value = posterTransform.scale;
  }, [posterTransform.x, posterTransform.y, posterTransform.scale, sc, tx, ty]);

  const commit = useCallback(
    (x: number, y: number, scale: number) => {
      setPosterTransform(clampPosterTransform({ x, y, scale }));
    },
    [setPosterTransform],
  );

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      const w = Math.max(1, boxW.value);
      const h = Math.max(1, boxH.value);
      tx.value = Math.min(0.95, Math.max(0.05, startX.value + e.translationX / w));
      ty.value = Math.min(0.95, Math.max(0.05, startY.value + e.translationY / h));
    })
    .onEnd(() => {
      runOnJS(commit)(tx.value, ty.value, sc.value);
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startSc.value = sc.value;
    })
    .onUpdate((e) => {
      sc.value = Math.min(3, Math.max(0.35, startSc.value * e.scale));
    })
    .onEnd(() => {
      runOnJS(commit)(tx.value, ty.value, sc.value);
    });

  const gesture = Gesture.Simultaneous(pan, pinch);

  const posterStyle = useAnimatedStyle(() => ({
    left: tx.value * boxW.value - POSTER_W / 2,
    top: ty.value * boxH.value - POSTER_H / 2,
    transform: [{ scale: sc.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    boxW.value = e.nativeEvent.layout.width;
    boxH.value = e.nativeEvent.layout.height;
  };

  if (!posterUrl || posterMode === "off") return null;

  return (
    <View pointerEvents="box-none" style={styles.layer} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.posterWrap, posterStyle]} collapsable={false}>
          <Image source={{ uri: posterUrl }} style={styles.posterImg} contentFit="contain" />
        </Animated.View>
      </GestureDetector>
      <Text pointerEvents="none" style={styles.hint}>
        {t("broadcast.effects.posterHint", "Glisse pour déplacer · Pince pour zoomer")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 8,
  },
  posterWrap: {
    position: "absolute",
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: GOLD,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  posterImg: { width: "100%", height: "100%" },
  hint: {
    position: "absolute",
    bottom: "22%",
    left: 0,
    right: 0,
    textAlign: "center",
    color: "rgba(255,255,255,0.8)",
    fontWeight: "700",
    fontSize: 11,
  },
});
