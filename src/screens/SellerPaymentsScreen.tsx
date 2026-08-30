import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
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
  formatConnectCountry,
  isValidBankHolder,
  isValidIban,
  isValidPaypalEmail,
  isValidPayoutPhone,
  loadPayoutSetup,
  maskIban,
  maskPaypalEmail,
  maskPayoutPhone,
  payoutMethodReady,
  payoutSetupMethodsForCurrency,
  savePayoutSetup,
  type PayoutSetup,
} from "../lib/payout-setup";
import {
  fetchConnectStatus,
  openConnectUrl,
  startConnectLoginLink,
  startConnectOnboarding,
  subscribeConnectReturn,
  type ConnectStatus,
} from "../lib/stripe-connect";
import {
  connectUiPhase,
  mapConnectOnboardError,
  type StripeBusinessType,
} from "../lib/connect-onboard-logic";
import { GOLD } from "../theme";

type EditKey = "paypal" | "wave" | "orange" | "bank";

export function SellerPaymentsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<EditKey | null>(null);
  const [editing, setEditing] = useState<EditKey | null>(null);
  const [status, setStatus] = useState<ConnectStatus>("none");
  const [connected, setConnected] = useState(false);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [connectCountry, setConnectCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<PayoutSetup>(emptyPayoutSetup());

  const currency = user?.walletCurrency ?? "EUR";
  const available = payoutSetupMethodsForCurrency(currency);
  const phase = connectUiPhase({ payoutsEnabled, connected, status });
  const stripeReady = phase === "ready";
  const locale = i18n.language?.startsWith("en") ? "en" : "fr";
  const countryLabel = formatConnectCountry(connectCountry || user?.country, locale);

  const refresh = useCallback(async () => {
    const [connect, stored] = await Promise.all([
      fetchConnectStatus(),
      user?.id ? loadPayoutSetup(user.id) : Promise.resolve(emptyPayoutSetup()),
    ]);
    setStatus(connect.status);
    setConnected(connect.connected);
    setPayoutsEnabled(connect.payoutsEnabled);
    setConnectCountry(connect.country);
    setError(
      connect.ok
        ? null
        : mapConnectOnboardError(connect.error, connect.message).text,
    );
    setSetup(stored);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return subscribeConnectReturn(() => {
      void refresh();
    });
  }, [refresh]);

  const onboard = async (businessType?: StripeBusinessType) => {
    if (!user?.handle?.trim()) {
      setError(t("sellerPayments.handleMissing"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await startConnectOnboarding(user?.country, businessType, currency);
    setBusy(false);
    if (res.url) {
      try {
        await openConnectUrl(res.url);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("sellerPayments.retryHint"));
      }
      return;
    }
    setError(res.error ?? t("sellerPayments.retryHint"));
  };

  const openDashboard = async () => {
    setBusy(true);
    setError(null);
    const res = await startConnectLoginLink();
    setBusy(false);
    if (res.url) {
      await openConnectUrl(res.url);
      return;
    }
    setError(res.error ?? t("sellerPayments.dashboardFail"));
  };

  const persist = async (key: EditKey, next: PayoutSetup) => {
    if (!user?.id) return;
    setSaving(key);
    setError(null);
    const res = await savePayoutSetup(user.id, next);
    setSaving(null);
    if (!res.ok) {
      setError(res.error || t("sellerPayments.saveFail"));
      return;
    }
    setSetup(next);
    setEditing(null);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("sellerPayments.title")} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>{t("sellerPayments.intro")}</Text>
        <Text style={[styles.currencyHint, { color: colors.mutedForeground }]}>
          {currency === "XOF" ? t("sellerPayments.xofHint") : t("sellerPayments.intlHint")}
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={GOLD} />
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t("sellerPayments.checking")}</Text>
          </View>
        ) : null}

        {available.includes("stripe_connect") ? (
          <MethodCard
            title={t("sellerPayments.stripeTitle")}
            ready={stripeReady}
            dimmed={!stripeReady}
          >
            {stripeReady ? (
              <>
                <Text style={styles.readyLine}>
                  {t("sellerPayments.stripeReady")}
                  {countryLabel ? ` · ${countryLabel}` : ""}
                </Text>
                <OutlineButton
                  label={busy ? t("common.loading") : t("sellerPayments.manage")}
                  onPress={() => void openDashboard()}
                  disabled={busy}
                />
              </>
            ) : phase === "choose" ? (
              <>
                <Text style={[styles.chooseTitle, { color: colors.foreground }]}>
                  {t("sellerPayments.chooseTitle")}
                </Text>
                <GoldButton
                  label={busy ? t("common.loading") : t("sellerPayments.chooseIndividual")}
                  onPress={() => void onboard("individual")}
                  disabled={busy}
                />
                <OutlineButton
                  label={t("sellerPayments.chooseCompany")}
                  onPress={() => void onboard("company")}
                  disabled={busy}
                />
                <Text style={[styles.methodHint, { color: colors.mutedForeground }]}>
                  {t("sellerPayments.chooseLocked")}
                </Text>
                {error ? <Text style={styles.inlineErr}>{error}</Text> : null}
              </>
            ) : (
              <>
                <Text style={[styles.methodHint, { color: colors.mutedForeground }]}>
                  {t("sellerPayments.needsInfo")}
                </Text>
                <GoldButton
                  label={busy ? t("common.loading") : t("sellerPayments.resumeStripe")}
                  onPress={() => void onboard()}
                  disabled={busy}
                />
              </>
            )}
          </MethodCard>
        ) : null}

        {available.includes("paypal") ? (
          <MethodCard title={t("sellerPayments.paypalTitle")} ready={payoutMethodReady("paypal", setup, stripeReady)}>
            {payoutMethodReady("paypal", setup, stripeReady) && editing !== "paypal" ? (
              <>
                <Text style={styles.readyLine}>
                  {t("sellerPayments.paypalReady", { email: maskPaypalEmail(setup.paypalEmail) })}
                </Text>
                <OutlineButton label={t("sellerPayments.edit")} onPress={() => setEditing("paypal")} />
              </>
            ) : (
              <>
                <Text style={[styles.methodHint, { color: colors.mutedForeground }]}>
                  {t("sellerPayments.paypalHint")}
                </Text>
                <FormField
                  required
                  label={t("payout.paypalEmail")}
                  value={setup.paypalEmail}
                  onChangeText={(paypalEmail) => setSetup((s) => ({ ...s, paypalEmail }))}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder={t("payout.paypalEmailPlaceholder")}
                />
                <GoldButton
                  label={saving === "paypal" ? t("common.loading") : t("sellerPayments.save")}
                  onPress={() => void persist("paypal", setup)}
                  disabled={!isValidPaypalEmail(setup.paypalEmail) || saving === "paypal"}
                />
              </>
            )}
          </MethodCard>
        ) : null}

        {available.includes("wave") ? (
          <MethodCard title={t("sellerPayments.waveTitle")} ready={payoutMethodReady("wave", setup, stripeReady)}>
            {payoutMethodReady("wave", setup, stripeReady) && editing !== "wave" ? (
              <>
                <Text style={styles.readyLine}>
                  {t("sellerPayments.waveReady", { phone: maskPayoutPhone(setup.wavePhone) })}
                </Text>
                <OutlineButton label={t("sellerPayments.edit")} onPress={() => setEditing("wave")} />
              </>
            ) : (
              <>
                <FormField
                  required
                  label={t("payout.phone")}
                  value={setup.wavePhone}
                  onChangeText={(wavePhone) => setSetup((s) => ({ ...s, wavePhone }))}
                  keyboardType="phone-pad"
                  placeholder={t("payout.phonePlaceholder")}
                />
                <GoldButton
                  label={saving === "wave" ? t("common.loading") : t("sellerPayments.save")}
                  onPress={() => void persist("wave", setup)}
                  disabled={!isValidPayoutPhone(setup.wavePhone) || saving === "wave"}
                />
              </>
            )}
          </MethodCard>
        ) : null}

        {available.includes("orange_money") ? (
          <MethodCard title={t("sellerPayments.orangeTitle")} ready={payoutMethodReady("orange_money", setup, stripeReady)}>
            {payoutMethodReady("orange_money", setup, stripeReady) && editing !== "orange" ? (
              <>
                <Text style={styles.readyLine}>
                  {t("sellerPayments.orangeReady", { phone: maskPayoutPhone(setup.orangeMoneyPhone) })}
                </Text>
                <OutlineButton label={t("sellerPayments.edit")} onPress={() => setEditing("orange")} />
              </>
            ) : (
              <>
                <FormField
                  required
                  label={t("payout.phone")}
                  value={setup.orangeMoneyPhone}
                  onChangeText={(orangeMoneyPhone) => setSetup((s) => ({ ...s, orangeMoneyPhone }))}
                  keyboardType="phone-pad"
                  placeholder={t("payout.phonePlaceholder")}
                />
                <GoldButton
                  label={saving === "orange" ? t("common.loading") : t("sellerPayments.save")}
                  onPress={() => void persist("orange", setup)}
                  disabled={!isValidPayoutPhone(setup.orangeMoneyPhone) || saving === "orange"}
                />
              </>
            )}
          </MethodCard>
        ) : null}

        {available.includes("bank_transfer") ? (
          <MethodCard title={t("sellerPayments.bankTitle")} ready={payoutMethodReady("bank_transfer", setup, stripeReady)}>
            {payoutMethodReady("bank_transfer", setup, stripeReady) && editing !== "bank" ? (
              <>
                <Text style={styles.readyLine}>
                  {t("sellerPayments.bankReady", {
                    iban: maskIban(setup.bankIban),
                    holder: setup.bankHolder,
                  })}
                </Text>
                <OutlineButton label={t("sellerPayments.edit")} onPress={() => setEditing("bank")} />
              </>
            ) : (
              <>
                <FormField
                  required
                  label="IBAN"
                  value={setup.bankIban}
                  onChangeText={(bankIban) => setSetup((s) => ({ ...s, bankIban }))}
                  autoCapitalize="characters"
                />
                <FormField
                  required
                  label={t("payout.holder")}
                  value={setup.bankHolder}
                  onChangeText={(bankHolder) => setSetup((s) => ({ ...s, bankHolder }))}
                />
                <GoldButton
                  label={saving === "bank" ? t("common.loading") : t("sellerPayments.save")}
                  onPress={() => void persist("bank", setup)}
                  disabled={
                    !isValidIban(setup.bankIban) || !isValidBankHolder(setup.bankHolder) || saving === "bank"
                  }
                />
              </>
            )}
          </MethodCard>
        ) : null}

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errTxt}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function MethodCard({
  title,
  ready,
  dimmed,
  children,
}: {
  title: string;
  ready: boolean;
  dimmed?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const faded = dimmed ?? !ready;
  return (
    <SurfaceCard style={faded ? { opacity: 0.72 } : undefined}>
      <View style={styles.methodHead}>
        <Text style={[styles.methodTitle, { color: colors.foreground }]}>{title}</Text>
        <View style={[styles.pill, { backgroundColor: ready ? "rgba(52,211,153,0.16)" : "rgba(148,163,184,0.18)" }]}>
          <Text style={[styles.pillText, { color: ready ? "#1B7A3A" : "#64748B" }]}>
            {ready ? t("sellerPayments.configured") : t("sellerPayments.notConfigured")}
          </Text>
        </View>
      </View>
      <View style={{ gap: 10 }}>{children}</View>
    </SurfaceCard>
  );
}

function OutlineButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      style={[styles.outlineBtn, { borderColor: colors.border }, disabled && { opacity: 0.55 }]}
    >
      <Text style={[styles.outlineText, { color: colors.foreground }]}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 14, paddingBottom: 48 },
  intro: { fontSize: 14, lineHeight: 20 },
  currencyHint: { fontSize: 12, lineHeight: 17, marginTop: -6 },
  center: { alignItems: "center", gap: 8, paddingVertical: 16 },
  hint: { fontSize: 13 },
  methodHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 },
  methodTitle: { fontSize: 15, fontWeight: "800", flex: 1 },
  methodHint: { fontSize: 12, lineHeight: 17 },
  chooseTitle: { fontSize: 16, fontWeight: "800", lineHeight: 22 },
  readyLine: { fontSize: 15, fontWeight: "700", color: "#1B7A3A", lineHeight: 21 },
  inlineErr: { color: "#9B1C1C", fontSize: 13, fontWeight: "600", lineHeight: 18 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: "800" },
  outlineBtn: {
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: { fontSize: 15, fontWeight: "800" },
  errBox: {
    backgroundColor: "#FDE8E8",
    borderRadius: 14,
    padding: 12,
  },
  errTxt: { color: "#9B1C1C", fontSize: 13, fontWeight: "600", lineHeight: 18 },
});
