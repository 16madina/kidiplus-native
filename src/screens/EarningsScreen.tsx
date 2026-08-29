import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { GoldButton } from "../components/Buttons";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { SurfaceCard } from "../components/SurfaceCard";
import { WithdrawSheet } from "../components/seller/WithdrawSheet";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import { useAppTheme } from "../context/theme";
import { formatMoney, normalizeCurrency } from "../lib/money";
import { PLATFORM_FEE_PERCENT, feePercentOf } from "../lib/fees";
import { fetchMyBalance, fetchMyPayouts, type PayoutRow, type SellerBalance } from "../lib/earnings";
import { fetchMySales, type OrderView } from "../lib/orders";
import { loadWithdrawReadiness } from "../lib/payout-setup";
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
  const { openOverlay } = useNav();
  const [balance, setBalance] = useState<SellerBalance | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [sales, setSales] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [tab, setTab] = useState<"sales" | "payouts">("sales");
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const reload = useCallback(async () => {
    const id = user?.id;
    if (!id) return;
    const [b, p, s] = await Promise.all([fetchMyBalance(id), fetchMyPayouts(id), fetchMySales(id)]);
    setBalance(b);
    setPayouts(p.filter((row) => (row.source ?? "seller") === "seller"));
    setSales(s.filter((o) => o.rawStatus === "paid" || o.status === "paid" || o.status === "shipped" || o.status === "delivered"));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const currency = normalizeCurrency(balance?.currency ?? user?.walletCurrency);
  const fmt = (n: number, cur?: string) => formatMoney(n, cur ?? currency, i18n.language);
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
            <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 17 }}>
              {t("gains.splitExplainer", { pct: PLATFORM_FEE_PERCENT })}
            </Text>
            <GoldButton
              label={t("gains.withdraw")}
              onPress={() => {
                void (async () => {
                  if (available <= 0) {
                    flash(t("payout.errors.insufficient"));
                    return;
                  }
                  if (!user?.id) return;
                  const gate = await loadWithdrawReadiness(user.id, currency);
                  if (!gate.canWithdraw) {
                    flash(t("gains.configurePayoutsFirst"));
                    openOverlay({ kind: "seller-payments" });
                    return;
                  }
                  setWithdrawOpen(true);
                })();
              }}
            />
            <Press onPress={() => openOverlay({ kind: "seller-payments" })} style={{ minHeight: 0 }}>
              <Text style={{ color: NAVY, fontSize: 13, fontWeight: "700", textAlign: "center" }}>
                {t("gains.configurePayouts")}
              </Text>
            </Press>
            <View style={styles.tabs}>
              {(["sales", "payouts"] as const).map((key) => {
                const on = tab === key;
                return (
                  <Press
                    key={key}
                    onPress={() => setTab(key)}
                    style={[
                      styles.tab,
                      {
                        borderColor: on ? NAVY : colors.border,
                        backgroundColor: on ? NAVY : colors.card,
                      },
                    ]}
                  >
                    <Text style={{ color: on ? "#fff" : colors.foreground, fontWeight: "800", fontSize: 12 }}>
                      {t(`gains.tabs.${key}`)}
                    </Text>
                  </Press>
                );
              })}
            </View>
            {tab === "sales" ? (
              sales.length === 0 ? (
                <Text style={{ color: colors.mutedForeground }}>{t("sales.empty")}</Text>
              ) : (
                sales.map((o) => {
                  const released = o.fulfillment === "delivered" || o.status === "delivered";
                  const pct = feePercentOf(o.itemAmount, o.platformFee);
                  return (
                    <SurfaceCard key={o.id}>
                      <View style={styles.saleHead}>
                        {o.image ? (
                          <Image source={{ uri: o.image }} style={styles.thumb} contentFit="cover" />
                        ) : (
                          <View style={[styles.thumb, { backgroundColor: colors.border }]} />
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={{ fontWeight: "700", color: colors.foreground }}>
                            {o.name}
                          </Text>
                          <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                            {o.seller} · {o.when}
                          </Text>
                          <Text
                            style={{
                              marginTop: 4,
                              alignSelf: "flex-start",
                              overflow: "hidden",
                              borderRadius: 999,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              fontSize: 10,
                              fontWeight: "800",
                              color: released ? "#1B7A3A" : "#B45309",
                              backgroundColor: released ? "rgba(27,122,58,0.12)" : "rgba(180,83,9,0.12)",
                            }}
                          >
                            {released ? t("gains.moneyState.released") : t("gains.moneyState.pending")}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.breakdown}>
                        <BreakdownCell
                          label={t("gains.price")}
                          value={fmt(o.itemAmount, o.currency)}
                          muted={colors.mutedForeground}
                          fg={colors.foreground}
                          bg={colors.background}
                        />
                        <BreakdownCell
                          label={`KiDi+ −${pct}%`}
                          value={`−${fmt(o.platformFee, o.currency)}`}
                          muted={colors.mutedForeground}
                          fg={colors.mutedForeground}
                          bg={colors.background}
                        />
                        <BreakdownCell
                          label={t("gains.net")}
                          value={fmt(o.sellerNet, o.currency)}
                          muted={colors.mutedForeground}
                          fg={colors.foreground}
                          bg="rgba(232,185,59,0.16)"
                          strong
                        />
                      </View>
                    </SurfaceCard>
                  );
                })
              )
            ) : payouts.length === 0 ? (
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
        source="seller"
        onConfigure={() => openOverlay({ kind: "seller-payments" })}
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

function BreakdownCell({
  label,
  value,
  muted,
  fg,
  bg,
  strong,
}: {
  label: string;
  value: string;
  muted: string;
  fg: string;
  bg: string;
  strong?: boolean;
}) {
  return (
    <View style={[styles.cell, { backgroundColor: bg }]}>
      <Text style={{ color: muted, fontSize: 10, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: fg, fontSize: strong ? 13 : 12, fontWeight: "800", marginTop: 2, fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 10 },
  row2: { flexDirection: "row", gap: 10 },
  k: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase", color: GOLD },
  v: { fontSize: 22, fontWeight: "900", marginTop: 6 },
  tabs: { flexDirection: "row", gap: 8, marginTop: 6 },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
  },
  saleHead: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  thumb: { width: 52, height: 52, borderRadius: 12 },
  breakdown: { flexDirection: "row", gap: 6, marginTop: 10 },
  cell: { flex: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 6, alignItems: "center" },
  line: { flexDirection: "row", alignItems: "center", gap: 10 },
});
