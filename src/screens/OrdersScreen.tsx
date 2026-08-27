import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { fetchMyPurchases, fetchMySales } from "../lib/orders";
import { GOLD, NAVY } from "../theme";
import { type MockOrder } from "../mock/account";

function statusLabel(status: MockOrder["status"], t: (k: string) => string) {
  if (status === "awaitingPayment") return t("orders.status.awaitingPayment");
  if (status === "paid") return t("orders.status.paid");
  if (status === "shipped") return t("orders.fulfillment.shipped");
  if (status === "delivered") return t("orders.fulfillment.delivered");
  if (status === "failed") return t("orders.status.failed");
  if (status === "cancelled") return t("orders.status.cancelled");
  return t("activity.orderStatus.refunded");
}

const STATUS_COLOR: Record<MockOrder["status"], string> = {
  awaitingPayment: "#C0392B",
  paid: GOLD,
  shipped: "#2E6BFF",
  delivered: "#1B7A3A",
  failed: "#C0392B",
  cancelled: "#6B7289",
  refunded: "#8B5CF6",
};

export function OrdersScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<"purchases" | "sales">("purchases");
  const [toast, setToast] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<MockOrder[]>([]);
  const [sales, setSales] = useState<MockOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const list = tab === "purchases" ? purchases : sales;

  useEffect(() => {
    let cancelled = false;
    const id = user?.id;
    if (!id) {
      setPurchases([]);
      setSales([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void Promise.all([fetchMyPurchases(id), user.isSeller ? fetchMySales(id) : Promise.resolve([])]).then(
      ([buy, sell]) => {
        if (cancelled) return;
        setPurchases(buy);
        setSales(sell);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.isSeller]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("myOrders.title")} />
      <View style={styles.tabs}>
        {(["purchases", "sales"] as const).map((k) => (
          <Press key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && { borderBottomColor: GOLD }]}>
            <Text style={{ fontWeight: tab === k ? "800" : "600", color: tab === k ? colors.foreground : colors.mutedForeground }}>
              {t(`myOrders.tabs.${k}`)}
            </Text>
          </Press>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, marginBottom: 4 }}>
          {t(tab === "purchases" ? "myOrders.purchasesHint" : "myOrders.salesHint")}
        </Text>
        {loading ? (
          <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} />
        ) : tab === "sales" && !user?.isSeller ? (
          <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 32 }}>{t("myOrders.emptySales")}</Text>
        ) : list.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 32 }}>{t("orders.empty")}</Text>
        ) : (
          list.map((o) => (
            <SurfaceCard key={o.id} padded={false}>
              <View style={styles.card}>
                {o.image ? <Image source={{ uri: o.image }} style={styles.img} contentFit="cover" /> : <View style={styles.img} />}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontWeight: "800", color: colors.foreground }}>{o.name}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{o.seller}</Text>
                  <Text style={{ color: GOLD, fontWeight: "800", marginTop: 2 }}>{o.price}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{o.when}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: `${STATUS_COLOR[o.status]}22` }]}>
                  <Text style={{ color: STATUS_COLOR[o.status], fontWeight: "800", fontSize: 10 }}>
                    {statusLabel(o.status, t)}
                  </Text>
                </View>
              </View>
              {o.status === "awaitingPayment" && tab === "purchases" ? (
                <Press
                  onPress={() => {
                    setToast(t("orders.paySoon"));
                    setTimeout(() => setToast(null), 2200);
                  }}
                  style={styles.pay}
                >
                  <Text style={{ fontWeight: "800", color: NAVY }}>{t("orders.payNow")}</Text>
                </Press>
              ) : null}
            </SurfaceCard>
          ))
        )}
      </ScrollView>
      <MockBanner text={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { flexDirection: "row", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E6E8EF" },
  tab: { flex: 1, height: 44, borderBottomWidth: 2, borderBottomColor: "transparent" },
  body: { padding: 16, paddingBottom: 48, gap: 10 },
  card: { flexDirection: "row", gap: 12, padding: 12, alignItems: "flex-start" },
  img: { width: 64, height: 64, borderRadius: 12, backgroundColor: "#E8EAF1" },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  pay: {
    marginHorizontal: 12,
    marginBottom: 12,
    height: 40,
    borderRadius: 12,
    backgroundColor: GOLD,
  },
});
