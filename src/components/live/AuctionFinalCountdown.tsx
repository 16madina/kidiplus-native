import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { NAVY } from "../../theme";

/** Gros 10 → 1 des 10 dernières secondes (kidiplus.com). Mort subite = reprend à 10. */
export function AuctionFinalCountdown({
  secondsLeft,
  active,
}: {
  secondsLeft: number;
  active: boolean;
}) {
  const show = active && secondsLeft > 0 && secondsLeft <= 10;
  const urgent = secondsLeft <= 5;

  useEffect(() => {
    if (!show) return;
    void Haptics.impactAsync(
      urgent ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium,
    ).catch(() => undefined);
  }, [show, secondsLeft, urgent]);

  if (!show) return null;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <LinearGradient
        colors={urgent ? ["#E24B4B", "#9B1C1C"] : ["#F7CE5A", "#D9A73A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.pill, urgent && styles.pillUrgent]}
      >
        <Text style={[styles.num, urgent && styles.numUrgent]}>{secondsLeft}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: "26%",
    left: 0,
    right: 0,
    zIndex: 55,
    alignItems: "center",
  },
  pill: {
    minWidth: 88,
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 18,
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
    fontSize: 48,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    lineHeight: 52,
  },
  numUrgent: {
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});
