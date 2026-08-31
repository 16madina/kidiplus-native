import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Gavel, MoreVertical } from "lucide-react-native";
import { Press } from "../Press";
import { formatAuctionSeconds } from "../live/auction-now-bar";
import {
  DEFAULT_HOST_FEATURED_LAYOUT,
  HOST_FEATURED_LAYOUT_KEY,
  featuredPriceLine,
  hostFeaturedCtaKind,
  parseHostFeaturedLayout,
  type HostFeaturedCtaKind,
  type HostFeaturedLayout,
} from "../../lib/host-featured-layout";
import { HOST_PORTRAIT_CARD_WIDTH } from "../../lib/host-hud-layout";
import { GOLD, NAVY } from "../../theme";

/** Display preference only — never starts, stops, or resets a sale. */
export function useHostFeaturedLayout() {
  const [layout, setLayout] = useState<HostFeaturedLayout>(DEFAULT_HOST_FEATURED_LAYOUT);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(HOST_FEATURED_LAYOUT_KEY).then((raw) => {
      if (!cancelled) setLayout(parseHostFeaturedLayout(raw));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = (next: HostFeaturedLayout) => {
    setLayout(next);
    void AsyncStorage.setItem(HOST_FEATURED_LAYOUT_KEY, next);
  };

  return { layout, save };
}

function CtaLabel({
  kind,
  secondsLeft,
}: {
  kind: HostFeaturedCtaKind;
  secondsLeft: number | null;
}) {
  const { t } = useTranslation();
  if (kind === "timer") {
    return <Text style={styles.ctaTxt}>{formatAuctionSeconds(secondsLeft ?? 0)}</Text>;
  }
  const label =
    kind === "replay"
      ? t("live.startAuctionAgain", "Rejouer")
      : kind === "listed"
        ? t("live.listedForSale", "En vente")
        : t("live.listForSale", "Mettre en vente");
  return (
    <>
      <Gavel size={14} color={NAVY} strokeWidth={2.4} />
      <Text style={styles.ctaTxt}>{label}</Text>
    </>
  );
}

export function HostFeaturedCard({
  name,
  imageUrl,
  priceLabel,
  stock,
  mode,
  status,
  auctionLive,
  secondsLeft,
  busy,
  layout,
  onChangeLayout,
  onSell,
  onOpenProducts,
}: {
  name: string;
  imageUrl?: string | null;
  priceLabel: string;
  stock: number;
  mode: "auction" | "fixed";
  status: string;
  auctionLive: boolean;
  secondsLeft: number | null;
  busy?: boolean;
  layout: HostFeaturedLayout;
  onChangeLayout: (next: HostFeaturedLayout) => void;
  onSell: () => void;
  onOpenProducts: () => void;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const kind = hostFeaturedCtaKind({ mode, status, auctionLive });
  const landscape = layout === "landscape";
  const stockLabel = t("live.stockCount", "Stock : {{count}}", { count: stock });
  const startLabel = t("live.startFrom", "Départ : {{amount}}", { amount: priceLabel });
  const priceLine = featuredPriceLine({
    auctionLive,
    mode,
    layout,
    priceLabel,
    startLabel,
  });

  const applyLayout = (next: HostFeaturedLayout) => {
    setMenuOpen(false);
    if (next === layout) return;
    onChangeLayout(next);
  };

  const menu = (
    <View style={styles.menu}>
      <Press
        haptic="none"
        onPress={() => applyLayout("portrait")}
        style={[styles.menuItem, !landscape && styles.menuOn]}
      >
        <Text style={styles.menuTxt}>{t("live.cardPortrait", "Carte verticale")}</Text>
      </Press>
      <Press
        haptic="none"
        onPress={() => applyLayout("landscape")}
        style={[styles.menuItem, landscape && styles.menuOn]}
      >
        <Text style={styles.menuTxt}>{t("live.cardLandscape", "Carte horizontale")}</Text>
      </Press>
    </View>
  );

  const dots = (
    <Press
      haptic="none"
      onPress={() => setMenuOpen((v) => !v)}
      style={styles.dots}
      accessibilityLabel={t("live.layoutMenu", "Changer l'affichage de la carte")}
    >
      <MoreVertical size={16} color="#fff" strokeWidth={2.4} />
    </Press>
  );

  return (
    <View style={landscape ? styles.landWrap : styles.portWrap}>
      <View style={landscape ? styles.landCard : styles.portCard}>
        {!landscape ? (
          <View style={styles.portHead}>
            <Text style={styles.portEyebrow}>{t("live.featured")}</Text>
            {dots}
          </View>
        ) : null}
        <Press
          haptic="none"
          onPress={onOpenProducts}
          style={landscape ? styles.landTap : styles.portTap}
        >
          <View style={landscape ? styles.landThumbWrap : undefined}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={landscape ? styles.landThumb : styles.portImg}
                contentFit="cover"
              />
            ) : (
              <View style={[landscape ? styles.landThumb : styles.portImg, styles.ph]} />
            )}
            {landscape ? (
              <View style={styles.landBadge}>
                <Text style={styles.landBadgeTxt}>{t("live.featured")}</Text>
              </View>
            ) : null}
          </View>
          <View style={landscape ? styles.landBody : undefined}>
            <Text style={styles.name} numberOfLines={landscape ? 1 : 2}>
              {name}
            </Text>
            <Text style={landscape ? styles.meta : styles.price} numberOfLines={1}>
              {priceLine}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {stockLabel}
            </Text>
          </View>
        </Press>
        <Press
          onPress={() => {
            if (kind === "timer") {
              onOpenProducts();
              return;
            }
            onSell();
          }}
          disabled={!!busy && kind !== "timer"}
          style={[styles.cta, kind === "timer" && styles.ctaTimer, landscape && styles.ctaWide]}
        >
          <CtaLabel kind={kind} secondsLeft={secondsLeft} />
        </Press>
        {landscape ? dots : null}
      </View>
      {menuOpen ? menu : null}
    </View>
  );
}

const CARD_BG = "rgba(8,10,16,0.82)";
const CARD_BORDER = "rgba(232,185,59,0.85)";

const styles = StyleSheet.create({
  portWrap: { alignItems: "flex-end", maxWidth: HOST_PORTRAIT_CARD_WIDTH + 8 },
  portCard: {
    width: HOST_PORTRAIT_CARD_WIDTH,
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 6,
    gap: 4,
  },
  portHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  portEyebrow: {
    color: GOLD,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  portTap: { alignItems: "stretch", minHeight: 0, minWidth: 0, gap: 4 },
  portImg: {
    width: "100%",
    aspectRatio: 1.05,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  landWrap: { width: "100%" },
  landCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 7,
  },
  landTap: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  landThumbWrap: { width: 72, height: 72, borderRadius: 10, overflow: "hidden" },
  landThumb: { width: 72, height: 72, backgroundColor: "rgba(255,255,255,0.08)" },
  landBadge: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(232,185,59,0.92)",
    paddingVertical: 2,
    alignItems: "center",
  },
  landBadgeTxt: {
    color: NAVY,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  landBody: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: "#fff", fontWeight: "800", fontSize: 13 },
  price: { color: "#fff", fontWeight: "800", fontSize: 14, fontVariant: ["tabular-nums"] },
  meta: { color: "rgba(255,255,255,0.86)", fontSize: 11, fontWeight: "600" },
  ph: { backgroundColor: "rgba(255,255,255,0.12)" },
  dots: { width: 28, height: 28, minWidth: 28, minHeight: 28, borderRadius: 14 },
  cta: {
    minHeight: 36,
    minWidth: 0,
    height: 36,
    borderRadius: 10,
    backgroundColor: GOLD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  ctaWide: { flexShrink: 0, paddingHorizontal: 10, maxWidth: 148 },
  ctaTimer: { minWidth: 72 },
  ctaTxt: {
    color: NAVY,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    fontVariant: ["tabular-nums"],
  },
  menu: {
    marginTop: 6,
    alignSelf: "flex-end",
    backgroundColor: "rgba(8,10,16,0.94)",
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    minWidth: 168,
  },
  menuItem: {
    minHeight: 40,
    minWidth: 0,
    alignItems: "flex-start",
    paddingHorizontal: 12,
  },
  menuOn: { backgroundColor: "rgba(232,185,59,0.22)" },
  menuTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
