import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react-native";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { OrderListCard } from "../components/orders/OrderListCard";
import { OrderTimeline } from "../components/orders/OrderTimeline";
import { InvoiceSheet } from "../components/orders/InvoiceSheet";
import { LeaveReviewSheet } from "../components/orders/LeaveReviewSheet";
import { PaymentSheet } from "../components/payments/PaymentSheet";
import { Press } from "../components/Press";
import { SurfaceCard } from "../components/SurfaceCard";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import {
  confirmOrderDelivered,
  disputeOrder,
  fetchMyPurchases,
  fetchMySales,
  formatAddressSnapshot,
  markOrderShipped,
  type OrderView,
} from "../lib/orders";
import { fetchMyReviewedOrderIds } from "../lib/reviews";
import { type MockOrder } from "../mock/account";
import { GOLD, NAVY } from "../theme";

function statusLabel(status: MockOrder["status"], t: (k: string) => string) {
  if (status === "awaitingPayment") return t("orders.status.awaitingPayment");
  if (status === "paid") return t("orders.status.paid");
  if (status === "shipped") return t("orders.fulfillment.shipped");
  if (status === "delivered") return t("orders.fulfillment.delivered");
  if (status === "failed") return t("orders.status.failed");
  if (status === "cancelled") return t("orders.status.cancelled");
  return t("activity.orderStatus.refunded");
}

