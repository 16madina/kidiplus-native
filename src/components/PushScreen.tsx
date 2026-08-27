import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PanResponder, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
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
const EDGE = 40;
const DISMISS_X = 64;
const DISMISS_V = 0.45;

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  zIndex?: number;
  swipeBackEnabled?: boolean;
};

export function PushScreen({ open, onClose, children, zIndex = 70, swipeBackEnabled = true }: Props) {
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  const x = useSharedValue(width);
  const screenW = useSharedValue(width);
  const wasOpen = useRef(false);
  screenW.value = width;

  const unmount = useCallback(() => setMounted(false), []);

  // Phase 1: mount off-screen (or start exit).
  useEffect(() => {
    if (open) {
      x.value = screenW.value;
      setMounted(true);
      wasOpen.current = true;
      return undefined;
    }
    if (wasOpen.current) {
      x.value = withTiming(screenW.value, { duration: OUT_MS, easing: IOS_EASE }, (finished) => {
        if (finished) runOnJS(unmount)();
      });
    }
    wasOpen.current = false;
    return undefined;
  }, [open, unmount, x, screenW]);

  // Phase 2: after the panel is in the tree at x=width, slide to 0.
  useEffect(() => {
    if (!open || !mounted) return;
    const id = requestAnimationFrame(() => {
      x.value = withTiming(0, { duration: IN_MS, easing: IOS_EASE });
    });
    return () => cancelAnimationFrame(id);
  }, [open, mounted, x]);

  const finishSwipe = useCallback(() => {
    onClose();
  }, [onClose]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => swipeBackEnabled,
        onMoveShouldSetPanResponder: (_, g) => swipeBackEnabled && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => {
          x.value = g.dx > 0 ? g.dx : 0;
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx > DISMISS_X || g.dx > screenW.value * 0.2 || g.vx > DISMISS_V) {
            x.value = withTiming(screenW.value, { duration: 180, easing: IOS_EASE }, (finished) => {
              if (finished) runOnJS(finishSwipe)();
            });
          } else {
            x.value = withTiming(0, { duration: 220, easing: IOS_EASE });
          }
        },
        onPanResponderTerminate: () => {
          x.value = withTiming(0, { duration: 220, easing: IOS_EASE });
        },
      }),
    [swipeBackEnabled, finishSwipe, x, screenW],
  );

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
          <View
            style={[styles.edge, Platform.OS === "web" ? (webEdge as object) : null]}
            collapsable={false}
            {...panResponder.panHandlers}
          />
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
    top: 56,
    bottom: 0,
    left: 0,
    width: EDGE,
    zIndex: 40,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
});

const webEdge = {
  cursor: "ew-resize",
  touchAction: "none",
  userSelect: "none",
} as const;
