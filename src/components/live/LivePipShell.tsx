import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { PanResponder, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Press } from "../Press";
import { LIVE_PIP_MINI, liveEdgeShouldCatch, liveEdgeShouldMinimize } from "../../lib/live-pip-presentation";
import { LIVE_RED } from "../../theme";

type Props = {
  minimized: boolean;
  systemPip: boolean;
  children: ReactNode;
  onExpand: () => void;
  onClose: () => void;
  onMinimize: () => void;
};

/**
 * Full-screen live ↔ in-app mini player. Children (LiveKit) stay mounted so
 * the video does not flash when shrinking, expanding, or entering system PiP.
 */
export function LivePipShell({
  minimized,
  systemPip,
  children,
  onExpand,
  onClose,
  onMinimize,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const draggedRef = useRef(false);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const floatingMini = minimized && !systemPip;

  useEffect(() => {
    if (floatingMini) return;
    tx.value = 0;
    ty.value = 0;
  }, [floatingMini, tx, ty]);

  const drag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          floatingMini && (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6),
        onPanResponderGrant: () => {
          draggedRef.current = false;
          startX.value = tx.value;
          startY.value = ty.value;
        },
        onPanResponderMove: (_, g) => {
          if (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8) draggedRef.current = true;
          const originLeft = width - LIVE_PIP_MINI.width - LIVE_PIP_MINI.right;
          const originTop = height - LIVE_PIP_MINI.height - LIVE_PIP_MINI.bottom - insets.bottom;
          tx.value = Math.max(-originLeft + 8, Math.min(8, startX.value + g.dx));
          ty.value = Math.max(-originTop + 8, Math.min(8, startY.value + g.dy));
        },
        onPanResponderRelease: () => {
          setTimeout(() => {
            draggedRef.current = false;
          }, 120);
        },
      }),
    [floatingMini, height, insets.bottom, startX, startY, tx, ty, width],
  );

  const edge = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          !floatingMini && !systemPip && liveEdgeShouldCatch(g.dx, g.dy),
        onPanResponderRelease: (_, g) => {
          if (liveEdgeShouldMinimize(g.dx, g.vx)) onMinimize();
        },
      }),
    [floatingMini, onMinimize, systemPip],
  );

  const box = useAnimatedStyle(() => {
    if (systemPip) {
      return {
        position: "absolute" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width,
        height,
        borderRadius: 0,
        zIndex: 200,
        overflow: "hidden" as const,
        transform: [{ translateX: 0 }, { translateY: 0 }],
      };
    }
    if (floatingMini) {
      return {
        position: "absolute" as const,
        top: height - LIVE_PIP_MINI.height - LIVE_PIP_MINI.bottom - insets.bottom,
        left: width - LIVE_PIP_MINI.width - LIVE_PIP_MINI.right,
        right: undefined,
        bottom: undefined,
        width: LIVE_PIP_MINI.width,
        height: LIVE_PIP_MINI.height,
        borderRadius: 18,
        zIndex: 55,
        overflow: "hidden" as const,
        transform: [{ translateX: tx.value }, { translateY: ty.value }],
      };
    }
    return {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width,
      height,
      borderRadius: 0,
      zIndex: 80,
      overflow: "hidden" as const,
      transform: [{ translateX: 0 }, { translateY: 0 }],
    };
  });

  return (
    <Animated.View
      style={[styles.shell, box, floatingMini && styles.miniShadow]}
      pointerEvents="box-none"
    >
      <View style={styles.fill}>{children}</View>

      {floatingMini ? (
        <View style={StyleSheet.absoluteFill} {...drag.panHandlers}>
          <Press
            haptic="none"
            accessibilityLabel={t("live.expand")}
            onPress={() => {
              if (draggedRef.current) return;
              onExpand();
            }}
            style={styles.expandHit}
          />
          <View style={styles.liveBadge} pointerEvents="none">
            <Text style={styles.liveBadgeTxt}>LIVE</Text>
          </View>
          <Press
            haptic="light"
            accessibilityLabel={t("live.leave")}
            onPress={onClose}
            style={styles.closeMini}
          >
            <X size={14} color="#fff" />
          </Press>
        </View>
      ) : null}

      {!floatingMini && !systemPip ? (
        <View
          style={styles.edge}
          {...edge.panHandlers}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: "#000",
  },
  fill: { flex: 1 },
  miniShadow: {
    ...Platform.select({
      web: { boxShadow: "0 12px 40px rgba(0,0,0,0.45)" },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.4,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 18,
      },
    }),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
  },
  expandHit: {
    ...StyleSheet.absoluteFill,
    minHeight: 0,
    minWidth: 0,
  },
  liveBadge: {
    position: "absolute",
    left: 6,
    top: 6,
    backgroundColor: LIVE_RED,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  liveBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  closeMini: {
    position: "absolute",
    right: 4,
    top: 4,
    width: 28,
    height: 28,
    minWidth: 28,
    minHeight: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  edge: {
    position: "absolute",
    top: 100,
    bottom: 0,
    left: 0,
    width: 40,
    zIndex: 40,
  },
});
