import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, BellOff, Calendar, Clock, MoreHorizontal, Package, Share2, Store, Tag } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Press } from "../Press";
import { AfficheCanvas } from "./AfficheCanvas";
import { shareVitrinePost } from "./VitrineCommentsSheet";
import { ReportSheet } from "../moderation/ReportSheet";
import { addAfficheReminder, hasAfficheReminder, removeAfficheReminder } from "../../lib/affiche-reminders";
import {
  afficheReminderAllowed,
  formatAfficheCountdown,
  formatAfficheWhenParts,
} from "../../lib/affiche-reminders-logic";
import type { VitrineAffiche } from "../../lib/vitrine-affiche";
import { useAuth } from "../../context/auth";
import { blockUserAndNotify } from "../../lib/moderation";
import { encodeContentReportNote } from "../../lib/admin-takedown-logic";
import { GOLD, initials, NAVY } from "../../theme";
import { isHttpUrl } from "../../lib/storage";

export function AffichePoster({
  affiche,
  preview = false,
}: {
  affiche: VitrineAffiche;
  preview?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { user, guestMode, openAuth } = useAuth();
  const [reminded, setReminded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const locale = i18n.language.startsWith("en") ? "en-GB" : "fr-FR";
  const parts = formatAfficheWhenParts(affiche.layout.eventAt, locale);
  const badge = formatAfficheCountdown(affiche.layout.eventAt, t("vitrine.tabs.soon"), now);
  const canRemind = afficheReminderAllowed(affiche.layout.eventAt).ok;
  const shop = affiche.shopName || `${affiche.sellerName} Boutique`;
  const title = affiche.title || affiche.layout.title;
  const category = affiche.category || affiche.layout.category;
  const articles = affiche.articleCount;
  const own = !!user?.id && user.id === affiche.userId;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (preview) return;
    let alive = true;
    void hasAfficheReminder(affiche.id).then((v) => {
      if (alive) setReminded(v);
    });
    return () => {
      alive = false;
    };
  }, [affiche.id, preview]);

  const toggleRemind = async () => {
    if (preview) return;
    if (guestMode) {
      openAuth("signup");
      return;
    }
    if (busy) return;
    setBusy(true);
    if (reminded) {
      await removeAfficheReminder(affiche.id);
      setReminded(false);
      setBusy(false);
      return;
    }
    const gate = afficheReminderAllowed(affiche.layout.eventAt);
    if (!gate.ok) {
      Alert.alert(
        "KiDi+",
        gate.reason === "past" ? t("publish.affiche.eventPast") : t("publish.affiche.needWhen"),
      );
      setBusy(false);
      return;
    }
    const res = await addAfficheReminder({
      afficheId: affiche.id,
      eventAt: affiche.layout.eventAt!,
      title: title || "KiDi+",
      body: t("publish.affiche.remindBody", { title: title || affiche.sellerName }),
    });
    setBusy(false);
    if (!res.ok) {
      Alert.alert(
        "KiDi+",
        res.error === "denied"
          ? t("push.deniedBody", { defaultValue: "Active les notifications dans Réglages." })
          : t("publish.affiche.remindFail"),
      );
      return;
    }
    setReminded(true);
  };

  const openMore = () => {
    if (preview) return;
    if (own) {
      Alert.alert(affiche.sellerName, undefined, [{ text: t("common.cancel"), style: "cancel" }]);
      return;
    }
    Alert.alert(affiche.sellerName, undefined, [
      { text: t("report.action"), onPress: () => setReportOpen(true) },
      {
        text: t("block.action"),
        style: "destructive",
        onPress: () => {
          if (!affiche.userId) return;
          void blockUserAndNotify(affiche.userId, {
            handle: affiche.handle,
            displayName: affiche.sellerName,
            avatarUrl: affiche.avatarUrl,
          }).then((r) => {
            if (!r.ok) Alert.alert("KiDi+", r.error ?? t("block.failed"));
          });
        },
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  return (
    <View style={{ width, height, backgroundColor: "#05060a" }}>
      <AfficheCanvas layout={affiche.layout} width={width} height={height} />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.92)"]}
        locations={[0.42, 0.62, 1]}
        style={styles.fadeBottom}
        pointerEvents="none"
      />

      {badge ? (
        <View style={[styles.badge, { top: insets.top + 58 }]}>
          <Calendar size={13} color={NAVY} />
          <Text style={styles.badgeTxt}>{badge}</Text>
        </View>
      ) : null}

      <View pointerEvents="box-none" style={[styles.side, { bottom: insets.bottom + 168 }]}>
        <Press
          onPress={() => {
            if (!preview) void shareVitrinePost(affiche.id, title);
          }}
          style={styles.sideBtn}
        >
          <Share2 size={22} color="#fff" />
        </Press>
        <Press onPress={openMore} style={styles.sideBtn}>
          <MoreHorizontal size={22} color="#fff" />
        </Press>
      </View>

      <View pointerEvents="box-none" style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.sellerRow}>
          {isHttpUrl(affiche.avatarUrl) ? (
            <Image source={{ uri: affiche.avatarUrl }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.ini}>{initials(affiche.sellerName)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {affiche.sellerName}
            </Text>
            <View style={styles.shopRow}>
              <Store size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.shop} numberOfLines={1}>
                {shop}
              </Text>
            </View>
          </View>
        </View>

        {title ? (
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        ) : null}

        {parts ? (
          <View style={styles.whenCard}>
            <View style={styles.whenLine}>
              <Calendar size={16} color={GOLD} />
              <Text style={styles.whenDate}>{parts.date}</Text>
            </View>
            <View style={styles.whenLine}>
              <Clock size={16} color={GOLD} />
              <Text style={styles.whenTime}>{parts.time}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.pills}>
          {category ? (
            <View style={styles.pill}>
              <Tag size={12} color="#fff" />
              <Text style={styles.pillTxt}>{category}</Text>
            </View>
          ) : null}
          <View style={styles.pill}>
            <Package size={12} color="#fff" />
            <Text style={styles.pillTxt}>
              {t("schedule.productCount", { defaultValue: "{{count}} articles", count: articles })}
            </Text>
          </View>
        </View>

        <Press
          onPress={() => void toggleRemind()}
          disabled={preview || busy || (!canRemind && !reminded)}
          style={[styles.remind, (preview || (!canRemind && !reminded)) && { opacity: 0.7 }]}
        >
          {busy ? (
            <ActivityIndicator color={NAVY} />
          ) : reminded ? (
            <BellOff size={18} color={NAVY} />
          ) : (
            <Bell size={18} color={NAVY} />
          )}
          <Text style={styles.remindTxt}>
            {reminded ? t("vitrine.cta.reminded") : t("vitrine.cta.remind")}
          </Text>
        </Press>
        <Text style={styles.hint}>{t("publish.affiche.publicHint")}</Text>
      </View>

      {preview ? null : (
        <ReportSheet
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="user"
          targetId={affiche.userId || ""}
          defaultNote={encodeContentReportNote("vitrine_post", affiche.id, `Affiche: ${affiche.id}`)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fadeBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: "48%" },
  badge: {
    position: "absolute",
    left: 14,
    zIndex: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  badgeTxt: { color: NAVY, fontWeight: "900", fontSize: 11.5, letterSpacing: 0.3 },
  side: { position: "absolute", right: 12, zIndex: 7, gap: 12, alignItems: "center" },
  sideBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: { position: "absolute", left: 16, right: 16, bottom: 0, zIndex: 6, gap: 10 },
  sellerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: GOLD },
  avatarFallback: { backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  ini: { color: "#fff", fontWeight: "800" },
  name: { color: "#fff", fontSize: 17, fontWeight: "900" },
  shopRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  shop: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "700" },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  whenCard: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(20,20,20,0.72)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  whenLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  whenDate: { color: "#fff", fontSize: 14, fontWeight: "800", textTransform: "capitalize" },
  whenTime: { color: "#fff", fontSize: 14, fontWeight: "800" },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
  remind: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: GOLD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  remindTxt: { color: NAVY, fontWeight: "900", fontSize: 16 },
  hint: { color: "rgba(255,255,255,0.62)", textAlign: "center", fontWeight: "600", fontSize: 12 },
});
