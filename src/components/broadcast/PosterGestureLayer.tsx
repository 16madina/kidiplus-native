import { useRef } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, runOnJS } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useLiveEffects, clampPosterTransform } from "../../lib/filters/live-effects-context";
import { GOLD } from "../../theme";

export function PosterGestureLayer() {
  const { t } = useTranslation();
  const { posterUrl, posterMode, posterTransform, setPosterTransform } = useLiveEffects();
  const containerSize = useRef({ w: 1, h: 1 });

  const tx = useSharedValue(posterTransform.x);
  const ty = useSharedValue(posterTransform.y);
  const sc = useSharedValue(posterTransform.scale);

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startSc = useSharedValue(1);

  if (!posterUrl || posterMode === "off") return null;

  const commit = (x: number, y: number, scale: number) => {
    setPosterTransform(clampPosterTransform({ x, y, scale }));
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      const { w, h } = containerSize.current;
      tx.value = startX.value + e.translationX / Math.max(1, w);
      ty.value = startY.value + e.translationY / Math.max(1, h);
    })
    .onEnd(() => {
      runOnJS(commit)(tx.value, ty.value, sc.value);
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startSc.value = sc.value;
    })
    .onUpdate((e) => {
      sc.value = startSc.value * e.scale;
    })
    .onEnd(() => {
      runOnJS(commit)(tx.value, ty.value, sc.value);
    });

  const gesture = Gesture.Simultaneous(pan, pinch);

  const onLayout = (e: LayoutChangeEvent) => {
    containerSize.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={styles.layer} onLayout={onLayout}>
        <Text style={styles.hint}>
          {t("broadcast.effects.posterHint", "Glisse pour déplacer · Pince pour zoomer")}
        </Text>
      </Animated.View>
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
