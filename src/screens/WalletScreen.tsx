import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { GoldButton } from "../components/Buttons";
import { Glass } from "../components/Glass";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { useNav } from "../context/navigation";
import { GOLD, NAVY } from "../theme";
import { formatEur, MOCK_WALLET_TX, TOPUP_AMOUNTS, type WalletTx } from "../mock/account";

export function WalletScreen() {
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const { user, adjustWallet } = useAuth();
  const { openOverlay } = useNav();
  const [toast, setToast] = useState<string | null>(null);
  const [tx, setTx] = useState<WalletTx[]>(MOCK_WALLET_TX);
  const balance = user?.walletBalance ?? 0;

  const topup = (cents: number) => {
    adjustWallet(cents);
    setTx((prev) => [
      {
        id: `t-${Date.now()}`,
        type: "topup",
        label: t("wallet.tx.topup"),
        cents,
        time: "À l'instant",
      },
      ...prev,
    ]);
    setToast(t("wallet.topup.credited", { amount: formatEur(cents) }));
    setTimeout(() => setToast(null), 2200);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("wallet.title")} />
      <ScrollView contentContainerStyle={styles.body}>
        <Glass tone={dark ? "dark" : "gold"} intensity={48} radius={24} padded>
          <Text style={[styles.eyebrow, { color: dark ? GOLD : NAVY }]}>{t("wallet.currentBalance")}</Text>
          <Text style={[styles.balance, { color: colors.foreground }]}>{formatEur(balance)}</Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t("wallet.explainer")}</Text>
        </Glass>

        <Text style={[styles.section, { color: colors.foreground }]}>{t("wallet.topup.chooseAmount")}</Text>
        <View style={styles.amounts}>
          {TOPUP_AMOUNTS.map((cents) => (
            <Press key={cents} onPress={() => topup(cents)} style={styles.amtPress}>
              <Glass tone={dark ? "dark" : "light"} intensity={36} radius={16} elevated={false}>
                <View style={styles.amtInner}>
                  <Plus size={14} color={GOLD} />
                  <Text style={{ fontWeight: "800", color: colors.foreground }}>{formatEur(cents)}</Text>
                </View>
              </Glass>
            </Press>
          ))}
        </View>
        <GoldButton label={t("wallet.topupCta")} onPress={() => topup(5000)} />
        <Press onPress={() => openOverlay({ kind: "earnings" })} style={{ minHeight: 36 }}>
          <Text style={{ color: GOLD, fontWeight: "700" }}>{t("wallet.toEarningsLink")}</Text>
        </Press>

        <Text style={[styles.section, { color: colors.foreground }]}>{t("wallet.history")}</Text>
        {tx.map((row) => (
          <Glass key={row.id} tone={dark ? "dark" : "light"} intensity={32} radius={16} elevated={false}>
            <View style={styles.row}>
              <View style={styles.txIcon}>
                {row.cents >= 0 ? (
                  <ArrowDownLeft size={16} color="#1B7A3A" />
                ) : (
                  <ArrowUpRight size={16} color="#C0392B" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.foreground }}>{row.label}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>{row.time}</Text>
              </View>
              <Text style={{ fontWeight: "800", color: row.cents >= 0 ? "#1B7A3A" : colors.foreground }}>
                {row.cents >= 0 ? "+" : ""}
                {formatEur(row.cents)}
              </Text>
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
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  balance: { fontSize: 36, fontWeight: "900", marginTop: 6, letterSpacing: -0.8 },
  hint: { marginTop: 8, fontSize: 13, lineHeight: 18 },
  section: { marginTop: 10, fontSize: 16, fontWeight: "800" },
  amounts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  amtPress: { width: "48%", minHeight: 48, alignItems: "stretch" },
  amtInner: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  txIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(232,185,59,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
