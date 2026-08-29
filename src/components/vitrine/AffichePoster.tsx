import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, BellOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { AfficheCanvas } from "./AfficheCanvas";
import { AfficheSoonOverlay } from "./AfficheSoonOverlay";
import { addAfficheReminder, hasAfficheReminder, removeAfficheReminder } from "../../lib/affiche-reminders";
import { afficheReminderAllowed } from "../../lib/affiche-reminders-logic";
import type { VitrineAffiche } from "../../lib/vitrine-affiche";
import { useAuth } from "../../context/auth";
import { NAVY } from "../../theme";

export function AffichePoster({ affiche }: { affiche: VitrineAffiche }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { guestMode, openAuth } = useAuth();
  const [reminded, setReminded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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
      title: affiche.layout.title || affiche.title || "KiDi+",
      body: t("publish.affiche.remindBody", {
        title: affiche.layout.title || affiche.title || affiche.sellerName,
      }),
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
      <AfficheSoonOverlay
        layout={affiche.layout}
        avatarUrl={affiche.avatarUrl}
        fallbackSeller={affiche.sellerName}
        fallbackShop={affiche.handle ? `@${affiche.handle.replace(/^@/, "")}` : ""}
        footer={
          <View style={{ paddingBottom: insets.bottom + 8, gap: 8 }}>
            <Press
              onPress={() => void toggleRemind()}
              disabled={busy || (!canRemind && !reminded)}
              style={styles.remind}
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
            <Text style={styles.hint}>
              {reminded ? t("publish.affiche.remindOnHint") : t("publish.affiche.remindHint")}
            </Text>
          </View>
        }
      />
      {toast ? (
        <View pointerEvents="none" style={[styles.toast, { bottom: insets.bottom + 110 }]}>
          <Text style={styles.toastTxt}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  remind: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: "#E8B93B",
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
