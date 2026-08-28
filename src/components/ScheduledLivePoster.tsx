// Affiche plein écran d'un live programmé (Home → À venir / Vitrine → Bientôt).
// Cover, vendeur, date/heure, catégorie, nb d'articles + bouton « Me rappeler ».
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, BellOff, CalendarClock, Package, Store, Tag, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Press } from "./Press";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import { supabase } from "../lib/supabase";
import { addLiveReminder, hasLiveReminder, removeLiveReminder } from "../lib/live-reminders";
import { formatMin, GOLD, NAVY } from "../theme";
import type { LiveStream } from "../mock/lives";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

/** Stable pseudo-count for fictitious demo lives. */
function demoProductCount(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 9) + 4;
}

export function ScheduledLivePoster({
  stream,
  active,
  showClose = true,
}: {
  stream: LiveStream;
  active?: boolean;
  /** Hide the X when rendered inside a tab (e.g. Vitrine → Bientôt). */
  showClose?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, guestMode, openAuth } = useAuth();
  const { closeOverlay } = useNav();
  const [reminded, setReminded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [productCount, setProductCount] = useState<number | null>(
    stream.fictitious ? demoProductCount(stream.id) : null,
  );
  const liveId = stream.liveId;

  useEffect(() => {
    if (!user?.id || !liveId || stream.fictitious) return;
    let alive = true;
    void hasLiveReminder(user.id, liveId).then((v) => {
      if (alive) setReminded(v);
    });
    return () => {
      alive = false;
    };
  }, [user?.id, liveId, stream.fictitious]);

  useEffect(() => {
    if (!liveId || stream.fictitious) return;
    let alive = true;
    void supabase
      .from("live_products")
      .select("id", { count: "exact", head: true })
      .eq("live_id", liveId)
      .then(({ count }) => {
        if (alive) setProductCount(count ?? 0);
      });
    return () => {
      alive = false;
    };
  }, [liveId, stream.fictitious]);

  const en = i18n.language.startsWith("en");
  const locale = en ? "en-GB" : "fr-FR";
  const startDate = stream.startedAt ? new Date(stream.startedAt) : null;
  const dateLabel = startDate
    ? startDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })
    : null;
  const timeLabel = startDate
    ? startDate.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    : null;
  const inLabel =
    stream.startsInMin != null
      ? formatMin(stream.startsInMin)
      : t("vitrine.badge.scheduled", { defaultValue: "Programmé" });

  const toggleRemind = async () => {
    if (guestMode || !user?.id) {
      openAuth();
      return;
    }
    if (stream.fictitious || !liveId) {
      // Demo lives: local-only toggle so the flow is demonstrable.
      setReminded((v) => !v);
      return;
    }
    setBusy(true);
    try {
      if (reminded) {
        const r = await removeLiveReminder(user.id, liveId);
        if (r.ok) setReminded(false);
      } else {
        const r = await addLiveReminder(user.id, liveId);
        if (r.ok) setReminded(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Image source={{ uri: stream.thumbnail }} style={FILL} contentFit="cover" />
      <LinearGradient colors={["rgba(0,0,0,0.55)", "transparent"]} style={styles.fadeTop} />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.9)"]} style={styles.fadeBottom} />

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <View style={[styles.chip, { backgroundColor: GOLD }]}>
          <CalendarClock size={13} color={NAVY} />
          <Text style={[styles.chipTxt, { color: NAVY }]}>
            {t("vitrine.tabs.soon", { defaultValue: "Bientôt" }).toUpperCase()} · {inLabel}
          </Text>
        </View>
        {showClose ? (
          <Press onPress={closeOverlay} style={styles.closeBtn} haptic="light">
            <X size={20} color="#fff" />
          </Press>
        ) : null}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 26 }]}>
        <View style={styles.sellerRow}>
          {stream.avatar ? (
            <Image source={{ uri: stream.avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: "#1C2440" }]} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.seller} numberOfLines={1}>
              {stream.seller}
            </Text>
            {stream.handle ? (
              <View style={styles.shopRow}>
                <Store size={12} color="rgba(255,255,255,0.75)" />
                <Text style={styles.shop} numberOfLines={1}>
                  @{stream.handle}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {stream.title}
        </Text>

        {dateLabel && timeLabel ? (
          <View style={styles.whenCard}>
            <CalendarClock size={18} color={GOLD} />
            <View>
              <Text style={styles.whenDate}>{dateLabel}</Text>
              <Text style={styles.whenTime}>{timeLabel}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <View style={[styles.chip, styles.chipDark]}>
            <Tag size={12} color="#fff" />
            <Text style={styles.chipTxt}>{stream.category}</Text>
          </View>
          {productCount != null ? (
            <View style={[styles.chip, styles.chipDark]}>
              <Package size={12} color="#fff" />
              <Text style={styles.chipTxt}>
                {t("schedule.productCount", {
                  defaultValue: "{{count}} articles",
                  count: productCount,
                })}
              </Text>
            </View>
          ) : null}
        </View>

        <Press onPress={() => void toggleRemind()} disabled={busy} style={styles.cta}>
          {busy ? (
            <ActivityIndicator color={NAVY} />
          ) : reminded ? (
            <BellOff size={16} color={NAVY} />
          ) : (
            <Bell size={16} color={NAVY} />
          )}
          <Text style={styles.ctaTxt}>
            {reminded
              ? t("vitrine.cta.reminded", { defaultValue: "Rappel activé" })
              : t("vitrine.cta.remind", { defaultValue: "Me rappeler" })}
          </Text>
        </Press>
        <Text style={styles.hint}>
          {t("schedule.reminderHint", { defaultValue: "On te préviendra dès que le live commence." })}
        </Text>
        <Text style={styles.swipeHint}>
          {t("schedule.swipeHint", { defaultValue: "Swipe pour voir les prochains lives ↑" })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  fadeTop: { position: "absolute", left: 0, right: 0, top: 0, height: "22%" },
  fadeBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: "58%" },
  topBar: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 6,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipDark: { backgroundColor: "rgba(0,0,0,0.55)" },
  chipTxt: { color: "#fff", fontSize: 11.5, fontWeight: "800" },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    zIndex: 6,
    gap: 10,
  },
  sellerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: GOLD,
  },
  seller: { color: "#fff", fontSize: 17, fontWeight: "900" },
  shopRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  shop: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "700" },
  title: { color: "rgba(255,255,255,0.95)", fontSize: 15, fontWeight: "700" },
  whenCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  whenDate: { color: "#fff", fontSize: 13.5, fontWeight: "800", textTransform: "capitalize" },
  whenTime: { color: GOLD, fontSize: 15, fontWeight: "900", marginTop: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  cta: {
    marginTop: 4,
    height: 48,
    borderRadius: 999,
    backgroundColor: GOLD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaTxt: { color: NAVY, fontSize: 15, fontWeight: "800" },
  hint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    textAlign: "center",
    fontWeight: "600",
  },
  swipeHint: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10.5,
    textAlign: "center",
    fontWeight: "600",
  },
});
