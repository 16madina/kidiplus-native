// Full-screen TikTok-style slides for Vitrine → En direct / Bientôt.
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, BellOff, CalendarClock, Radio, Users } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Press } from "../Press";
import { useAuth } from "../../context/auth";
import {
  addLiveReminder,
  hasLiveReminder,
  removeLiveReminder,
} from "../../lib/live-reminders";
import { formatMin, formatViewers, GOLD, LIVE_RED, NAVY } from "../../theme";
import type { LiveStream } from "../../mock/lives";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

export function VitrineLiveSlide({
  stream,
  width,
  height,
  onJoin,
}: {
  stream: LiveStream;
  width: number;
  height: number;
  onJoin: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ width, height, backgroundColor: "#000" }}>
      <Image source={{ uri: stream.thumbnail }} style={FILL} contentFit="cover" />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.82)"]} style={styles.fade} />
      <View style={[styles.badges, { top: insets.top + 64 }]}>
        {stream.fictitious ? (
          <View style={[styles.chip, { backgroundColor: "rgba(60,70,100,0.9)" }]}>
            <Text style={styles.chipTxt}>{t("vitrine.badge.demo", { defaultValue: "Démo" })}</Text>
          </View>
        ) : (
          <View style={[styles.chip, { backgroundColor: LIVE_RED }]}>
            <Text style={styles.chipTxt}>LIVE</Text>
          </View>
        )}
        <View style={[styles.chip, styles.chipDark]}>
          <Users size={12} color="#fff" />
          <Text style={styles.chipTxt}>{formatViewers(stream.viewers)}</Text>
        </View>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 28 }]}>
        <Text style={styles.seller}>{stream.seller}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {stream.title}
        </Text>
        <Press onPress={onJoin} style={styles.cta}>
          <Radio size={16} color={NAVY} />
          <Text style={styles.ctaTxt}>{t("vitrine.cta.join")}</Text>
        </Press>
      </View>
    </View>
  );
}

export function VitrineSoonSlide({
  stream,
  width,
  height,
}: {
  stream: LiveStream;
  width: number;
  height: number;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, guestMode, openAuth } = useAuth();
  const [reminded, setReminded] = useState(false);
  const [busy, setBusy] = useState(false);
  const liveId = stream.liveId;

  useEffect(() => {
    if (!user?.id || !liveId || stream.fictitious) {
      setReminded(false);
      return;
    }
    let alive = true;
    void hasLiveReminder(user.id, liveId).then((v) => {
      if (alive) setReminded(v);
    });
    return () => {
      alive = false;
    };
  }, [user?.id, liveId, stream.fictitious]);

  const whenLabel = (() => {
    if (stream.startedAt) {
      try {
        return new Date(stream.startedAt).toLocaleString(i18n.language.startsWith("en") ? "en-GB" : "fr-FR", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        /* fall through */
      }
    }
    if (stream.startsInMin != null) return formatMin(stream.startsInMin);
    return t("vitrine.badge.scheduled", { defaultValue: "Programmé" });
  })();

  const toggleRemind = async () => {
    if (guestMode || !user?.id) {
      openAuth();
      return;
    }
    if (!liveId || stream.fictitious) return;
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
    <View style={{ width, height, backgroundColor: "#000" }}>
      <Image source={{ uri: stream.thumbnail }} style={FILL} contentFit="cover" />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.82)"]} style={styles.fade} />
      <View style={[styles.badges, { top: insets.top + 64 }]}>
        <View style={[styles.chip, { backgroundColor: GOLD }]}>
          <CalendarClock size={12} color={NAVY} />
          <Text style={[styles.chipTxt, { color: NAVY }]}>{whenLabel}</Text>
        </View>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 28 }]}>
        <Text style={styles.seller}>{stream.seller}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {stream.title}
        </Text>
        <Press onPress={() => void toggleRemind()} disabled={busy} style={styles.cta}>
          {busy ? (
            <ActivityIndicator color={NAVY} />
          ) : reminded ? (
            <BellOff size={16} color={NAVY} />
          ) : (
            <Bell size={16} color={NAVY} />
          )}
          <Text style={styles.ctaTxt}>
            {reminded ? t("vitrine.cta.reminded") : t("vitrine.cta.remind")}
          </Text>
        </Press>
        <Text style={styles.hint}>{t("schedule.reminderHint")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "48%",
  },
  badges: {
    position: "absolute",
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 5,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipDark: { backgroundColor: "rgba(0,0,0,0.5)" },
  chipTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    zIndex: 6,
  },
  seller: { color: "#fff", fontSize: 17, fontWeight: "800" },
  title: { color: "rgba(255,255,255,0.92)", fontSize: 14, marginTop: 4, fontWeight: "600" },
  cta: {
    marginTop: 14,
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
    marginTop: 8,
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    textAlign: "center",
    fontWeight: "600",
  },
});
