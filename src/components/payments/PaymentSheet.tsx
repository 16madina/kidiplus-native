import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Wallet, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { BrandBadge } from "../BrandBadge";
import { useAuth } from "../../context/auth";
import { useAppTheme } from "../../context/theme";
import { convertMoney, formatMoney, normalizeCurrency } from "../../lib/money";
import { mapPayError } from "../../lib/pay-errors";
import {
  confirmOrderCheckout,
  createOrderCheckout,
  createPaypalOrderCheckout,
  openPaypalCheckout,
  payOrderWithWallet,
  paypalAuthSessionAvailable,
} from "../../lib/payments";
import { presentStripePayment, stripeAvailable } from "../../lib/stripe-native";
import type { OrderView } from "../../lib/orders";
import { GOLD, NAVY } from "../../theme";

const REBUILD_HINT = "npm install && npx expo run:ios --device";

type Props = {
  order: OrderView | null;
  onClose: () => void;
  /** Called after a confirmed payment (any method). */
  onPaid: (message: string) => void;
};

const WALLET_ERROR_KEYS: Record<string, string> = {
  insufficient_funds: "wallet.insufficient",
  order_already_paid: "pay.errors.orderNotPending",
  order_not_payable: "pay.errors.orderNotPending",
  order_expired: "pay.errors.orderExpired",
  order_not_found: "pay.errors.orderNotFound",
  forbidden: "pay.errors.forbidden",
  conversion_unavailable: "pay.errors.conversionUnavailable",
};

