import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Glass } from "../Glass";
import { Press } from "../Press";
import { GOLD } from "../../theme";
import { formatAuctionSeconds } from "./auction-now-bar";

export { formatAuctionSeconds } from "./auction-now-bar";

/** Bottom auction card — same layout for demo and real lives (viewer + host). */
export function AuctionNowBar({
  eyebrow,
  name,
  imageUrl,
  priceLabel,
  bidderName,
  secondsLeft,
  onPress,
}: {
  eyebrow: string;
  name: string;
  imageUrl?: string | null;
  priceLabel: string;
  bidderName?: string | null;
  secondsLeft?: number | null;
  onPress?: () => void;
}) {
  const showTimer = secondsLeft != null && secondsLeft > 0;
  const inner = (
    <Glass tone="gold" intensity={46} radius={20} contentStyle={styles.pad}>
      <View style={styles.row}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.thumb} contentFit="cover" />
        ) : null}
        <View style={styles.body}>
          <Text style={styles.eyebrow} numberOfLines={1}>
            {eyebrow}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.price} numberOfLines={1}>
            {priceLabel}
          </Text>
          {bidderName || showTimer ? (
            <View style={styles.metaRow}>
              <Text style={styles.bidder} numberOfLines={1}>
                {bidderName ?? " "}
              </Text>
              {showTimer ? (
                <Text style={styles.timer}>{formatAuctionSeconds(secondsLeft!)}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Glass>
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
  pad: { paddingVertical: 10, paddingHorizontal: 10 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  thumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.25)" },
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
  metaRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 2,
  },
  timer: { color: "#fff", fontWeight: "800", fontVariant: ["tabular-nums"], fontSize: 14 },
  bidder: { color: "#fff", fontSize: 13, fontWeight: "700", flex: 1 },
});
