import { StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

export type BrandKey = "wave" | "orange" | "djamo" | "card" | "paypal";

function LetterMark({ size, bg, letter }: { size: number; bg: string; letter: string }) {
  const r = Math.round(size * 0.26);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontSize: size * 0.42, fontWeight: "900" }}>{letter}</Text>
    </View>
  );
}

/** Compact brand marks — Wave / Orange / Djamo as letter badges. */
export function BrandBadge({ brand, size = 36 }: { brand: BrandKey; size?: number }) {
  const r = Math.round(size * 0.26);
  if (brand === "wave") {
    return <LetterMark size={size} bg="#06B6D4" letter="W" />;
  }
  if (brand === "orange") {
    return <LetterMark size={size} bg="#FF7900" letter="O" />;
  }
  if (brand === "djamo") {
    return <LetterMark size={size} bg="#4136F1" letter="D" />;
  }
  if (brand === "paypal") {
    return (
      <View style={[styles.paypal, { width: size, height: size, borderRadius: r }]}>
        <Text style={{ color: "#fff", fontSize: size * 0.42, fontWeight: "900", fontStyle: "italic" }}>P</Text>
      </View>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect width="48" height="48" rx="12" fill="#0F172A" />
      <Rect x="12.5" y="15" width="23" height="17" rx="2.5" stroke="#fff" strokeWidth="2.2" fill="none" />
      <Path d="M12.5 21h23" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  paypal: {
    backgroundColor: "#003087",
    alignItems: "center",
    justifyContent: "center",
  },
});
