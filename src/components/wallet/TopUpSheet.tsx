import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CreditCard, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { useAuth } from "../../context/auth";
import { useAppTheme } from "../../context/theme";
import { formatMoney, normalizeCurrency, topUpPresets } from "../../lib/money";
import { mapPayError } from "../../lib/pay-errors";
import {
  confirmWalletTopup,
  createPaypalTopup,
  createWalletTopup,
  openPaypalCheckout,
  topUpLimits,
} from "../../lib/payments";
import { presentStripePayment, stripeAvailable } from "../../lib/stripe-native";
import { GOLD } from "../../theme";

export function TopUpSheet({
  open,
  initialAmount,
  onClose,
  onDone,
}: {
  open: boolean;
  initialAmount?: number | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<null | "card" | "paypal">(null);
  const [error, setError] = useState<string | null>(null);

  const currency = normalizeCurrency(user?.walletCurrency);
  const limits = topUpLimits(currency);
  const presets = topUpPresets(currency);

  useEffect(() => {
    if (open) {
      setAmount(initialAmount ? String(initialAmount) : "");
      setError(null);
      setBusy(null);
    }
  }, [open, initialAmount]);

  const parseAmount = (): number | null => {
    const n = Number(String(amount).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setError(t("pay.errors.invalidAmount"));
      return null;
    }
    if (n < limits.min || n > limits.max) {
      setError(
        t("wallet.topup.range", {
          min: formatMoney(limits.min, currency, i18n.language),
          max: formatMoney(limits.max, currency, i18n.language),
        }),
      );
      return null;
    }
    return n;
  };

  const topupCard = async () => {
    if (busy) return;
    const n = parseAmount();
    if (n == null) return;
    if (!stripeAvailable()) {
      setError(
        t("pay.rebuildForCard", {
          defaultValue:
            "Le paiement carte demande le nouveau build natif : npx expo run:ios --device. En attendant, utilise PayPal.",
        }),
      );
      return;
    }
    setBusy("card");
    setError(null);
    const intent = await createWalletTopup(n);
    if (!intent.ok) {
      setBusy(null);
      setError(mapPayError(intent.error, t, intent.message));
      return;
    }
    if (!intent.data.clientSecret || !intent.data.publishableKey) {
      setBusy(null);
      setError(t("pay.errors.notConfigured"));
      return;
    }
    const sheet = await presentStripePayment({
      clientSecret: intent.data.clientSecret,
      publishableKey: intent.data.publishableKey,
    });
    if (!sheet.ok) {
      setBusy(null);
      if (!sheet.cancelled) setError(sheet.error ?? t("pay.errors.cardDeclined"));
      return;
    }
    const piId = intent.data.clientSecret.split("_secret")[0] ?? "";
    const conf = await confirmWalletTopup(piId);
    if (!conf.ok) {
      // Webhook may still credit — refresh anyway.
      await refreshUser();
      setBusy(null);
      setError(mapPayError(conf.error, t, conf.message));
      return;
    }
    await refreshUser();
    setBusy(null);
    onDone(t("wallet.topup.success"));
  };

  const topupPaypal = async () => {
    if (busy) return;
    const n = parseAmount();
    if (n == null) return;
    setBusy("paypal");
    setError(null);
    const res = await createPaypalTopup(n);
    if (!res.ok || !res.data.approveUrl) {
      setBusy(null);
      setError(mapPayError(res.ok ? "generic" : res.error, t, res.ok ? undefined : res.message));
      return;
    }
    const browser = await openPaypalCheckout(res.data.approveUrl);
    if (!browser.ok) {
      setBusy(null);
      if (!browser.cancelled) setError(mapPayError(browser.error, t));
      return;
    }
    await refreshUser();
    setBusy(null);
    if (browser.status === "ok") {
      onDone(
        browser.amount
          ? t("wallet.topup.credited", {
              amount: formatMoney(Number(browser.amount), browser.currency || currency, i18n.language),
            })
          : t("wallet.topup.success"),
      );
    } else {
      onDone(t("wallet.topup.paypalPending", { defaultValue: "Paiement reçu — solde en cours de crédit." }));
    }
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Press haptic="none" onPress={onClose} style={styles.sheetDim} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.head}>
              <Text style={[styles.title, { color: colors.foreground }]}>{t("wallet.topup.title")}</Text>
              <Press onPress={onClose} style={styles.close}>
                <X size={18} color={colors.foreground} />
              </Press>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, marginBottom: 10 }}>
              {t("wallet.topup.range", {
                min: formatMoney(limits.min, currency, i18n.language),
                max: formatMoney(limits.max, currency, i18n.language),
              })}
            </Text>
            <View style={styles.presets}>
              {presets.map((p) => {
                const on = String(p) === amount.trim();
                return (
                  <Press
                    key={p}
                    onPress={() => setAmount(String(p))}
                    style={[
                      styles.preset,
                      { borderColor: on ? GOLD : colors.border, backgroundColor: on ? "rgba(232,185,59,0.12)" : colors.card },
                    ]}
                  >
                    <Text style={{ fontWeight: "800", fontSize: 13, color: colors.foreground }}>
                      {formatMoney(p, currency, i18n.language)}
                    </Text>
                  </Press>
                );
              })}
            </View>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder={t("wallet.topup.other")}
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
              ]}
            />
            <View style={{ gap: 8, marginTop: 12 }}>
              <Press
                onPress={() => void topupCard()}
                disabled={!!busy}
                style={[styles.method, { borderColor: colors.border, backgroundColor: colors.card }]}
              >
                <CreditCard size={18} color={colors.foreground} />
                <Text style={{ flex: 1, fontWeight: "800", fontSize: 14, color: colors.foreground }}>
                  {t("pay.method.card")}
                </Text>
                {busy === "card" ? <ActivityIndicator color={GOLD} /> : null}
              </Press>
              <Press
                onPress={() => void topupPaypal()}
                disabled={!!busy}
                style={[styles.method, { borderColor: colors.border, backgroundColor: colors.card }]}
              >
                <Text style={{ fontSize: 16, fontWeight: "900", color: "#003087" }}>P</Text>
                <Text style={{ flex: 1, fontWeight: "800", fontSize: 14, color: colors.foreground }}>PayPal</Text>
                {busy === "paypal" ? <ActivityIndicator color={GOLD} /> : null}
              </Press>
            </View>
            {error ? (
              <View style={{ backgroundColor: "#FDE8E8", borderRadius: 12, padding: 10, marginTop: 10 }}>
                <Text style={{ color: "#9B1C1C", fontSize: 13, fontWeight: "600" }}>{error}</Text>
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
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
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  title: { fontSize: 18, fontWeight: "800" },
  close: { width: 36, height: 36, minWidth: 36, minHeight: 36 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preset: {
    minHeight: 40,
    minWidth: 0,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 46,
    fontSize: 14,
    fontWeight: "600",
  },
  method: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    minHeight: 56,
  },
});
