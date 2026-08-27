import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { GoldButton } from "../components/Buttons";
import { OverlayHeader } from "../components/OverlayHeader";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { accountDeletionCheck, deleteMyAccount, type AccountDeletionCheck } from "../lib/account";
import { formatMoney, normalizeCurrency } from "../lib/money";

export function DeleteAccountScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const { signOut, user } = useAuth();
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<AccountDeletionCheck | null>(null);
  const [loadingCheck, setLoadingCheck] = useState(true);

  useEffect(() => {
    setLoadingCheck(true);
    void accountDeletionCheck().then((r) => {
      setCheck(r);
      setLoadingCheck(false);
    });
  }, []);

  const hasBlockers = !!check && check.ok && check.has_blockers;
  const canConfirm = confirmText.trim() === "DELETE" && !hasBlockers && !busy;

  const doDelete = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    const res = await deleteMyAccount();
    if (!res.ok) {
      setBusy(false);
      if (res.error === "has_blockers") setError(t("account.delete.hasBlockers"));
      else if (res.error === "unauthorized") setError(t("account.delete.unauthorized"));
      else setError(t("account.delete.failed"));
      return;
    }
    await signOut();
  };

  const walletCur = normalizeCurrency(user?.walletCurrency);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("account.delete.title")} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.warn}>
          <AlertTriangle size={18} color="#9B1C1C" />
          <View style={{ flex: 1 }}>
            <Text style={styles.warnTitle}>{t("account.delete.warnTitle")}</Text>
            <Text style={styles.warnBody}>{t("account.delete.warnBody")}</Text>
          </View>
        </View>

        <SurfaceCard>
          <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 20 }}>
            • {t("account.delete.effect.profile")}
          </Text>
          <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 20, marginTop: 4 }}>
            • {t("account.delete.effect.lives")}
          </Text>
          <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 20, marginTop: 4 }}>
            • {t("account.delete.effect.messages")}
          </Text>
          <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 20, marginTop: 4 }}>
            • {t("account.delete.effect.wallet")}
          </Text>
          <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 20, marginTop: 4 }}>
            • {t("account.delete.effect.orders")}
          </Text>
        </SurfaceCard>

        {loadingCheck ? (
          <ActivityIndicator color={colors.foreground} style={{ marginVertical: 16 }} />
        ) : hasBlockers && check && check.ok ? (
          <View style={styles.blockers}>
            <Text style={styles.blockersTitle}>{t("account.delete.blockersTitle")}</Text>
            {Number(check.wallet_balance) > 0 ? (
              <Text style={styles.blockerLine}>
                •{" "}
                {t("account.delete.blockers.wallet", {
                  amount: formatMoney(Number(check.wallet_balance), walletCur, i18n.language),
                })}
              </Text>
            ) : null}
            {Number(check.pending_payouts) > 0 ? (
              <Text style={styles.blockerLine}>• {t("account.delete.blockers.payouts")}</Text>
            ) : null}
            {Number(check.pending_orders) > 0 ? (
              <Text style={styles.blockerLine}>• {t("account.delete.blockers.orders")}</Text>
            ) : null}
            {Number(check.live_now) > 0 ? (
              <Text style={styles.blockerLine}>• {t("account.delete.blockers.live")}</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          {t("account.delete.typeConfirmLabel")}
        </Text>
        <TextInput
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="DELETE"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
          ]}
        />

        {error ? (
          <View style={{ backgroundColor: "#FDE8E8", borderRadius: 12, padding: 10 }}>
            <Text style={{ color: "#9B1C1C", fontSize: 13, fontWeight: "600" }}>{error}</Text>
          </View>
        ) : null}

        <GoldButton
          label={busy ? t("common.loading") : t("account.delete.confirmBtn")}
          onPress={() => void doDelete()}
          disabled={!canConfirm}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 12 },
  warn: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#FDE8E8",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(155,28,28,0.25)",
  },
  warnTitle: { color: "#9B1C1C", fontWeight: "900", fontSize: 14 },
  warnBody: { color: "#7F1D1D", fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  blockers: {
    backgroundColor: "rgba(245,158,11,0.12)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(180,83,9,0.35)",
  },
  blockersTitle: { fontWeight: "900", color: "#92400E", marginBottom: 6 },
  blockerLine: { color: "#78350F", fontSize: 12.5, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
