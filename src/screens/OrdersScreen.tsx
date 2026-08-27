import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Glass } from "../components/Glass";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { GOLD, NAVY } from "../theme";
import { MOCK_PURCHASES, MOCK_SALES, type MockOrder } from "../mock/account";

function statusLabel(status: MockOrder["status"], t: (k: string) => string) {
  if (status === "awaitingPayment") return t("orders.status.awaitingPayment");
  if (status === "paid") return t("orders.status.paid");
  if (status === "shipped") return t("orders.fulfillment.shipped");
  return t("orders.fulfillment.delivered");
}

const STATUS_COLOR: Record<MockOrder["status"], string> = {
  awaitingPayment: "#C0392B",
  paid: GOLD,
  shipped: "#2E6BFF",
  delivered: "#1B7A3A",
};

export function OrdersScreen() {
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<"purchases" | "sales">("purchases");
  const [toast, setToast] = useState<string | null>(null);
  const [purchases, setPurchases] = useState(MOCK_PURCHASES);
  const list = tab === "purchases" ? purchases : MOCK_SALES;

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
        {tab === "sales" && !user?.isSeller ? (
          <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 32 }}>{t("myOrders.emptySales")}</Text>
        ) : list.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 32 }}>{t("orders.empty")}</Text>
        ) : (
          list.map((o) => (
            <Glass key={o.id} tone={dark ? "dark" : "light"} intensity={32} radius={18} elevated={false}>
              <View style={styles.card}>
                <Image source={{ uri: o.image }} style={styles.img} contentFit="cover" />
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
                    setPurchases((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: "paid", when: "Payé · à l'instant" } : x)));
                    setToast(t("pay.toasts.confirmed"));
                    setTimeout(() => setToast(null), 2200);
                  }}
                  style={styles.pay}
                >
                  <Text style={{ fontWeight: "800", color: NAVY }}>{t("orders.payNow")}</Text>
                </Press>
              ) : null}
            </Glass>
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
