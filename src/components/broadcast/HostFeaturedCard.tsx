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
  hostFeaturedCtaKind,
  parseHostFeaturedLayout,
  type HostFeaturedCtaKind,
  type HostFeaturedLayout,
} from "../../lib/host-featured-layout";
import { GOLD, NAVY } from "../../theme";

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
  const ctaDisabled = busy || kind === "timer";
  const stockLabel = t("live.stockCount", "Stock : {{count}}", { count: stock });
  const startLabel = t("live.startFrom", "Départ : {{amount}}", { amount: priceLabel });

  const menu = (
    <View style={styles.menu}>
      <Press
        haptic="none"
        onPress={() => {
          onChangeLayout("portrait");
          setMenuOpen(false);
        }}
        style={[styles.menuItem, layout === "portrait" && styles.menuOn]}
      >
        <Text style={styles.menuTxt}>{t("live.cardPortrait", "Carte verticale")}</Text>
      </Press>
      <Press
        haptic="none"
        onPress={() => {
          onChangeLayout("landscape");
          setMenuOpen(false);
        }}
        style={[styles.menuItem, layout === "landscape" && styles.menuOn]}
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

  const cta = (
    <Press
      onPress={() => {
        if (kind === "timer") {
          onOpenProducts();
          return;
        }
        onSell();
      }}
      disabled={ctaDisabled && kind !== "timer"}
      style={[styles.cta, kind === "timer" && styles.ctaTimer, layout === "landscape" && styles.ctaWide]}
    >
      <CtaLabel kind={kind} secondsLeft={secondsLeft} />
    </Press>
  );

  if (layout === "landscape") {
    return (
      <View style={styles.landWrap}>
        <View style={styles.landCard}>
          <Press haptic="none" onPress={onOpenProducts} style={styles.landTap}>
            <View style={styles.landThumbWrap}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.landThumb} contentFit="cover" />
              ) : (
                <View style={[styles.landThumb, styles.ph]} />
              )}
              <View style={styles.landBadge}>
                <Text style={styles.landBadgeTxt}>{t("live.featured")}</Text>
              </View>
            </View>
            <View style={styles.landBody}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {mode === "auction" ? startLabel : priceLabel}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {stockLabel}
              </Text>
            </View>
          </Press>
          {cta}
          {dots}
        </View>
        {menuOpen ? menu : null}
      </View>
    );
  }

  return (
    <View style={styles.portWrap}>
      <View style={styles.portCard}>
        <View style={styles.portHead}>
          <Text style={styles.portEyebrow}>{t("live.featured")}</Text>
          {dots}
        </View>
        <Press haptic="none" onPress={onOpenProducts} style={styles.portTap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.portImg} contentFit="cover" />
          ) : (
            <View style={[styles.portImg, styles.ph]} />
          )}
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.price}>{priceLabel}</Text>
          <Text style={styles.meta}>{stockLabel}</Text>
        </Press>
        {cta}
      </View>
      {menuOpen ? menu : null}
    </View>
  );
}

const CARD_BG = "rgba(8,10,16,0.82)";
const CARD_BORDER = "rgba(232,185,59,0.85)";

const styles = StyleSheet.create({
  portWrap: { alignItems: "flex-end", maxWidth: 168 },
  portCard: {
    width: 156,
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 8,
    gap: 6,
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
    aspectRatio: 1,
    borderRadius: 10,
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
  name: { color: "#fff", fontWeight: "800", fontSize: 14 },
  price: { color: "#fff", fontWeight: "800", fontSize: 15, fontVariant: ["tabular-nums"] },
  meta: { color: "rgba(255,255,255,0.86)", fontSize: 12, fontWeight: "600" },
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
