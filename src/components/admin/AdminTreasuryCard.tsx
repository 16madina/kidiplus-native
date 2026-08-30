import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react-native";
import { GoldButton } from "../Buttons";
import { Press } from "../Press";
import { SurfaceCard } from "../SurfaceCard";
import { useAppTheme } from "../../context/theme";
import {
  fetchAdminTreasury,
  payoutAdminCommission,
  treasuryErrorKey,
  type TreasurySnapshot,
} from "../../lib/admin-stripe-treasury";
import { amountOf, currenciesOf, platformPayoutMinimum } from "../../lib/admin-treasury-logic";
import { formatMoney } from "../../lib/money";
import { GOLD } from "../../theme";

const POLL_MS = 20_000;

export function AdminTreasuryCard() {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const [snap, setSnap] = useState<TreasurySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const next = await fetchAdminTreasury();
    setSnap(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const currencies = snap
    ? currenciesOf(snap.stripeTotal, snap.owedSellers, snap.walletFloat, snap.commission)
    : [];
  const displayCurrencies = currencies.length ? currencies : ["CAD"];

  const confirmPayout = (currency: string, amount: number) => {
    Alert.alert(
      t("admin.treasury.payoutConfirmTitle"),
      t("admin.treasury.payoutConfirm", {
        amount: formatMoney(amount, currency, i18n.language),
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.treasury.payout"),
          onPress: () => {
            void (async () => {
              setBusy(true);
              const res = await payoutAdminCommission(currency, amount);
              setBusy(false);
              if (res.ok) {
                setSnap(res);
                Alert.alert(
                  t("admin.treasury.payoutOk"),
                  formatMoney(res.paid ?? amount, res.currency ?? currency, i18n.language),
                );
              } else {
                Alert.alert(t("admin.treasury.payoutFail"), t(treasuryErrorKey(res.error)));
              }
            })();
          },
        },
      ],
    );
  };

  const updated = snap?.generatedAt
    ? new Date(snap.generatedAt).toLocaleTimeString(i18n.language, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

  return (
    <View>
      <View style={styles.head}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: colors.mutedForeground,
          }}
        >
          {t("admin.treasury.title")}
        </Text>
        <View style={styles.headRight}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTxt}>{t("admin.treasury.live")}</Text>
          </View>
          <Press onPress={() => void load()} style={styles.refresh} disabled={loading || busy}>
            <RefreshCw size={14} color={colors.foreground} />
          </Press>
        </View>
      </View>
      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>
        {t("admin.treasury.hint")}
      </Text>
      {loading && !snap ? <ActivityIndicator color={GOLD} /> : null}
      {snap && !snap.ok ? (
        <SurfaceCard>
          <Text style={{ color: "#C62828", fontWeight: "700" }}>{t(treasuryErrorKey(snap.error))}</Text>
        </SurfaceCard>
      ) : null}
      {snap?.ok
        ? displayCurrencies.map((cur) => {
            const total = amountOf(snap.stripeTotal, cur);
            const available = amountOf(snap.stripeAvailable, cur);
            const pending = amountOf(snap.stripePending, cur);
            const owed = amountOf(snap.owedSellers, cur);
            const wallets = amountOf(snap.walletFloat, cur);
            const commission = amountOf(snap.commission, cur);
            const payoutable = amountOf(snap.payoutable, cur);
            const min = platformPayoutMinimum(cur);
            const canPay = payoutable >= min && !busy;
            return (
              <SurfaceCard key={cur} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.mutedForeground }}>
                  {cur}
                  {snap.livemode ? "" : ` · ${t("admin.treasury.testMode")}`}
                </Text>
                <Row
                  label={t("admin.treasury.stripeTotal")}
                  value={formatMoney(total, cur, i18n.language)}
                  big
                />
                <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                  {t("admin.treasury.stripeSplit", {
                    available: formatMoney(available, cur, i18n.language),
                    pending: formatMoney(pending, cur, i18n.language),
                  })}
                </Text>
                <Row label={t("admin.treasury.owed")} value={formatMoney(owed, cur, i18n.language)} />
                {wallets > 0 ? (
                  <Row
                    label={t("admin.treasury.wallets")}
                    value={formatMoney(wallets, cur, i18n.language)}
                  />
                ) : null}
                <Row
                  label={t("admin.treasury.commission")}
                  value={formatMoney(commission, cur, i18n.language)}
                  accent={commission > 0 ? "#0F7B4A" : commission < 0 ? "#C62828" : undefined}
                />
                <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 8 }}>
                  {t("admin.treasury.commissionHint")}
                </Text>
                {commission < 0 ? (
                  <Text style={{ color: "#C62828", fontSize: 11, marginTop: 6, fontWeight: "600" }}>
                    {t("admin.treasury.negative")}
                  </Text>
                ) : null}
                <View style={{ marginTop: 12 }}>
                  <GoldButton
                    label={
                      busy
                        ? t("admin.treasury.sending")
                        : `${t("admin.treasury.payout")} · ${formatMoney(payoutable, cur, i18n.language)}`
                    }
                    disabled={!canPay}
                    onPress={() => confirmPayout(cur, payoutable)}
                  />
                </View>
                {payoutable < min ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 8 }}>
                    {t("admin.treasury.payoutNone")}
                  </Text>
                ) : null}
              </SurfaceCard>
            );
          })
        : null}
      {updated ? (
        <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 2 }}>
          {t("admin.treasury.updated", { time: updated })}
        </Text>
      ) : null}
    </View>
  );
}

function Row({
  label,
  value,
  big,
  accent,
}: {
  label: string;
  value: string;
  big?: boolean;
  accent?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <Text style={{ color: colors.mutedForeground, fontSize: 12, flex: 1 }}>{label}</Text>
      <Text
        style={{
          color: accent || colors.foreground,
          fontSize: big ? 20 : 14,
          fontWeight: "800",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    marginTop: 4,
  },
  headRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(15,123,74,0.1)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#0F7B4A" },
  liveTxt: { fontSize: 10, fontWeight: "800", color: "#0F7B4A", letterSpacing: 0.3 },
  refresh: { minHeight: 32, minWidth: 32 },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
  },
});
