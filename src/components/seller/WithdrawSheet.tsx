import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { GoldButton } from "../Buttons";
import { FormField } from "../FormField";
import { Press } from "../Press";
import { useAppTheme } from "../../context/theme";
import { formatMoney } from "../../lib/money";
import { payoutMinimumFor } from "../../lib/fees";
import {
  requestPayout,
  type PayoutMethod,
  type PayoutSource,
} from "../../lib/earnings";
import { dispatchConnectPayout } from "../../lib/stripe-connect";
import { defaultPayoutMethod, payoutMethodsForCurrency } from "../../lib/payout-methods";
import { NAVY } from "../../theme";

export function WithdrawSheet({
  open,
  onClose,
  available,
  currency,
  source = "seller",
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  available: number;
  currency: string;
  source?: PayoutSource;
  onDone: (msg: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [method, setMethod] = useState<PayoutMethod>("paypal");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [holder, setHolder] = useState("");
  const [email, setEmail] = useState("");
  const [iban, setIban] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const methods = payoutMethodsForCurrency(currency);
  const min = payoutMinimumFor(currency);

  useEffect(() => {
    if (open) {
      setAmount(String(available || ""));
      setError(null);
      setMethod(defaultPayoutMethod(currency));
    }
  }, [open, available, currency]);

  const mobile = method === "wave" || method === "orange_money";
  const connect = method === "stripe_connect";

  const submit = async () => {
    setError(null);
    const n = Number(String(amount).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setError(t("payout.errors.generic"));
      return;
    }
    if (n > available) {
      setError(t("payout.errors.aboveAvailable"));
      return;
    }
    if (n < min) {
      setError(t("payout.errors.belowMin", { min: formatMoney(min, currency, i18n.language) }));
      return;
    }
    const destination: Record<string, string> = {};
    if (mobile) {
      if (!phone.trim()) {
        setError(t("payout.errors.missingDestination"));
        return;
      }
      destination.phone = phone.trim();
      if (holder.trim()) destination.holder = holder.trim();
    } else if (method === "paypal") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError(t("payout.errors.invalidEmail"));
        return;
      }
      destination.paypalEmail = email.trim();
    } else if (method === "stripe_connect") {
      // Stripe Connect destination is resolved server-side from the seller account.
    } else {
      if (!iban.trim()) {
        setError(t("payout.errors.missingDestination"));
        return;
      }
      destination.iban = iban.trim();
      if (holder.trim()) destination.holder = holder.trim();
    }
    setBusy(true);
    const res = await requestPayout(n, method, destination, source);
    if (!res.ok) {
      setBusy(false);
      if (res.min != null) {
        setError(t("payout.errors.belowMin", { min: formatMoney(res.min, currency, i18n.language) }));
      } else {
        setError(res.error || t("payout.errors.generic"));
      }
      return;
    }
    // Stripe Connect: automatic Transfer — KYC already done by Stripe.
    // PayPal / Wave / Orange / IBAN: request only. Admin reviews anti-fraud
    // signals then sends (PayPal via POST /api/paypal-payout). Never auto-send PayPal.
    if (method === "stripe_connect") {
      const sent = await dispatchConnectPayout(res.payoutId);
      setBusy(false);
      if (!sent.ok) {
        onDone(
          t("payout.connectQueued", {
            defaultValue:
              "Demande enregistrée. Le virement Stripe n'est pas parti tout de suite — notre système le retraitera.",
          }),
        );
        return;
      }
      onDone(
        t("payout.connectSent", {
          defaultValue: "Virement Stripe envoyé vers ton compte bancaire.",
        }),
      );
      return;
    }
    setBusy(false);
    onDone(`${t("payout.successTitle")} ${t("payout.successBody")}`);
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Press haptic="none" onPress={onClose} style={styles.sheetDim} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHead}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{t("payout.title")}</Text>
              <Press onPress={onClose} style={styles.sheetClose}>
                <X size={18} color={colors.foreground} />
              </Press>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, marginBottom: 10 }}>
              {t("payout.available")} : {formatMoney(available, currency, i18n.language)}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 12 }}>
              <View>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>{t("payout.method.label")}</Text>
                <View style={styles.methods}>
                  {methods.map((m) => {
                    const on = method === m;
                    return (
                      <Press
                        key={m}
                        onPress={() => setMethod(m)}
                        style={[
                          styles.methodPill,
                          { borderColor: on ? NAVY : colors.border, backgroundColor: on ? NAVY : colors.card },
                        ]}
                      >
                        <Text style={{ color: on ? "#fff" : colors.foreground, fontWeight: "700", fontSize: 12 }}>
                          {t(`payout.method.${m}`)}
                        </Text>
                      </Press>
                    );
                  })}
                </View>
              </View>
              <FormField
                required
                label={t("payout.amount")}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              {mobile ? (
                <>
                  <FormField
                    required
                    label={t("payout.phone")}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder={t("payout.phonePlaceholder")}
                  />
                  <FormField label={t("payout.holder")} value={holder} onChangeText={setHolder} />
                </>
              ) : method === "paypal" ? (
                <>
                  <FormField
                    required
                    label={t("payout.paypalEmail")}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder={t("payout.paypalEmailPlaceholder")}
                  />
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 17 }}>
                    {t("payout.paypalReviewHint")}
                  </Text>
                </>
              ) : connect ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 18 }}>
                  {t("payout.stripeConnectHint", {
                    defaultValue:
                      "Le virement part vers ton compte bancaire Stripe Connect (Europe / Amérique / UK).",
                  })}
                </Text>
              ) : (
                <>
                  <FormField required label="IBAN" value={iban} onChangeText={setIban} autoCapitalize="characters" />
                  <FormField label={t("payout.holder")} value={holder} onChangeText={setHolder} />
                </>
              )}
              {error ? (
                <View style={{ backgroundColor: "#FDE8E8", borderRadius: 12, padding: 10 }}>
                  <Text style={{ color: "#9B1C1C", fontSize: 13, fontWeight: "600" }}>{error}</Text>
                </View>
              ) : null}
              <GoldButton
                label={busy ? t("common.loading") : t("payout.submit")}
                onPress={() => void submit()}
                disabled={busy}
              />
            </ScrollView>
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
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontWeight: "800" },
  sheetClose: { width: 36, height: 36, minWidth: 36, minHeight: 36 },
  label: { marginBottom: 6, fontSize: 12, fontWeight: "600" },
  methods: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  methodPill: {
    minHeight: 36,
    minWidth: 0,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
});
