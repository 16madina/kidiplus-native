import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  BadgeCheck,
  Banknote,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { GoldButton } from "../components/Buttons";
import { FormField } from "../components/FormField";
import { OverlayHeader } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import {
  emptyPayoutSetup,
  isValidIban,
  isValidPaypalEmail,
  isValidPayoutPhone,
  loadPayoutSetup,
  payoutMethodReady,
  savePayoutSetup,
  type PayoutSetup,
} from "../lib/payout-setup";
import { payoutMethodsForCurrency } from "../lib/payout-methods";
import {
  fetchConnectStatus,
  openConnectUrl,
  openConnectWebFallback,
  startConnectOnboarding,
  type ConnectStatus,
} from "../lib/stripe-connect";
import { GOLD, NAVY } from "../theme";

type SavedKey = "paypal" | "wave" | "orange" | "bank";

export function SellerPaymentsScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<SavedKey | null>(null);
  const [saved, setSaved] = useState<SavedKey | null>(null);
  const [status, setStatus] = useState<ConnectStatus>("none");
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<PayoutSetup>(emptyPayoutSetup());

  const currency = user?.walletCurrency ?? "EUR";
  const available = payoutMethodsForCurrency(currency);
  const stripeReady = status === "active";

  const refresh = useCallback(async () => {
    setLoading(true);
    const [connect, stored] = await Promise.all([
      fetchConnectStatus(),
      user?.id ? loadPayoutSetup(user.id) : Promise.resolve(emptyPayoutSetup()),
    ]);
    setStatus(connect.status);
    setError(connect.ok ? null : connect.message || connect.error || null);
    setSetup(stored);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onboard = async () => {
    setBusy(true);
    setError(null);
    const res = await startConnectOnboarding(user?.country);
    setBusy(false);
    if (res.url) {
      await openConnectUrl(res.url);
      void refresh();
      return;
    }
    setError(res.error ?? null);
  };

  const persist = async (key: SavedKey, next: PayoutSetup) => {
    if (!user?.id) return;
    setSaving(key);
    setSetup(next);
    await savePayoutSetup(user.id, next);
    setSaving(null);
    setSaved(key);
    setTimeout(() => setSaved((cur) => (cur === key ? null : cur)), 1800);
  };

  const badge =
    status === "active"
      ? { icon: <BadgeCheck size={18} color="#34d399" />, color: "#34d399", label: t("sellerPayments.statusActive") }
      : status === "restricted"
        ? { icon: <TriangleAlert size={18} color="#f59e0b" />, color: "#f59e0b", label: t("sellerPayments.statusRestricted") }
        : status === "pending"
          ? { icon: <ActivityIndicator size={14} color={GOLD} />, color: GOLD, label: t("sellerPayments.statusPending") }
          : { icon: <Banknote size={18} color={GOLD} />, color: GOLD, label: t("sellerPayments.statusNone") };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("sellerPayments.title")} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>{t("sellerPayments.intro")}</Text>
        <Text style={[styles.currencyHint, { color: colors.mutedForeground }]}>
          {currency === "XOF" ? t("sellerPayments.xofHint") : t("sellerPayments.intlHint")}
        </Text>

        <SurfaceCard>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={GOLD} />
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t("sellerPayments.checking")}</Text>
            </View>
          ) : (
            <View style={styles.statusRow}>
              {badge.icon}
              <Text style={[styles.statusLabel, { color: badge.color }]}>{badge.label}</Text>
            </View>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <View style={styles.stepsHeader}>
            <ShieldCheck size={16} color={GOLD} />
            <Text style={[styles.stepsTitle, { color: colors.foreground }]}>{t("sellerPayments.howTitle")}</Text>
          </View>
          {[t("sellerPayments.step1"), t("sellerPayments.step2"), t("sellerPayments.step3")].map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.foreground }]}>{s}</Text>
            </View>
          ))}
        </SurfaceCard>

        {available.includes("stripe_connect") ? (
          <MethodCard
            title={t("sellerPayments.stripeTitle")}
            hint={t("sellerPayments.stripeHint")}
            ready={stripeReady}
            readyLabel={t("sellerPayments.configured")}
            pendingLabel={t("sellerPayments.notConfigured")}
          >
            {status !== "active" ? (
              <Press onPress={() => void onboard()} style={styles.goldBtn}>
                {busy ? (
                  <ActivityIndicator size={16} color={NAVY} />
                ) : (
                  <Text style={styles.goldBtnText}>
                    {status === "none" ? t("sellerPayments.configureStripe") : t("sellerPayments.resumeStripe")}
                  </Text>
                )}
              </Press>
            ) : (
              <Press onPress={() => void onboard()} style={styles.goldBtn}>
                <ExternalLink size={16} color={NAVY} />
                <Text style={styles.goldBtnText}>{t("sellerPayments.openDashboard")}</Text>
              </Press>
            )}
            {error ? (
              <View style={styles.errBox}>
                <Text style={styles.errTxt}>{error}</Text>
                <Press onPress={() => void openConnectWebFallback()} style={styles.webBtn}>
                  <ExternalLink size={14} color={NAVY} />
                  <Text style={styles.goldBtnText}>{t("sellerPayments.webFallback")}</Text>
                </Press>
              </View>
            ) : null}
            <Press onPress={() => void refresh()} style={[styles.refreshBtn, { borderColor: colors.border }]}>
              <RefreshCw size={15} color={colors.mutedForeground} />
              <Text style={[styles.refreshText, { color: colors.mutedForeground }]}>{t("sellerPayments.refresh")}</Text>
            </Press>
          </MethodCard>
        ) : null}

        <MethodCard
          title={t("sellerPayments.paypalTitle")}
          hint={t("sellerPayments.paypalHint")}
          ready={payoutMethodReady("paypal", setup, stripeReady)}
          readyLabel={t("sellerPayments.configured")}
          pendingLabel={t("sellerPayments.notConfigured")}
        >
          <FormField
            required
            label={t("payout.paypalEmail")}
            value={setup.paypalEmail}
            onChangeText={(paypalEmail) => setSetup((s) => ({ ...s, paypalEmail }))}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t("payout.paypalEmailPlaceholder")}
          />
          <SaveRow
            busy={saving === "paypal"}
            justSaved={saved === "paypal"}
            disabled={!isValidPaypalEmail(setup.paypalEmail)}
            onPress={() => void persist("paypal", setup)}
          />
        </MethodCard>

        <MethodCard
          title={t("sellerPayments.waveTitle")}
          hint={t("sellerPayments.waveHint")}
          ready={payoutMethodReady("wave", setup, stripeReady)}
          readyLabel={t("sellerPayments.configured")}
          pendingLabel={t("sellerPayments.notConfigured")}
        >
          <FormField
            required
            label={t("payout.phone")}
            value={setup.wavePhone}
            onChangeText={(wavePhone) => setSetup((s) => ({ ...s, wavePhone }))}
            keyboardType="phone-pad"
            placeholder={t("payout.phonePlaceholder")}
          />
          <FormField
            label={t("payout.holder")}
            value={setup.waveHolder}
            onChangeText={(waveHolder) => setSetup((s) => ({ ...s, waveHolder }))}
          />
          <SaveRow
            busy={saving === "wave"}
            justSaved={saved === "wave"}
            disabled={!isValidPayoutPhone(setup.wavePhone)}
            onPress={() => void persist("wave", setup)}
          />
        </MethodCard>

        <MethodCard
          title={t("sellerPayments.orangeTitle")}
          hint={t("sellerPayments.orangeHint")}
          ready={payoutMethodReady("orange_money", setup, stripeReady)}
          readyLabel={t("sellerPayments.configured")}
          pendingLabel={t("sellerPayments.notConfigured")}
        >
          <FormField
            required
            label={t("payout.phone")}
            value={setup.orangeMoneyPhone}
            onChangeText={(orangeMoneyPhone) => setSetup((s) => ({ ...s, orangeMoneyPhone }))}
            keyboardType="phone-pad"
            placeholder={t("payout.phonePlaceholder")}
          />
          <FormField
            label={t("payout.holder")}
            value={setup.orangeMoneyHolder}
            onChangeText={(orangeMoneyHolder) => setSetup((s) => ({ ...s, orangeMoneyHolder }))}
          />
          <SaveRow
            busy={saving === "orange"}
            justSaved={saved === "orange"}
            disabled={!isValidPayoutPhone(setup.orangeMoneyPhone)}
            onPress={() => void persist("orange", setup)}
          />
        </MethodCard>

        <MethodCard
          title={t("sellerPayments.bankTitle")}
          hint={t("sellerPayments.bankHint")}
          ready={payoutMethodReady("bank_transfer", setup, stripeReady)}
          readyLabel={t("sellerPayments.configured")}
          pendingLabel={t("sellerPayments.notConfigured")}
        >
          <FormField
            required
            label="IBAN"
            value={setup.bankIban}
            onChangeText={(bankIban) => setSetup((s) => ({ ...s, bankIban }))}
            autoCapitalize="characters"
          />
          <FormField
            label={t("payout.holder")}
            value={setup.bankHolder}
            onChangeText={(bankHolder) => setSetup((s) => ({ ...s, bankHolder }))}
          />
          <SaveRow
            busy={saving === "bank"}
            justSaved={saved === "bank"}
            disabled={!isValidIban(setup.bankIban)}
            onPress={() => void persist("bank", setup)}
          />
        </MethodCard>
      </ScrollView>
    </View>
  );
}

