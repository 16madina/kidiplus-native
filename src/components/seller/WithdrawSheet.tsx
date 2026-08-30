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
import { useAuth } from "../../context/auth";
import { useAppTheme } from "../../context/theme";
import { formatMoney } from "../../lib/money";
import { payoutMinimumFor } from "../../lib/fees";
import {
  requestPayout,
  type PayoutMethod,
  type PayoutSource,
} from "../../lib/earnings";
import { dispatchConnectPayout, fetchConnectStatus } from "../../lib/stripe-connect";
import { defaultPayoutMethod, payoutMethodsForCurrency } from "../../lib/payout-methods";
import {
  applyDestinationToSetup,
  destinationFromSetup,
  emptyPayoutSetup,
  firstReadyPayoutMethod,
  isStripePayoutReady,
  payoutErrorI18nKey,
  isValidBankHolder,
  isValidIban,
  isValidPayoutPhone,
  loadPayoutSetup,
  payoutMethodReady,
  savePayoutSetup,
  type PayoutSetup,
} from "../../lib/payout-setup";
import { NAVY } from "../../theme";

export function WithdrawSheet({
  open,
  onClose,
  available,
  currency,
  source = "seller",
  onDone,
  onConfigure,
}: {
  open: boolean;
  onClose: () => void;
  available: number;
  currency: string;
  source?: PayoutSource;
  onDone: (msg: string) => void;
  onConfigure?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [method, setMethod] = useState<PayoutMethod>("paypal");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [holder, setHolder] = useState("");
  const [email, setEmail] = useState("");
  const [iban, setIban] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<PayoutSetup>(emptyPayoutSetup());
  const [stripeReady, setStripeReady] = useState(false);

  const methods = payoutMethodsForCurrency(currency);
  const min = payoutMinimumFor(currency);
  const ready = payoutMethodReady(method, setup, stripeReady);

  const applyFields = (next: PayoutSetup, nextMethod: PayoutMethod) => {
    if (nextMethod === "wave") {
      setPhone(next.wavePhone);
      setHolder(next.waveHolder);
    } else if (nextMethod === "orange_money") {
      setPhone(next.orangeMoneyPhone);
      setHolder(next.orangeMoneyHolder);
    } else if (nextMethod === "paypal") {
      setEmail(next.paypalEmail);
    } else if (nextMethod === "bank_transfer") {
      setIban(next.bankIban);
      setHolder(next.bankHolder);
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setAmount(String(available || ""));
    setError(null);
    void (async () => {
      const [stored, connect] = await Promise.all([
        user?.id ? loadPayoutSetup(user.id) : Promise.resolve(emptyPayoutSetup()),
        fetchConnectStatus(),
      ]);
      if (cancelled) return;
      const stripe = isStripePayoutReady(connect.status, connect.livemode, connect.payoutsEnabled);
      setSetup(stored);
      setStripeReady(stripe);
      const first = firstReadyPayoutMethod(methods, stored, stripe) ?? defaultPayoutMethod(currency);
      setMethod(first);
      applyFields(stored, first);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, available, currency, user?.id]);

  const pickMethod = (next: PayoutMethod) => {
    setMethod(next);
    setError(null);
    applyFields(setup, next);
  };

  const goConfigure = () => {
    onClose();
    onConfigure?.();
  };

  const mobile = method === "wave" || method === "orange_money";
  const connect = method === "stripe_connect";

  const submit = async () => {
    setError(null);
    if (!ready) {
      goConfigure();
      return;
    }
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
    const destination: Record<string, string> = connect
      ? {}
      : {
          ...destinationFromSetup(
            method,
            applyDestinationToSetup(setup, method, {
              phone,
              holder,
              paypalEmail: email,
              iban,
            }),
          ),
        };
    if (mobile) {
      if (!isValidPayoutPhone(phone)) {
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
    } else if (!connect) {
      if (!isValidIban(iban) || !isValidBankHolder(holder)) {
        setError(t("payout.errors.missingDestination"));
        return;
      }
      destination.iban = iban.trim();
      destination.holder = holder.trim();
    }
    setBusy(true);
    if (user?.id && !connect) {
      const next = applyDestinationToSetup(setup, method, {
        phone,
        holder,
        paypalEmail: email,
        iban,
      });
      setSetup(next);
      void savePayoutSetup(user.id, next);
    }
    const res = await requestPayout(n, method, destination, source);
    if (!res.ok) {
      setBusy(false);
      if (res.min != null) {
        setError(t("payout.errors.belowMin", { min: formatMoney(res.min, currency, i18n.language) }));
      } else {
        setError(t(payoutErrorI18nKey(res.error)));
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
        onDone(sent.refunded ? t("payout.connectRefunded") : t("payout.connectQueued"));
        return;
      }
      onDone(t("payout.connectSent"));
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
                    const configured = payoutMethodReady(m, setup, stripeReady);
                    return (
                      <Press
                        key={m}
                        onPress={() => pickMethod(m)}
                        style={[
                          styles.methodPill,
                          {
                            borderColor: on ? NAVY : colors.border,
                            backgroundColor: on ? NAVY : colors.card,
                            opacity: configured ? 1 : 0.72,
                          },
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
              {!ready ? (
                <View style={[styles.needBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>
                    {t("payout.methodNotReady")}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 17 }}>
                    {t("payout.configureMethodHint")}
                  </Text>
                </View>
              ) : mobile ? (
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
                  {t("payout.stripeConnectHint")}
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
                label={
                  busy
                    ? t("common.loading")
                    : ready
                      ? t("payout.submit")
                      : t("payout.configureMethod")
                }
                onPress={() => void (ready ? submit() : goConfigure())}
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
  needBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
});
