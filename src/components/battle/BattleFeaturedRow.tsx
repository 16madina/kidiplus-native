import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react-native";
import { Press } from "../Press";
import {
  auctionSecondsLeft,
  formatBattleCardClock,
  peerStatusKey,
} from "../../lib/battle-featured";
import { bidStepFor, formatMoney, normalizeCurrency } from "../../lib/money";
import type { LiveProductRow } from "../../lib/live-host";
import { GOLD, NAVY } from "../../theme";

/** Own product always LEFT, opponent always RIGHT. */
export function BattleFeaturedRow({
  own,
  peer,
  currency,
  ownSecondsLeft = 0,
  peerSecondsLeft = 0,
  viewer = false,
  onManageOwn,
  onStartOwn,
  onBidOwn,
  onOpenPeer,
}: {
  own: LiveProductRow | null;
  peer: LiveProductRow | null;
  currency: string;
  ownSecondsLeft?: number;
  peerSecondsLeft?: number;
  viewer?: boolean;
  onManageOwn?: () => void;
  onStartOwn?: () => void;
  onBidOwn?: () => void;
  onOpenPeer?: () => void;
}) {
  return (
    <View style={styles.row}>
      <MiniCard
        product={own}
        currency={currency}
        secondsLeft={ownSecondsLeft}
        owned={!viewer}
        viewer={viewer}
        onOpen={onManageOwn}
        onOwnerAction={onStartOwn}
        onBid={onBidOwn}
        onAdd={viewer ? undefined : onManageOwn}
      />
      <MiniCard
        product={peer}
        currency={currency}
        secondsLeft={peerSecondsLeft}
        owned={false}
        viewer={viewer}
        readonly
        onOpen={peer ? onOpenPeer : undefined}
      />
    </View>
  );
}

export function BattlePeerProductSheet({
  open,
  onClose,
  product,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  product: LiveProductRow | null;
  currency: string;
}) {
  const { t, i18n } = useTranslation();
  const cur = normalizeCurrency(currency);
  if (!product) return null;
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Press haptic="none" onPress={onClose} style={styles.sheetDim} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{product.name}</Text>
            <Press onPress={onClose} style={styles.sheetClose}>
              <X size={18} color="#fff" />
            </Press>
          </View>
          <ScrollView>
            {product.image_url ? (
              <Image source={{ uri: product.image_url }} style={styles.sheetImg} contentFit="cover" />
            ) : (
              <View style={[styles.sheetImg, styles.ph]} />
            )}
            <Text style={styles.sheetStatus}>{t(peerStatusKey(product))}</Text>
            <Text style={styles.sheetPrice}>
              {formatMoney(
                Number(
                  product.status === "active" || product.mode === "fixed"
                    ? product.price
                    : product.start_price,
                ),
                cur,
                i18n.language,
              )}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MiniCard({
  product,
  currency,
  secondsLeft,
  owned,
  viewer,
  readonly = false,
  onOpen,
  onOwnerAction,
  onBid,
  onAdd,
}: {
  product: LiveProductRow | null;
  currency: string;
  secondsLeft: number;
  owned: boolean;
  viewer: boolean;
  readonly?: boolean;
  onOpen?: () => void;
  onOwnerAction?: () => void;
  onBid?: () => void;
  onAdd?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const cur = normalizeCurrency(currency);
  const auctionOn =
    !!product &&
    product.status === "active" &&
    product.mode === "auction" &&
    auctionSecondsLeft(product) > 0;
  const [clock, setClock] = useState(secondsLeft);

  useEffect(() => {
    if (!auctionOn || !product) {
      setClock(secondsLeft);
      return;
    }
    const tick = () => {
      const fromDeadline = auctionSecondsLeft(product);
      setClock(fromDeadline > 0 ? fromDeadline : secondsLeft);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [auctionOn, product, secondsLeft]);

  if (!product) {
    return (
      <View style={styles.card}>
        {owned && onOpen ? (
          <Press onPress={onOpen} style={styles.emptyBtn}>
            <Text style={styles.emptyTxt} numberOfLines={2}>
              {t("battle.card.select")}
            </Text>
          </Press>
        ) : (
          <Text style={styles.emptyTxt} numberOfLines={2}>
            {t("battle.card.next")}
          </Text>
        )}
        {owned && onAdd ? <AddButton onPress={onAdd} /> : null}
      </View>
    );
  }

  const step = bidStepFor(Number(product.price), cur);
  const action = (() => {
    if (readonly) return null;
    if (owned && onOwnerAction && !auctionOn) {
      return {
        label: product.mode === "auction" ? t("battle.card.start") : t("live.listForSale"),
        run: onOwnerAction,
      };
    }
    if (viewer && auctionOn && onBid) {
      return {
        label: t("battle.card.bid", { amount: formatMoney(step, cur, i18n.language) }),
        run: onBid,
      };
    }
    return null;
  })();

  return (
    <View style={styles.card}>
      <Press onPress={onOpen} style={styles.cardMain} disabled={!onOpen}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.ph]} />
        )}
        <View style={styles.meta}>
          <Text style={styles.prodName} numberOfLines={1}>
            {product.name}
          </Text>
          {auctionOn ? (
            <Text style={styles.priceLive} numberOfLines={1}>
              {t("live.currentBid")} {formatMoney(Number(product.price), cur, i18n.language)}
              {clock > 0 ? ` · ${formatBattleCardClock(clock)}` : ""}
            </Text>
          ) : (
            <Text style={styles.priceWait} numberOfLines={1}>
              {formatMoney(
                Number(product.mode === "auction" ? product.start_price : product.price),
                cur,
                i18n.language,
              )}
            </Text>
          )}
          {readonly ? (
            <Text style={styles.status} numberOfLines={1}>
              {t(peerStatusKey(product))}
            </Text>
          ) : null}
        </View>
      </Press>
      {action ? (
        <Press onPress={action.run} style={styles.cta}>
          <Text style={styles.ctaTxt} numberOfLines={1}>
            {action.label}
          </Text>
        </Press>
      ) : null}
      {owned && onAdd ? <AddButton onPress={onAdd} /> : null}
    </View>
  );
}

function AddButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Press onPress={onPress} accessibilityLabel={t("battle.card.select")} style={styles.add}>
      <Plus size={16} color={NAVY} strokeWidth={3} />
    </Press>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 4, height: 76 },
  card: {
    flex: 1,
    minWidth: 0,
    height: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 14,
    padding: 6,
    backgroundColor: "rgba(12,16,28,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  emptyBtn: { flex: 1, minWidth: 0, minHeight: 0, alignItems: "flex-start" },
  emptyTxt: { flex: 1, color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "600", paddingHorizontal: 6 },
  cardMain: { flex: 1, minWidth: 0, minHeight: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  thumb: { width: 62, height: 62, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)" },
  ph: { backgroundColor: "rgba(255,255,255,0.12)" },
  meta: { flex: 1, minWidth: 0 },
  prodName: { color: "#fff", fontSize: 11, fontWeight: "700" },
  priceLive: { color: "#f6d365", fontSize: 10, fontWeight: "600", fontVariant: ["tabular-nums"], marginTop: 2 },
  priceWait: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "600", marginTop: 2 },
  status: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: 2,
  },
  cta: {
    minHeight: 32,
    minWidth: 0,
    height: 32,
    maxWidth: "46%",
    borderRadius: 999,
    paddingHorizontal: 8,
    backgroundColor: GOLD,
  },
  ctaTxt: { color: NAVY, fontSize: 10, fontWeight: "800" },
  add: {
    width: 32,
    height: 32,
    minWidth: 32,
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: GOLD,
  },
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetDim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.45)", minHeight: 0, minWidth: 0 },
  sheet: {
    backgroundColor: "#12141F",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: "55%",
  },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "800", flex: 1, paddingRight: 8 },
  sheetClose: { width: 36, height: 36, minWidth: 36, minHeight: 36 },
  sheetImg: { width: "100%", height: 160, borderRadius: 16, marginBottom: 10 },
  sheetStatus: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "600" },
  sheetPrice: { color: "#f6d365", fontSize: 20, fontWeight: "900", marginTop: 4 },
});
