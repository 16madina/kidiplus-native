import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { BrandBadge } from "../BrandBadge";
import { useAuth } from "../../context/auth";
import { useAppTheme } from "../../context/theme";
import { formatMoney, normalizeCurrency, topUpPresets } from "../../lib/money";
import { mapPayError } from "../../lib/pay-errors";
import {
  capturePaypalTopup,
  confirmWalletTopup,
  createPaypalTopup,
  createWalletTopup,
  openPaypalCheckout,
  paypalAuthSessionAvailable,
} from "../../lib/payments";
import {
  parseTopUpAmount,
  paypalDebitEurFromXof,
  topUpLimits,
  topUpPayMethodsForCurrency,
  type TopUpPayMethod,
} from "../../lib/topup-logic";
import { presentStripePayment, stripeAvailable } from "../../lib/stripe-native";
import { GOLD } from "../../theme";

const REBUILD_HINT = "npm install && npx expo run:ios --device";

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
  const [busy, setBusy] = useState<null | TopUpPayMethod>(null);
  const [error, setError] = useState<string | null>(null);

  const currency = normalizeCurrency(user?.walletCurrency);
  const balance = user?.walletBalance ?? 0;
  const limits = topUpLimits(currency);
  const presets = topUpPresets(currency);
  const methods = topUpPayMethodsForCurrency(currency);
  const xof = currency === "XOF";

  useEffect(() => {
    if (open) {
      setAmount(initialAmount ? String(initialAmount) : "");
      setError(null);
      setBusy(null);
    }
  }, [open, initialAmount]);

  const parseAmount = (): number | null => {
    const parsed = parseTopUpAmount(amount, currency);
    if (parsed.ok) return parsed.amount;
    if (parsed.reason === "range") {
      setError(
        t("wallet.topup.range", {
          min: formatMoney(parsed.min, currency, i18n.language),
          max: formatMoney(parsed.max, currency, i18n.language),
        }),
      );
      return null;
    }
    setError(t("pay.errors.invalidAmount"));
    return null;
  };

  const topupCard = async (method: TopUpPayMethod = "card") => {
    if (busy) return;
    const n = parseAmount();
    if (n == null) return;
    if (!stripeAvailable()) {
      const msg = t("pay.rebuildForCard");
      setError(msg);
      Alert.alert(t("pay.rebuildTitle"), `${msg}\n\n${REBUILD_HINT}`);
      return;
    }
    setBusy(method);
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
      if (!sheet.cancelled) {
        setError(
          sheet.error === "stripe_module_missing"
            ? mapPayError("stripe_module_missing", t)
            : mapPayError(sheet.error, t, sheet.error),
        );
      }
      return;
    }
    const piId = intent.data.clientSecret.split("_secret")[0] ?? "";
    const conf = await confirmWalletTopup(piId);
    if (!conf.ok) {
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
    if (!paypalAuthSessionAvailable()) {
      const go = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "PayPal",
          t("pay.paypalMerchantHint"),
          [
            { text: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
            { text: t("common.continue"), onPress: () => resolve(true) },
          ],
        );
      });
      if (!go) return;
    }
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
    const paypalOrderId = res.data.paypalOrderId || browser.orderId;
    if (paypalOrderId) {
      await capturePaypalTopup(paypalOrderId);
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
      onDone(t("wallet.topup.paypalPending"));
    }
  };

  const chosen = Number(String(amount).replace(",", ".")) || 0;
  const paypalSub = xof
    ? t("wallet.topup.paypalXofSub", {
        eur: formatMoney(paypalDebitEurFromXof(Math.max(chosen, limits.min)), "EUR", i18n.language),
      })
    : t("pay.method.paypalSub");

  const methodCopy: Record<
    TopUpPayMethod,
    { brand: "card" | "paypal" | "wave" | "orange" | "djamo"; label: string; subtitle: string }
  > = {
    card: {
      brand: "card",
      label: t("pay.method.card"),
      subtitle: t("pay.method.cardSub"),
    },
    paypal: { brand: "paypal", label: "PayPal", subtitle: paypalSub },
    wave_visa: {
      brand: "wave",
      label: t("pay.method.waveVisa"),
      subtitle: t("pay.method.waveVisaSub"),
    },
    orange_visa: {
      brand: "orange",
      label: t("pay.method.orangeVisa"),
      subtitle: t("pay.method.orangeVisaSub"),
    },
    djamo: {
      brand: "djamo",
      label: t("pay.method.djamo"),
      subtitle: t("pay.method.djamoSub"),
    },
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
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 10 }}>
              <View style={[styles.balanceBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text style={[styles.balanceLbl, { color: colors.mutedForeground }]}>
                  {t("wallet.currentBalance")}
                </Text>
                <Text style={[styles.balanceVal, { color: colors.foreground }]}>
                  {formatMoney(balance, currency, i18n.language)}
                </Text>
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
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
                        {
                          borderColor: on ? GOLD : colors.border,
                          backgroundColor: on ? "rgba(232,185,59,0.12)" : colors.card,
                        },
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
              <Text style={[styles.methodTitle, { color: colors.mutedForeground }]}>{t("pay.method.title")}</Text>
              <View style={{ gap: 8 }}>
                {methods.map((m) => {
                  const copy = methodCopy[m];
                  return (
                    <MethodRow
                      key={m}
                      icon={<BrandBadge brand={copy.brand} size={28} />}
                      label={copy.label}
                      subtitle={copy.subtitle}
                      busy={busy === m}
                      disabled={!!busy}
                      border={colors.border}
                      bg={colors.card}
                      fg={colors.foreground}
                      onPress={() => void (m === "paypal" ? topupPaypal() : topupCard(m))}
                    />
                  );
                })}
              </View>
              {error ? (
                <View style={{ backgroundColor: "#FDE8E8", borderRadius: 12, padding: 10 }}>
                  <Text style={{ color: "#9B1C1C", fontSize: 13, fontWeight: "600" }}>{error}</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function MethodRow({
  icon,
  label,
  subtitle,
  busy,
  disabled,
  border,
  bg,
  fg,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  busy?: boolean;
  disabled?: boolean;
  border: string;
  bg: string;
  fg: string;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      style={[styles.method, { borderColor: border, backgroundColor: bg, opacity: disabled && !busy ? 0.6 : 1 }]}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "800", fontSize: 14, color: fg }}>{label}</Text>
        <Text style={{ color: "#888", fontSize: 11.5, marginTop: 1 }}>{subtitle}</Text>
      </View>
      {busy ? <ActivityIndicator color={GOLD} /> : null}
    </Press>
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
  balanceBox: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  balanceLbl: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  balanceVal: { fontSize: 22, fontWeight: "900", marginTop: 2 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preset: {
    minHeight: 40,
    minWidth: 0,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 46,
    fontSize: 14,
    fontWeight: "600",
  },
  methodTitle: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
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
