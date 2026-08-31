import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Glass } from "../Glass";
import { Press } from "../Press";
import { GOLD, LIVE_RED } from "../../theme";
import type { ViewerAuctionMood } from "../../lib/viewer-auction-mood";
import { formatAuctionSeconds } from "./auction-now-bar";

export { formatAuctionSeconds } from "./auction-now-bar";

const LEAD = "#2EE59D";
const OUTBID = "#FF8A3D";
const WON_FILL = "rgba(30, 140, 80, 0.42)";
const LOST_FILL = "rgba(48, 50, 58, 0.55)";

function borderFor(mood: ViewerAuctionMood): string {
  if (mood === "leading" || mood === "won") return LEAD;
  if (mood === "outbid") return OUTBID;
  if (mood === "lost") return "rgba(160,160,168,0.55)";
  return "rgba(255,226,140,0.78)";
}

/** Bottom auction card — same layout for demo and real lives (viewer). */
export function AuctionNowBar({
  eyebrow,
  name,
  imageUrl,
  priceLabel,
  bidderName,
  secondsLeft,
  onPress,
  mood = "normal",
  statusLabel,
  urgentTimer,
  outbidFlashKey,
}: {
  eyebrow: string;
  name: string;
  imageUrl?: string | null;
  priceLabel: string;
  bidderName?: string | null;
  secondsLeft?: number | null;
  onPress?: () => void;
  mood?: ViewerAuctionMood;
  statusLabel?: string | null;
  urgentTimer?: boolean;
  outbidFlashKey?: number;
}) {
  const showTimer = secondsLeft != null && secondsLeft > 0;
  const pulse = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!urgentTimer) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.28, duration: 380, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [urgentTimer, pulse]);

  useEffect(() => {
    if (!outbidFlashKey) return;
    flash.setValue(1);
    const run = Animated.sequence([
      Animated.timing(flash, { toValue: 0.2, duration: 120, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [outbidFlashKey, flash]);

  const border = borderFor(mood);
  const inner = (
    <Animated.View style={{ opacity: mood === "outbid" ? flash : 1 }}>
      <View
        style={[
          styles.shell,
          { borderColor: border },
          mood === "won" && styles.wonFill,
          mood === "lost" && styles.lostFill,
        ]}
      >
        <Glass tone="dark" intensity={46} radius={18} borderless contentStyle={styles.pad}>
          <View style={styles.row}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={[styles.thumb, mood === "lost" && styles.thumbLost]}
                contentFit="cover"
              />
            ) : null}
            <View style={styles.body}>
              <Text style={styles.eyebrow} numberOfLines={1}>
                {eyebrow}
              </Text>
              <Text style={styles.title} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[styles.price, mood === "lost" && styles.priceLost]} numberOfLines={1}>
                {priceLabel}
              </Text>
              <View style={styles.metaRow}>
                <Text
                  style={[
                    styles.status,
                    mood === "leading" || mood === "won" ? styles.statusLead : null,
                    mood === "outbid" ? styles.statusOut : null,
                    mood === "lost" ? styles.statusLost : null,
                  ]}
                  numberOfLines={1}
                >
                  {statusLabel || bidderName || " "}
                </Text>
                {showTimer ? (
                  <Animated.Text
                    style={[
                      styles.timer,
                      urgentTimer && styles.timerUrgent,
                      urgentTimer ? { opacity: pulse } : null,
                    ]}
                  >
                    {formatAuctionSeconds(secondsLeft!)}
                  </Animated.Text>
                ) : null}
              </View>
            </View>
          </View>
        </Glass>
      </View>
    </Animated.View>
  );

  if (!onPress) return inner;

  return (
    <Press onPress={onPress} style={styles.tap} accessibilityRole="button">
      {inner}
    </Press>
  );
}

const styles = StyleSheet.create({
  tap: { minHeight: 0, minWidth: 0, width: "100%", alignItems: "stretch" },
  shell: {
    borderRadius: 20,
    borderWidth: 1.6,
    overflow: "hidden",
  },
  wonFill: { backgroundColor: WON_FILL },
  lostFill: { backgroundColor: LOST_FILL },
  pad: { paddingVertical: 10, paddingHorizontal: 10 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  thumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.25)" },
  thumbLost: { opacity: 0.45 },
  body: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: GOLD,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  title: { color: "#fff", fontWeight: "700", marginTop: 2, fontSize: 14 },
  price: { color: GOLD, fontSize: 20, fontWeight: "900", marginTop: 4 },
  priceLost: { color: "rgba(255,255,255,0.55)" },
  metaRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 2,
  },
  status: { color: "#fff", fontSize: 13, fontWeight: "700", flex: 1 },
  statusLead: { color: LEAD },
  statusOut: { color: OUTBID },
  statusLost: { color: "rgba(255,255,255,0.62)" },
  timer: { color: "#fff", fontWeight: "800", fontVariant: ["tabular-nums"], fontSize: 14 },
  timerUrgent: { color: LIVE_RED },
});
