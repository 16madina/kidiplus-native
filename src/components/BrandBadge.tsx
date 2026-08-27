import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

export type BrandKey = "wave" | "orange" | "djamo" | "card" | "paypal";

/** Compact brand marks — mirrors kidiplus.com BrandBadge (SVG only). */
export function BrandBadge({ brand, size = 36 }: { brand: BrandKey; size?: number }) {
  const r = Math.round(size * 0.26);
  if (brand === "wave") {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Rect width="48" height="48" rx="12" fill="#1DC8FF" />
        <Ellipse cx="24" cy="25.5" rx="12" ry="14" fill="#0B1220" />
        <Ellipse cx="24" cy="28" rx="7.5" ry="9" fill="#FFFFFF" />
        <Circle cx="19.8" cy="21.5" r="2.6" fill="#FFFFFF" />
        <Circle cx="28.2" cy="21.5" r="2.6" fill="#FFFFFF" />
        <Path d="M22.2 25.2h3.6L24 27.6 22.2 25.2Z" fill="#FF8A00" />
        <Ellipse cx="18.8" cy="38.8" rx="3.6" ry="1.8" fill="#FF8A00" />
        <Ellipse cx="29.2" cy="38.8" rx="3.6" ry="1.8" fill="#FF8A00" />
        <Path
          d="M12.5 23c-3.2-1.4-5.2-4-5.5-6.8-.2-1.4 1-1.9 1.8-1 1.8 2 4 4 6.8 5.2L12.5 23Z"
          fill="#0B1220"
        />
      </Svg>
    );
  }
  if (brand === "orange") {
    return (
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Rect width="48" height="48" rx="12" fill="#FFF4E8" />
        <Path d="M24 14v18" stroke="#FF7900" strokeWidth="6" strokeLinecap="round" />
        <Path
          d="M16 24l8 8 8-8"
          stroke="#FF7900"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  if (brand === "djamo") {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: "#4136F1",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: size * 0.22, fontWeight: "900", letterSpacing: -0.3 }}>
          djamo
        </Text>
      </View>
    );
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
