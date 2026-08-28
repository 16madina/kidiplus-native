// Short center flash when a new bid lands — parity with kidiplus.com BidPulseFlash.
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export function BidPulseFlash({
  text,
  pulseKey,
}: {
  text: string | null;
  /** Bump on each new bid (e.g. lastBid.ts). */
  pulseKey: number;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!text || pulseKey === 0) return;
    setShow(true);
    const to = setTimeout(() => setShow(false), 1600);
    return () => clearTimeout(to);
  }, [pulseKey, text]);

  if (!show || !text) return null;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <LinearGradient
        colors={["#F0A03A", "#E06B28"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pill}
      >
        <Text style={styles.txt} numberOfLines={1}>
          {text}
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: "34%",
    left: 0,
    right: 0,
    zIndex: 47,
    alignItems: "center",
    paddingHorizontal: 28,
  },
  pill: {
    maxWidth: "100%",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  txt: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
});
