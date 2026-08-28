import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/auth";

/** Freeze is not a ban: user can browse, but payouts/wallet spend are blocked server-side. */
export function FrozenBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (!user?.isFrozen) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{t("admin.frozen.banner")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: "#1D4ED8",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  text: { color: "#fff", fontSize: 13, fontWeight: "700", lineHeight: 18 },
});
