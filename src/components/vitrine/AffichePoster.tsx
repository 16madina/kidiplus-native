import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, BellOff, CalendarClock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Press } from "../Press";
import { AfficheCanvas } from "./AfficheCanvas";
import { addAfficheReminder, hasAfficheReminder, removeAfficheReminder } from "../../lib/affiche-reminders";
import { afficheReminderAllowed, formatAfficheWhen } from "../../lib/affiche-reminders-logic";
import type { VitrineAffiche } from "../../lib/vitrine-affiche";
import { useAuth } from "../../context/auth";
import { GOLD, initials, NAVY } from "../../theme";
import { isHttpUrl } from "../../lib/storage";

export function AffichePoster({ affiche }: { affiche: VitrineAffiche }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { guestMode, openAuth } = useAuth();
  const [reminded, setReminded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const locale = i18n.language.startsWith("en") ? "en-GB" : "fr-FR";
  const whenLabel = formatAfficheWhen(affiche.layout.eventAt, locale);
  const canRemind = afficheReminderAllowed(affiche.layout.eventAt).ok;

  useEffect(() => {
    let alive = true;
    void hasAfficheReminder(affiche.id).then((v) => {
      if (alive) setReminded(v);
    });
    return () => {
      alive = false;
    };
  }, [affiche.id]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  const toggleRemind = async () => {
    if (guestMode) {
      openAuth("signup");
      return;
    }
    if (busy) return;
    setBusy(true);
    if (reminded) {
      await removeAfficheReminder(affiche.id);
      setReminded(false);
      setToast(t("vitrine.cta.remind"));
      setBusy(false);
      return;
    }
    const gate = afficheReminderAllowed(affiche.layout.eventAt);
    if (!gate.ok) {
      setToast(
        gate.reason === "past" ? t("publish.affiche.eventPast") : t("publish.affiche.needWhen"),
      );
      setBusy(false);
      return;
    }
    const res = await addAfficheReminder({
      afficheId: affiche.id,
      eventAt: affiche.layout.eventAt!,
      title: affiche.title || "KiDi+",
      body: t("publish.affiche.remindBody", { title: affiche.title || affiche.sellerName }),
    });
    setBusy(false);
    if (!res.ok) {
      setToast(
        res.error === "denied"
          ? t("push.deniedBody", { defaultValue: "Active les notifications dans Réglages." })
          : t("publish.affiche.remindFail"),
      );
      return;
    }
    setReminded(true);
    setToast(t("schedule.reminderSet"));
  };

  return (
    <View style={{ width, height, backgroundColor: "#05060a" }}>
      <AfficheCanvas layout={affiche.layout} width={width} height={height} />
      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "transparent", "rgba(0,0,0,0.78)"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[styles.top, { paddingTop: insets.top + 56 }]}>
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{t("publish.modes.affiche")}</Text>
        </View>
        {isHttpUrl(affiche.avatarUrl) ? (
          <Image source={{ uri: affiche.avatarUrl }} style={styles.av} />
        ) : (
          <View style={[styles.av, styles.avFallback]}>
            <Text style={styles.ini}>{initials(affiche.sellerName)}</Text>
          </View>
        )}
        <Text style={styles.name}>{affiche.sellerName}</Text>
        {affiche.handle ? <Text style={styles.handle}>@{affiche.handle}</Text> : null}
        <Text style={styles.title}>{affiche.title}</Text>
        {whenLabel ? (
          <View style={styles.when}>
            <CalendarClock size={16} color={GOLD} />
            <Text style={styles.whenTxt}>{whenLabel}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        <Press onPress={() => void toggleRemind()} disabled={busy || (!canRemind && !reminded)} style={styles.remind}>
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
        <Text style={styles.hint}>
          {reminded ? t("publish.affiche.remindOnHint") : t("publish.affiche.remindHint")}
        </Text>
      </View>
      {toast ? (
        <View pointerEvents="none" style={[styles.toast, { bottom: insets.bottom + 110 }]}>
          <Text style={styles.toastTxt}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", left: 16, right: 16, gap: 8 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: GOLD,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeTxt: { color: NAVY, fontWeight: "900", fontSize: 11, letterSpacing: 0.6 },
  av: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: GOLD },
  avFallback: { backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  ini: { color: "#fff", fontWeight: "800" },
  name: { color: "#fff", fontWeight: "800", fontSize: 16 },
  handle: { color: "rgba(255,255,255,0.7)", fontWeight: "600" },
  title: { color: "#fff", fontWeight: "700", fontSize: 20, marginTop: 8 },
  when: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  whenTxt: { color: "#fff", fontWeight: "700", textTransform: "capitalize" },
  bottom: { position: "absolute", left: 16, right: 16, bottom: 0, gap: 8 },
  remind: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: GOLD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  remindTxt: { color: NAVY, fontWeight: "900", fontSize: 16 },
  hint: { color: "rgba(255,255,255,0.7)", textAlign: "center", fontWeight: "600", fontSize: 12 },
  toast: {
    position: "absolute",
    left: 24,
    right: 24,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toastTxt: { color: "#fff", textAlign: "center", fontWeight: "700" },
});