export function OrdersScreen({ orderId }: { orderId?: string } = {}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<"purchases" | "sales">(user?.isSeller ? "sales" : "purchases");
  const [toast, setToast] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<OrderView[]>([]);
  const [sales, setSales] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<OrderView | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<OrderView | null>(null);
  const [detailIsSale, setDetailIsSale] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState<OrderView | null>(null);
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const openedOrderRef = useRef<string | null>(null);
  const list = tab === "purchases" ? purchases : sales;

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const reload = useCallback(async () => {
    const id = user?.id;
    if (!id) {
      setPurchases([]);
      setSales([]);
      setLoading(false);
      return;
    }
    const [buy, sell] = await Promise.all([
      fetchMyPurchases(id),
      user.isSeller ? fetchMySales(id) : Promise.resolve([]),
    ]);
    setPurchases(buy);
    setSales(sell);
    const delivered = buy.filter((o) => o.status === "delivered").map((o) => o.id);
    setReviewedIds(await fetchMyReviewedOrderIds(delivered));
    setLoading(false);
  }, [user?.id, user?.isSeller]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!orderId || loading) return;
    if (openedOrderRef.current === orderId) return;
    const fromPurchases = purchases.find((o) => o.id === orderId);
    const fromSales = sales.find((o) => o.id === orderId);
    const hit = fromPurchases ?? fromSales;
    if (!hit) return;
    openedOrderRef.current = orderId;
    if (fromSales && !fromPurchases) setTab("sales");
    else setTab("purchases");
    if (hit.status === "awaitingPayment") setPaying(hit);
  }, [orderId, loading, purchases, sales]);

  const doShip = (o: OrderView) => {
    if (busyId) return;
    setBusyId(o.id);
    void markOrderShipped(o.id).then((res) => {
      setBusyId(null);
      flash(res.ok ? t("orders.shipped") : res.error ?? t("errors.generic", { defaultValue: "Erreur" }));
      if (res.ok) void reload();
    });
  };

  const doConfirm = (o: OrderView) => {
    if (busyId) return;
    Alert.alert(t("orders.confirmDelivery"), o.name, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        onPress: () => {
          setBusyId(o.id);
          void confirmOrderDelivered(o.id).then((res) => {
            setBusyId(null);
            flash(res.ok ? t("orders.delivered") : res.error ?? t("errors.generic", { defaultValue: "Erreur" }));
            if (res.ok) void reload();
          });
        },
      },
    ]);
  };

  const doDispute = (o: OrderView) => {
    if (busyId) return;
    Alert.alert(t("orders.disputeTitle"), t("orders.disputeBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("orders.disputeSubmit"),
        style: "destructive",
        onPress: () => {
          setBusyId(o.id);
          void disputeOrder(o.id, "other").then((res) => {
            setBusyId(null);
            flash(res.ok ? t("orders.disputeOpened") : res.error ?? t("errors.generic", { defaultValue: "Erreur" }));
            if (res.ok) void reload();
          });
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("myOrders.title")} />
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(["sales", "purchases"] as const).map((k) => (
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
          list.map((o) => {
            const busy = busyId === o.id;
            const isBuyer = tab === "purchases";
            const canShip = !isBuyer && o.rawStatus === "paid" && o.fulfillment === "awaiting";
            const canPay = isBuyer && o.status === "awaitingPayment";
            const canReview = isBuyer && o.status === "delivered";
            const canConfirm = isBuyer && o.rawStatus === "paid" && o.fulfillment === "shipped";
            const canDispute =
              isBuyer && o.rawStatus === "paid" && (o.fulfillment === "shipped" || o.fulfillment === "awaiting");
            const hasActions = canShip || canPay || canReview || canConfirm || canDispute;
            return (
              <OrderListCard
                key={o.id}
                name={o.name}
                image={o.image}
                party={
                  isBuyer
                    ? t("myOrders.soldBy", { name: o.seller })
                    : t("myOrders.boughtBy", { name: o.seller })
                }
                price={o.price}
                when={o.when}
                status={o.status}
                statusLabel={statusLabel(o.status, t)}
                onPress={() => {
                  setDetailIsSale(!isBuyer);
                  setDetailOrder(o);
                }}
              >
                {hasActions ? (
                  <>
                    {canPay ? (
                      <Press onPress={() => setPaying(o)} style={styles.cta}>
                        <Text style={styles.ctaTxt}>{t("orders.payNow")}</Text>
                      </Press>
                    ) : null}
                    {canShip ? (
                      <Press onPress={() => doShip(o)} disabled={busy} style={styles.cta}>
                        {busy ? (
                          <ActivityIndicator color={NAVY} />
                        ) : (
                          <Text style={styles.ctaTxt}>{t("orders.shipCta")}</Text>
                        )}
                      </Press>
                    ) : null}
                    {canConfirm ? (
                      <Press onPress={() => doConfirm(o)} disabled={busy} style={styles.cta}>
                        {busy ? (
                          <ActivityIndicator color={NAVY} />
                        ) : (
                          <Text style={styles.ctaTxt}>{t("orders.confirmDelivery")}</Text>
                        )}
                      </Press>
                    ) : null}
                    {canReview ? (
                      <Press
                        onPress={() => setReviewOrderId(o.id)}
                        style={[styles.cta, reviewedIds.has(o.id) && { backgroundColor: "#E8F6EE" }]}
                      >
                        <Text style={styles.ctaTxt}>
                          {reviewedIds.has(o.id) ? `✓ ${t("reviews.left")}` : t("reviews.rateOrder")}
                        </Text>
                      </Press>
                    ) : null}
                    {canDispute ? (
                      <Press onPress={() => doDispute(o)} disabled={busy} style={styles.report}>
                        <Text style={styles.reportTxt}>{t("orders.reportProblem")}</Text>
                      </Press>
                    ) : null}
                  </>
                ) : null}
              </OrderListCard>
            );
          })
        )}
      </ScrollView>
      <PaymentSheet
        order={paying}
        onClose={() => setPaying(null)}
        onPaid={(msg) => {
          setPaying(null);
          flash(msg);
          void reload();
        }}
      />
      <MockBanner text={toast} />
      {detailOrder && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, zIndex: 90 }]}>
          <OverlayHeader title={detailOrder.name} onBack={() => setDetailOrder(null)} />
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}>
            <SurfaceCard>
              <Text style={{ fontWeight: "800", fontSize: 16, color: colors.foreground }}>{detailOrder.name}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 4 }}>{detailOrder.seller}</Text>
              <Text style={{ color: GOLD, fontWeight: "800", fontSize: 18, marginTop: 6 }}>{detailOrder.price}</Text>
            </SurfaceCard>
            {detailIsSale ? <SellerShipBlock order={detailOrder} /> : null}
            <SurfaceCard>
              <Text style={{ fontWeight: "700", fontSize: 14, color: colors.foreground, marginBottom: 8 }}>Suivi de commande</Text>
              <OrderTimeline
                status={detailOrder.status === "awaitingPayment" ? "created" : detailOrder.status}
                createdAt={detailOrder.when}
              />
            </SurfaceCard>
            <Press onPress={() => setInvoiceOrder(detailOrder)} style={styles.cta}>
              <FileText size={16} color={NAVY} />
              <Text style={{ fontWeight: "800", color: NAVY }}>{t("invoice.viewCta")}</Text>
            </Press>
          </ScrollView>
        </View>
      )}
      <InvoiceSheet
        order={invoiceOrder ? {
          id: invoiceOrder.id,
          item_name: invoiceOrder.name,
          amount: invoiceOrder.itemAmount,
          delivery_fee: invoiceOrder.deliveryFee,
          total: invoiceOrder.total,
          currency: invoiceOrder.currency,
          status: invoiceOrder.status,
          created_at: invoiceOrder.when || new Date().toISOString(),
          seller_name: invoiceOrder.seller,
        } : null}
        visible={!!invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
      />
      <LeaveReviewSheet
        open={!!reviewOrderId}
        orderId={reviewOrderId}
        onClose={() => setReviewOrderId(null)}
        onSubmitted={() => {
          if (reviewOrderId) setReviewedIds((prev) => new Set([...prev, reviewOrderId]));
          void reload();
        }}
      />
    </View>
  );
}

