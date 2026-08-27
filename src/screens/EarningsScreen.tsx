import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { GoldButton } from "../components/Buttons";
import { Glass } from "../components/Glass";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { useAppTheme } from "../context/theme";
import { GOLD } from "../theme";
import { formatEur, MOCK_EARNINGS } from "../mock/account";

export function EarningsScreen() {
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const [toast, setToast] = useState<string | null>(null);
  const available = MOCK_EARNINGS.filter((e) => e.state === "released").reduce((s, e) => s + e.cents, 0);
  const pending = MOCK_EARNINGS.filter((e) => e.state === "pending").reduce((s, e) => s + e.cents, 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("gains.title")} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.row2}>
          <Glass tone="gold" intensity={44} radius={20} style={{ flex: 1 }} padded>
            <Text style={styles.k}>{t("gains.available")}</Text>
            <Text style={[styles.v, { color: colors.foreground }]}>{formatEur(available)}</Text>
          </Glass>
          <Glass tone={dark ? "dark" : "light"} intensity={36} radius={20} style={{ flex: 1 }} padded>
            <Text style={[styles.k, { color: colors.mutedForeground }]}>{t("gains.pending")}</Text>
            <Text style={[styles.v, { color: colors.foreground }]}>{formatEur(pending)}</Text>
          </Glass>
        </View>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 18 }}>{t("gains.escrowExplainer")}</Text>
        <GoldButton
          label={t("gains.withdraw")}
          onPress={() => {
            setToast(t("payout.successBody"));
            setTimeout(() => setToast(null), 2200);
          }}
        />
        {MOCK_EARNINGS.map((e) => (
          <Glass key={e.id} tone={dark ? "dark" : "light"} intensity={32} radius={16} elevated={false}>
            <View style={styles.line}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.foreground }}>{e.label}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>{e.when}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontWeight: "800", color: colors.foreground }}>{formatEur(e.cents)}</Text>
                <Text style={{ color: e.state === "released" ? "#1B7A3A" : GOLD, fontSize: 11, fontWeight: "700", marginTop: 2 }}>
                  {t(`gains.moneyState.${e.state}`)}
                </Text>
              </View>
            </View>
          </Glass>
        ))}
      </ScrollView>
      <MockBanner text={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 10 },
  row2: { flexDirection: "row", gap: 10 },
  k: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase", color: GOLD },
  v: { fontSize: 22, fontWeight: "900", marginTop: 6 },
  line: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
});
