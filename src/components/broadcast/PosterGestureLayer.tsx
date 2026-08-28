import { useCallback, useEffect } from "react";
import { Dimensions, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, runOnJS } from "react-native-reanimated";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useLiveEffects, clampPosterTransform } from "../../lib/filters/live-effects-context";
import { applyPosterPan, applyPosterPinch } from "../../lib/filters/poster-gesture";
import { GOLD } from "../../theme";

const POSTER_W = 200;
const POSTER_H = 160;

/**
 * Same contract as kidiplus.com: one finger drags the poster, two fingers pinch
 * to scale. Gestures run on the preview overlay (not only the 200×160 frame)
 * so a pinch actually fits. Taps do not move the image.
 */
export function PosterGestureLayer() {
  const { t } = useTranslation();
  const { posterUrl, posterMode, posterTransform, setPosterTransform } = useLiveEffects();
  const win = Dimensions.get("window");

  const boxW = useSharedValue(win.width);
  const boxH = useSharedValue(win.height);
  const tx = useSharedValue(posterTransform.x);
  const ty = useSharedValue(posterTransform.y);
  const sc = useSharedValue(posterTransform.scale);
  const startX = useSharedValue(posterTransform.x);
  const startY = useSharedValue(posterTransform.y);
  const startSc = useSharedValue(posterTransform.scale);

  useEffect(() => {
    tx.value = posterTransform.x;
    ty.value = posterTransform.y;
    sc.value = posterTransform.scale;
    // Reset only when a new poster is picked — never while the finger is down.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- posterUrl is the reset key
  }, [posterUrl]);

  const commit = useCallback(
    (x: number, y: number, scale: number) => {
      setPosterTransform(clampPosterTransform({ x, y, scale }));
    },
    [setPosterTransform],
  );

  const pan = Gesture.Pan()
    .minDistance(12)
    .maxPointers(1)
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
      startSc.value = sc.value;
    })
    .onUpdate((e) => {
      const next = applyPosterPan({
        originX: startX.value,
        originY: startY.value,
        originScale: startSc.value,
        translationX: e.translationX,
        translationY: e.translationY,
        boxW: boxW.value,
        boxH: boxH.value,
      });
      tx.value = next.x;
      ty.value = next.y;
    })
    .onEnd(() => {
      runOnJS(commit)(tx.value, ty.value, sc.value);
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
      startSc.value = sc.value;
    })
    .onUpdate((e) => {
      sc.value = applyPosterPinch(startSc.value, e.scale);
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
    const { width, height } = e.nativeEvent.layout;
    if (width >= 64 && height >= 64) {
      boxW.value = width;
      boxH.value = height;
    }
  };

  if (!posterUrl || posterMode === "off") return null;

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.layer} onLayout={onLayout} collapsable={false}>
        <Animated.View style={[styles.posterWrap, posterStyle]} pointerEvents="none">
          <Image source={{ uri: posterUrl }} style={styles.posterImg} contentFit="contain" />
        </Animated.View>
        <Text pointerEvents="none" style={styles.hint}>
          {t("broadcast.effects.posterHint", "Glisse pour déplacer · Pince pour zoomer")}
        </Text>
      </View>
    </GestureDetector>
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
