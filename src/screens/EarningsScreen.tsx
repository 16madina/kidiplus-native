import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { GoldButton } from "../components/Buttons";
import { FormField } from "../components/FormField";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { formatMoney, normalizeCurrency } from "../lib/money";
import {
  fetchMyBalance,
  fetchMyPayouts,
  requestPayout,
  type PayoutMethod,
  type PayoutRow,
  type SellerBalance,
} from "../lib/earnings";
import { defaultPayoutMethod, payoutMethodsForCurrency } from "../lib/payout-methods";
import { GOLD, NAVY } from "../theme";

const STATUS_COLOR: Record<string, string> = {
  requested: "#B45309",
  processing: "#2E6BFF",
  paid: "#1B7A3A",
  rejected: "#C0392B",
};

export function EarningsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [balance, setBalance] = useState<SellerBalance | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const reload = useCallback(async () => {
    const id = user?.id;
    if (!id) return;
    const [b, p] = await Promise.all([fetchMyBalance(id), fetchMyPayouts(id)]);
    setBalance(b);
    setPayouts(p);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const currency = normalizeCurrency(balance?.currency ?? user?.walletCurrency);
  const fmt = (n: number) => formatMoney(n, currency, i18n.language);
  const available = Number(balance?.available ?? 0);
  const pending = Number(balance?.pending ?? 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("gains.title")} />
      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} />
        ) : (
          <>
            <View style={styles.row2}>
              <SurfaceCard style={{ flex: 1, borderColor: GOLD, backgroundColor: "rgba(232,185,59,0.08)" }}>
                <Text style={styles.k}>{t("gains.available")}</Text>
                <Text style={[styles.v, { color: colors.foreground }]}>{fmt(available)}</Text>
              </SurfaceCard>
              <SurfaceCard style={{ flex: 1 }}>
                <Text style={[styles.k, { color: colors.mutedForeground }]}>{t("gains.pending")}</Text>
                <Text style={[styles.v, { color: colors.foreground }]}>{fmt(pending)}</Text>
              </SurfaceCard>
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 18 }}>
              {t("gains.escrowExplainer")}
            </Text>
            <GoldButton
              label={t("gains.withdraw")}
              onPress={() => {
                if (available <= 0) {
                  flash(t("payout.errors.insufficient"));
                  return;
                }
                setWithdrawOpen(true);
              }}
            />
            <Text style={[styles.section, { color: colors.mutedForeground }]}>
              {t("gains.tabs.payouts").toUpperCase()}
            </Text>
            {payouts.length === 0 ? (
              <Text style={{ color: colors.mutedForeground }}>{t("payout.emptyHistory")}</Text>
            ) : (
              payouts.map((p) => (
                <SurfaceCard key={p.id}>
                  <View style={styles.line}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "700", color: colors.foreground }}>
                        {t(`payout.method.${p.method}`, { defaultValue: p.method })}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                        {new Date(p.requested_at).toLocaleDateString(i18n.language)}
                      </Text>
                      {p.status === "rejected" && p.admin_note ? (
                        <Text style={{ color: "#C0392B", fontSize: 12, marginTop: 2 }}>
                          {t("payout.rejectionReason")} : {p.admin_note}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontWeight: "800", color: colors.foreground }}>
                        {formatMoney(p.amount, p.currency, i18n.language)}
                      </Text>
                      <Text
                        style={{
                          color: STATUS_COLOR[p.status] ?? colors.mutedForeground,
                          fontSize: 11,
                          fontWeight: "700",
                          marginTop: 2,
                        }}
                      >
                        {t(`payout.status.${p.status}`, { defaultValue: p.status })}
                      </Text>
                    </View>
                  </View>
                </SurfaceCard>
              ))
            )}
          </>
        )}
      </ScrollView>
      <WithdrawSheet
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        available={available}
        currency={currency}
        onDone={(msg) => {
          setWithdrawOpen(false);
          flash(msg);
          void reload();
        }}
      />
      <MockBanner text={toast} />
    </View>
  );
}

function WithdrawSheet({
  open,
  onClose,
  available,
  currency,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  available: number;
  currency: string;
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
      destination.email = email.trim();
    } else if (method === "stripe_connect") {
      // Stripe Connect destination is resolved server-side from the seller account.
      destination.note = "stripe_connect";
    } else {
      if (!iban.trim()) {
        setError(t("payout.errors.missingDestination"));
        return;
      }
      destination.iban = iban.trim();
      if (holder.trim()) destination.holder = holder.trim();
    }
    setBusy(true);
    const res = await requestPayout(n, method, destination, "seller");
    setBusy(false);
    if (!res.ok) {
      if (res.min != null) {
        setError(t("payout.errors.belowMin", { min: formatMoney(res.min, currency, i18n.language) }));
      } else {
        setError(res.error || t("payout.errors.generic"));
      }
      return;
    }
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
                <FormField
                  required
                  label={t("payout.paypalEmail")}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder={t("payout.paypalEmailPlaceholder")}
                />
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
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 10 },
  row2: { flexDirection: "row", gap: 10 },
  k: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase", color: GOLD },
  v: { fontSize: 22, fontWeight: "900", marginTop: 6 },
  section: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, marginTop: 10 },
  line: { flexDirection: "row", alignItems: "center", gap: 10 },
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
