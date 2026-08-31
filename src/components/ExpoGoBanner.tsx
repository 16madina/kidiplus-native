import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { isExpoGo } from "../lib/expo-go";
import { GOLD, LIVE_RED } from "../theme";

/** Visible as soon as the JS bundle runs inside Expo Go — lives cannot start there. */
export function ExpoGoBanner() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  if (!isExpoGo()) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { paddingTop: Math.max(insets.top, 10) + 6 }]}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{t("expoGo.title")}</Text>
        <Text style={styles.body}>{t("expoGo.body")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    zIndex: 200,
  },
  card: {
    backgroundColor: LIVE_RED,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: GOLD,
  },
  title: { color: GOLD, fontWeight: "900", fontSize: 14 },
  body: { color: "#fff", marginTop: 4, fontWeight: "700", fontSize: 12, lineHeight: 17 },
});