function MethodCard({
  title,
  hint,
  ready,
  readyLabel,
  pendingLabel,
  children,
}: {
  title: string;
  hint: string;
  ready: boolean;
  readyLabel: string;
  pendingLabel: string;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <SurfaceCard>
      <View style={styles.methodHead}>
        <Text style={[styles.methodTitle, { color: colors.foreground }]}>{title}</Text>
        <View style={[styles.pill, { backgroundColor: ready ? "rgba(52,211,153,0.16)" : "rgba(232,185,59,0.16)" }]}>
          <Text style={[styles.pillText, { color: ready ? "#1B7A3A" : "#8A6A12" }]}>
            {ready ? readyLabel : pendingLabel}
          </Text>
        </View>
      </View>
      <Text style={[styles.methodHint, { color: colors.mutedForeground }]}>{hint}</Text>
      <View style={{ gap: 10 }}>{children}</View>
    </SurfaceCard>
  );
}

function SaveRow({
  busy,
  justSaved,
  disabled,
  onPress,
}: {
  busy: boolean;
  justSaved: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <GoldButton
      label={busy ? t("common.loading") : justSaved ? t("sellerPayments.saved") : t("sellerPayments.save")}
      onPress={onPress}
      disabled={disabled || busy}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 14, paddingBottom: 48 },
  intro: { fontSize: 14, lineHeight: 20 },
  currencyHint: { fontSize: 12, lineHeight: 17, marginTop: -6 },
  center: { alignItems: "center", gap: 8, paddingVertical: 12 },
  hint: { fontSize: 13 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  statusLabel: { fontSize: 15, fontWeight: "700" },
  stepsHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  stepsTitle: { fontSize: 14, fontWeight: "700" },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(232,185,59,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { fontSize: 11, fontWeight: "800", color: GOLD },
  stepText: { flex: 1, fontSize: 13, lineHeight: 18 },
  methodHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 },
  methodTitle: { fontSize: 15, fontWeight: "800", flex: 1 },
  methodHint: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: "800" },
  goldBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: GOLD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  goldBtnText: { color: NAVY, fontSize: 15, fontWeight: "800" },
  errBox: {
    backgroundColor: "#FDE8E8",
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  errTxt: { color: "#9B1C1C", fontSize: 13, fontWeight: "600", lineHeight: 18 },
  webBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: GOLD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  refreshBtn: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  refreshText: { fontSize: 14, fontWeight: "600" },
});
