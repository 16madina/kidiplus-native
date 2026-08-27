import { Image, StyleSheet, Text, View } from "react-native";
import { GOLD } from "../theme";
import { useAppTheme } from "../context/theme";

const logoLight = require("../../assets/brand/logo.png");
const logoDark = require("../../assets/brand/logo-dark.png");

export function Logo({ size = 44, onDark }: { size?: number; onDark?: boolean }) {
  const { dark } = useAppTheme();
  const darkAsset = onDark ?? dark;
  return (
    <Image
      source={darkAsset ? logoDark : logoLight}
      style={{ height: size, width: size * 2.4, resizeMode: "contain" }}
      accessibilityLabel="KiDi+"
    />
  );
}

export function Wordmark({ size = 48, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.kidi, { fontSize: size, color }]}>
        KIDI
        <Text style={{ color: GOLD }}>+</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "baseline" },
  kidi: {
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: undefined,
  },
});
