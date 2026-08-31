import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";

export function BattleSuddenDeathOverlay({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  if (!active) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 104 }]}>
      <LinearGradient colors={["#F6D365", "#C99212"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pill}>
        <Text style={styles.txt} numberOfLines={1}>
          ⚡ {t("battle.sudden.title")}
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 67,
    alignItems: "center",
  },
  pill: {
    maxWidth: "86%",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  txt: { color: "#10162B", fontSize: 11, fontWeight: "900" },
});
