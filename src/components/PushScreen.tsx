import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const IOS_EASE = Easing.bezier(0.32, 0.72, 0, 1);
const IN_MS = 300;
const OUT_MS = 260;
const EDGE = 32;
const DISMISS_X = 90;
const DISMISS_V = 450;

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  zIndex?: number;
  swipeBackEnabled?: boolean;
};

export function PushScreen({ open, onClose, children, zIndex = 70, swipeBackEnabled = true }: Props) {
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(open);
  const x = useSharedValue(width);
  const screenW = useSharedValue(width);
  const wasOpen = useRef(open);
  screenW.value = width;

  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (open) {
      setMounted(true);
      x.value = screenW.value;
      const id = requestAnimationFrame(() => {
        x.value = withTiming(0, { duration: IN_MS, easing: IOS_EASE });
      });
      wasOpen.current = true;
      return () => cancelAnimationFrame(id);
    }
    if (wasOpen.current) {
      x.value = withTiming(screenW.value, { duration: OUT_MS, easing: IOS_EASE }, (finished) => {
        if (finished) runOnJS(unmount)();
      });
    }
    wasOpen.current = false;
    return undefined;
  }, [open, unmount, x, screenW]);

  const finishSwipe = useCallback(() => {
    onClose();
  }, [onClose]);

  const pan = Gesture.Pan()
    .enabled(swipeBackEnabled && mounted)
    .maxPointers(1)
    .activeOffsetX(8)
    .failOffsetY([-24, 24])
    .onUpdate((e) => {
      const next = e.translationX;
      x.value = next > 0 ? next : 0;
    })
    .onEnd((e) => {
      if (e.translationX > DISMISS_X || e.velocityX > DISMISS_V) {
        x.value = withTiming(screenW.value, { duration: 180, easing: IOS_EASE }, (finished) => {
          if (finished) runOnJS(finishSwipe)();
        });
      } else {
        x.value = withTiming(0, { duration: 220, easing: IOS_EASE });
      }
    });

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, Math.max(screenW.value, 1)], [0.28, 0], Extrapolation.CLAMP),
  }));

  if (!mounted) return null;

  return (
    <View style={[styles.host, { zIndex }]} pointerEvents="box-none">
      <Animated.View style={[styles.dim, dimStyle]} pointerEvents="none" />
      <Animated.View style={[styles.panel, panelStyle]}>
        <View style={styles.fill}>{children}</View>
        {swipeBackEnabled ? (
          <GestureDetector gesture={pan}>
            <View style={styles.edge} collapsable={false} />
          </GestureDetector>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
  },
  panel: {
    flex: 1,
    backgroundColor: "transparent",
    ...Platform.select({
      web: { boxShadow: "-12px 0 32px rgba(0,0,0,0.18)" },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 18,
        shadowOffset: { width: -8, height: 0 },
        elevation: 16,
      },
    }),
  },
  fill: { flex: 1 },
  edge: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: EDGE,
    zIndex: 40,
  },
});