export function PaymentSheet({ order, onClose, onPaid }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const [busy, setBusy] = useState<null | "wallet" | "card" | "paypal">(null);
  const [error, setError] = useState<string | null>(null);

  const open = !!order;
  const walletCurrency = normalizeCurrency(user?.walletCurrency);
  const balance = user?.walletBalance ?? 0;

  useEffect(() => {
    if (open) {
      setBusy(null);
      setError(null);
    }
  }, [open, order?.id]);

  if (!order) return null;

  const fmt = (n: number) => formatMoney(n, order.currency, i18n.language);
  const walletEnough =
    walletCurrency === order.currency
      ? balance >= order.total
      : balance >= convertMoney(order.total, order.currency, walletCurrency);

  const payWallet = async () => {
    if (busy) return;
    setBusy("wallet");
    setError(null);
    const res = await payOrderWithWallet(order.id);
    if (!res.ok) {
      setBusy(null);
      setError(t(WALLET_ERROR_KEYS[res.error] ?? "pay.errors.generic"));
      return;
    }
    await refreshUser();
    onPaid(t("wallet.paidWithWallet"));
  };

  const payCard = async () => {
    if (busy) return;
    if (!stripeAvailable()) {
      const msg = t("pay.rebuildForCard", {
        defaultValue:
          "Le paiement carte demande le nouveau build natif : npx expo run:ios --device. En attendant, utilise le solde ou PayPal.",
      });
      setError(msg);
      Alert.alert(t("pay.rebuildTitle", { defaultValue: "Build natif requis" }), `${msg}\n\n${REBUILD_HINT}`);
      return;
    }
    setBusy("card");
    setError(null);
    const intent = await createOrderCheckout(order.id);
    if (!intent.ok) {
      setBusy(null);
      setError(mapPayError(intent.error, t, intent.message));
      return;
    }
    if (!intent.data.clientSecret || !intent.data.publishableKey) {
      setBusy(null);
      setError(t("pay.errors.notConfigured"));
      return;
    }
    const sheet = await presentStripePayment({
      clientSecret: intent.data.clientSecret,
      publishableKey: intent.data.publishableKey,
    });
    if (!sheet.ok) {
      setBusy(null);
      if (!sheet.cancelled) {
        setError(
          sheet.error === "stripe_module_missing"
            ? mapPayError("stripe_module_missing", t)
            : mapPayError(sheet.error, t, sheet.error),
        );
      }
      return;
    }
    const piId = intent.data.clientSecret.split("_secret")[0] ?? "";
    await confirmOrderCheckout(piId);
    await refreshUser();
    onPaid(t("pay.toasts.confirmed"));
  };

  const payPaypal = async () => {
    if (busy) return;
    if (!paypalAuthSessionAvailable()) {
      const go = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "PayPal",
          t("pay.paypalMerchantHint", {
            defaultValue:
              "Connecte-toi avec un compte acheteur (pas le compte marchand KiDi+). Déconnecte-toi de PayPal dans Safari si besoin. Pour une session privée auto : rebuild npx expo run:ios --device.",
          }),
          [
            { text: t("common.cancel", { defaultValue: "Annuler" }), style: "cancel", onPress: () => resolve(false) },
            { text: t("common.continue", { defaultValue: "Continuer" }), onPress: () => resolve(true) },
          ],
        );
      });
      if (!go) return;
    }
    setBusy("paypal");
    setError(null);
    const res = await createPaypalOrderCheckout(order.id);
    if (!res.ok || !res.data.approveUrl) {
      setBusy(null);
      setError(mapPayError(res.ok ? "generic" : res.error, t, res.ok ? undefined : res.message));
      return;
    }
    const browser = await openPaypalCheckout(res.data.approveUrl);
    if (!browser.ok) {
      setBusy(null);
      if (!browser.cancelled) setError(mapPayError(browser.error, t));
      return;
    }
    await refreshUser();
    setBusy(null);
    onPaid(t("pay.toasts.confirmed"));
  };

  const payAfricaVisa = () => {
    Alert.alert(
      t("pay.method.card"),
      t("pay.method.useVisaCardHint", {
        defaultValue: "Utilise ta carte Visa Wave / Orange / Djamo dans le formulaire carte.",
      }),
    );
    void payCard();
  };

  const showAfricaVisa = order.currency === "XOF";

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Press haptic="none" onPress={onClose} style={styles.sheetDim} />
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: colors.foreground }]}>{t("pay.title")}</Text>
            <Press onPress={onClose} style={styles.close}>
              <X size={18} color={colors.foreground} />
            </Press>
          </View>
          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 12 }}>
            <View style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text numberOfLines={1} style={{ fontWeight: "800", color: colors.foreground }}>
                {order.name}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                {order.kind === "auction" ? t("pay.kind.auction") : t("pay.kind.fixed")} · {order.seller}
              </Text>
              <Row label={t("pay.item")} value={fmt(order.itemAmount)} muted={colors.mutedForeground} fg={colors.foreground} />
              {order.deliveryFee > 0 ? (
                <Row label={t("delivery.fee")} value={fmt(order.deliveryFee)} muted={colors.mutedForeground} fg={colors.foreground} />
              ) : null}
              <Row label={t("pay.total")} value={fmt(order.total)} bold muted={colors.mutedForeground} fg={colors.foreground} />
            </View>

            <Text style={[styles.methodTitle, { color: colors.mutedForeground }]}>{t("pay.method.title")}</Text>

            <MethodBtn
              icon={<Wallet size={18} color={walletEnough ? NAVY : colors.mutedForeground} />}
              label={t("wallet.method")}
              subtitle={`${t("wallet.currentBalance")} : ${formatMoney(balance, walletCurrency, i18n.language)}`}
              accent={walletEnough}
              busy={busy === "wallet"}
              disabled={!!busy}
              onPress={() => void payWallet()}
            />
            <MethodBtn
              icon={<BrandBadge brand="card" size={28} />}
              label={t("pay.method.card")}
              subtitle={t("pay.method.cardSub")}
              busy={busy === "card"}
              disabled={!!busy}
              onPress={() => void payCard()}
            />
            {showAfricaVisa ? (
              <>
                <MethodBtn
                  icon={<BrandBadge brand="wave" size={28} />}
                  label={t("pay.method.waveVisa")}
                  subtitle={t("pay.method.waveVisaSub")}
                  busy={busy === "card"}
                  disabled={!!busy}
                  onPress={payAfricaVisa}
                />
                <MethodBtn
                  icon={<BrandBadge brand="orange" size={28} />}
                  label={t("pay.method.orangeVisa")}
                  subtitle={t("pay.method.orangeVisaSub")}
                  busy={busy === "card"}
                  disabled={!!busy}
                  onPress={payAfricaVisa}
                />
                <MethodBtn
                  icon={<BrandBadge brand="djamo" size={28} />}
                  label={t("pay.method.djamo")}
                  subtitle={t("pay.method.djamoSub")}
                  busy={busy === "card"}
                  disabled={!!busy}
                  onPress={payAfricaVisa}
                />
              </>
            ) : null}
            <MethodBtn
              icon={<BrandBadge brand="paypal" size={28} />}
              label="PayPal"
              subtitle={
                showAfricaVisa
                  ? t("pay.method.paypalXofSub", {
                      defaultValue: "Paiement en euros (équivalent XOF)",
                    })
                  : t("pay.method.paypalSub", {
                      defaultValue: "Payer cette commande avec ton compte PayPal",
                    })
              }
              busy={busy === "paypal"}
              disabled={!!busy}
              onPress={() => void payPaypal()}
            />

            {error ? (
              <View style={{ backgroundColor: "#FDE8E8", borderRadius: 12, padding: 10 }}>
                <Text style={{ color: "#9B1C1C", fontSize: 13, fontWeight: "600" }}>{error}</Text>
              </View>
            ) : null}
            <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: "center" }}>
              {t("pay.secure")}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
  fg,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted: string;
  fg: string;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
      <Text style={{ color: muted, fontSize: 13, fontWeight: bold ? "800" : "500" }}>{label}</Text>
      <Text style={{ color: fg, fontSize: bold ? 15 : 13, fontWeight: bold ? "900" : "600" }}>{value}</Text>
    </View>
  );
}

function MethodBtn({
  icon,
  label,
  subtitle,
  accent,
  busy,
  disabled,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  accent?: boolean;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.method,
        {
          borderColor: accent ? GOLD : colors.border,
          backgroundColor: accent ? "rgba(232,185,59,0.10)" : colors.card,
          opacity: disabled && !busy ? 0.6 : 1,
        },
      ]}
    >
      <View style={styles.methodIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "800", fontSize: 14, color: colors.foreground }}>{label}</Text>
        {subtitle ? (
          <Text style={{ color: colors.mutedForeground, fontSize: 11.5, marginTop: 1 }}>{subtitle}</Text>
        ) : null}
      </View>
      {busy ? <ActivityIndicator color={GOLD} /> : null}
    </Press>
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
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "800" },
  close: { width: 36, height: 36, minWidth: 36, minHeight: 36 },
  summary: { borderWidth: 1, borderRadius: 16, padding: 14 },
  methodTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  method: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    minHeight: 62,
  },
  methodIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(232,185,59,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
