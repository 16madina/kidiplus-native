import { useState } from "react";
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "./Press";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { convertMoney, formatMoney, normalizeCurrency, type Currency } from "../lib/money";
import { supabase } from "../lib/supabase";
import { GOLD } from "../theme";

const ROWS: Array<{ code: Currency; label: string }> = [
  { code: "EUR", label: "🇪🇺 EUR — Euro" },
  { code: "XOF", label: "🇨🇮 FCFA (XOF)" },
  { code: "CAD", label: "🇨🇦 CAD — Dollar canadien" },
  { code: "USD", label: "🇺🇸 USD — Dollar américain" },
];

export function CurrencySheet({
  open,
  onClose,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, updateProfile, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);

  const current = normalizeCurrency(user?.walletCurrency);
  const balance = user?.walletBalance ?? 0;

  const apply = async (c: Currency) => {
    setBusy(true);
    try {
      await updateProfile({ currency: c });
      // Server-side conversion: wallet balance + seller earnings follow the
      // profile currency atomically (audited in wallet_transactions).
      const { data, error } = await supabase.rpc("convert_my_wallet_currency", {} as never);
      const res = (data ?? {}) as { ok?: boolean; converted?: boolean; new_balance?: number };
      if (error || res.ok === false) {
        // Fallback: zero-balance wallets can still be synced.
        try {
          await supabase.rpc("sync_my_wallet_currency", {} as never);
        } catch {
          /* ignore */
        }
        onToast(t("settings.currencyWalletLocked"));
      } else if (res.converted) {
        onToast(
          t("settings.currencyConverted", {
            balance: formatMoney(Number(res.new_balance ?? 0), c, i18n.language),
          }),
        );
      } else {
        onToast(t("settings.currencyUpdated"));
      }
      await refreshUser();
    } catch (e) {
      onToast(e instanceof Error ? e.message : t("errors.generic", { defaultValue: "Erreur" }));
    } finally {
      setBusy(false);
      onClose();
    }
  };

  const choose = (c: Currency) => {
    if (busy) return;
    if (c === current) {
      onClose();
      return;
    }
    if (balance > 0) {
      const est = convertMoney(balance, current, c);
      Alert.alert(
        t("settings.chooseCurrency"),
        t("settings.currencyConvertConfirm", {
          from: formatMoney(balance, current, i18n.language),
          to: formatMoney(est, c, i18n.language),
        }),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.confirm"), onPress: () => void apply(c) },
        ],
      );
      return;
    }
    void apply(c);
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Press haptic="none" onPress={onClose} style={styles.sheetDim} />
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: colors.foreground }]}>{t("settings.chooseCurrency")}</Text>
            <Press onPress={onClose} style={styles.close}>
              <X size={18} color={colors.foreground} />
            </Press>
          </View>
          <View style={[styles.list, { borderColor: colors.border, backgroundColor: colors.card }]}>
            {ROWS.map((r, i) => (
              <Press
                key={r.code}
                onPress={() => choose(r.code)}
                style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              >
                <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: colors.foreground }}>{r.label}</Text>
                {busy && current !== r.code ? null : current === r.code ? <Check size={18} color={GOLD} /> : null}
              </Press>
            ))}
          </View>
          {busy ? <ActivityIndicator color={GOLD} style={{ marginTop: 12 }} /> : null}
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 12, lineHeight: 17 }}>
            {t("settings.currencyHint")}
          </Text>
          {balance > 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 6, lineHeight: 17 }}>
              {t("settings.currencyBalanceNote", {
                balance: formatMoney(balance, current, i18n.language),
              })}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetDim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    minHeight: 0,
    minWidth: 0,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  title: { fontSize: 18, fontWeight: "800" },
  close: { width: 36, height: 36, minWidth: 36, minHeight: 36 },
  list: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    minHeight: 52,
  },
});