function SellerShipBlock({ order }: { order: OrderView }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const snap = order.address;
  const line = formatAddressSnapshot(snap);
  const paid = order.rawStatus === "paid" || order.status === "shipped" || order.status === "delivered";

  if (!paid) {
    return (
      <SurfaceCard>
        <Text style={{ fontWeight: "700", color: colors.foreground }}>{t("sellerOrder.shipTo")}</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 6 }}>
          {t("sellerOrder.awaitingPayment")}
        </Text>
      </SurfaceCard>
    );
  }

  if (!snap) {
    return (
      <SurfaceCard>
        <Text style={{ fontWeight: "700", color: colors.foreground }}>{t("sellerOrder.shipTo")}</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 6 }}>{t("sellerOrder.noAddress")}</Text>
      </SurfaceCard>
    );
  }

  const phone = (snap.phone ?? "").trim();
  const digits = phone.replace(/[^0-9+]/g, "");

  return (
    <SurfaceCard>
      <Text style={{ fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>{t("sellerOrder.shipTo")}</Text>
      {snap.full_name ? (
        <Text style={{ color: colors.foreground, fontWeight: "800", fontSize: 15 }}>{snap.full_name}</Text>
      ) : null}
      {phone ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <Press
            onPress={() => void Linking.openURL(`tel:${digits}`)}
            style={[styles.ghost, { borderColor: colors.border, paddingHorizontal: 12, height: 36, minHeight: 36 }]}
          >
            <Text style={{ fontWeight: "700", color: colors.foreground, fontSize: 13 }}>{phone}</Text>
          </Press>
          <Press
            onPress={() => void Linking.openURL(`https://wa.me/${digits.replace(/^\+/, "")}`)}
            style={[styles.ghost, { borderColor: colors.border, paddingHorizontal: 12, height: 36, minHeight: 36 }]}
          >
            <Text style={{ fontWeight: "700", color: "#128C7E", fontSize: 13 }}>WhatsApp</Text>
          </Press>
        </View>
      ) : null}
      {line ? (
        <Text style={{ color: colors.foreground, fontSize: 13, marginTop: 8, lineHeight: 18 }}>{line}</Text>
      ) : null}
      {snap.details ? (
        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>{snap.details}</Text>
      ) : null}
      <Press
        onPress={() => {
          const block = [snap.full_name, phone, line, snap.details].filter(Boolean).join("\n");
          if (block) void Share.share({ message: block });
        }}
        style={[styles.ghost, { borderColor: colors.border, marginTop: 10, height: 36, minHeight: 36 }]}
      >
        <Text style={{ fontWeight: "700", color: colors.foreground, fontSize: 12 }}>{t("sellerOrder.copyAddress")}</Text>
      </Press>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { flexDirection: "row", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, height: 44, borderBottomWidth: 2, borderBottomColor: "transparent" },
  body: { padding: 16, paddingBottom: 48, gap: 10, alignItems: "stretch" },
  cta: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 8,
    height: 40,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: GOLD,
  },
  ctaTxt: { fontWeight: "800", color: NAVY, fontSize: 13 },
  report: {
    alignSelf: "stretch",
    minHeight: 32,
    height: 32,
  },
  reportTxt: { fontWeight: "600", color: "#C0392B", fontSize: 12 },
  ghost: {
    height: 40,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
  },
});
