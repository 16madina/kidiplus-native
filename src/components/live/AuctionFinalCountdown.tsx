import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { NAVY } from "../../theme";

/** Gros 3 → 1 des 3 dernières secondes. Mort subite = reprend à 3. */
export function AuctionFinalCountdown({
  secondsLeft,
  active,
  embedded,
  compact,
}: {
  secondsLeft: number;
  active: boolean;
  /** When true, no absolute positioning (parent stacks with mort subite / bid). */
  embedded?: boolean;
  compact?: boolean;
}) {
  const show = active && secondsLeft > 0 && secondsLeft <= 3;

  useEffect(() => {
    if (!show) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
  }, [show, secondsLeft]);

  if (!show) return null;

  const numSize = compact ? 26 : 32;

  return (
    <View pointerEvents="none" style={embedded ? styles.embed : styles.wrap}>
      <LinearGradient
        colors={["#E24B4B", "#9B1C1C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.pill, styles.pillUrgent, compact && { minWidth: 44, paddingVertical: 2 }]}
      >
        <Text style={[styles.num, styles.numUrgent, { fontSize: numSize, lineHeight: numSize + 4 }]}>
          {secondsLeft}
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: "22%",
    left: 0,
    right: 0,
    zIndex: 55,
    alignItems: "center",
  },
  embed: {
    alignItems: "center",
  },
  pill: {
    minWidth: 52,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(16,22,43,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  pillUrgent: {
    borderColor: "rgba(255,255,255,0.35)",
  },
  num: {
    color: NAVY,
    fontSize: 32,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    lineHeight: 36,
  },
  numUrgent: {
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});
