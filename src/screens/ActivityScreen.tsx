import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, ChevronLeft, Gift, MessageCircle, Package, Radio, Trophy } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../components/Press";
import { SurfaceCard } from "../components/SurfaceCard";
import { DmInbox } from "../components/dm/DmInbox";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { useNav } from "../context/navigation";
import { usePush } from "../context/push";
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from "../lib/notifications";
import { payloadFromNotificationRow } from "../lib/push";
import type { DmChatTarget } from "../lib/dm";
import { GOLD } from "../theme";

function iconFor(kind: string) {
  if (/order|ship|deliver/i.test(kind)) return Package;
  if (/live/i.test(kind)) return Radio;
  if (/gift/i.test(kind)) return Gift;
  if (/auction|win/i.test(kind)) return Trophy;
  if (/chat|message|dm/i.test(kind)) return MessageCircle;
  return Bell;
}

function timeAgo(iso: string, locale: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  const en = locale.toLowerCase().startsWith("en");
  if (min < 1) return en ? "now" : "à l’instant";
  if (min < 60) return en ? `${min} min ago` : `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return en ? `${h} h ago` : `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return en ? `${d} d ago` : `il y a ${d} j`;
}

type ActivityTab = "notifs" | "messages";

export function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const { findOverlay, closeOverlay, openOverlay } = useNav();
  const { openFromPush } = usePush();
  const { user, guestMode, openAuth } = useAuth();
  const activity = findOverlay("activity");
  const initialTab: ActivityTab = activity?.tab === "messages" ? "messages" : "notifs";
  const focusThreadId = activity?.threadId ?? null;
  const [tab, setTab] = useState<ActivityTab>(initialTab);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activity) return;
    if (activity.tab === "messages") setTab("messages");
    else if (activity.tab === "notifs") setTab("notifs");
  }, [activity?.tab, activity?.threadId]);

  const reload = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    const res = await fetchMyNotifications(60);
    setRows(res.rows);
    setUnread(res.unread);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openRow = (n: NotificationRow) => {
    if (!n.read_at) {
      setRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
      void markNotificationRead(n.id);
    }
    openFromPush(payloadFromNotificationRow(n));
  };

  const openThread = useCallback(
    (target: DmChatTarget) => {
      openOverlay({ kind: "dm-chat", target });
    },
    [openOverlay],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Press onPress={closeOverlay} style={styles.back}>
          <ChevronLeft size={24} color={colors.foreground} />
          <Text style={{ fontWeight: "700", color: colors.foreground }}>{t("common.back")}</Text>
        </Press>
        <Text style={[styles.title, { color: colors.foreground }]}>{t("activity.title")}</Text>
        <View style={{ width: 72, alignItems: "flex-end" }}>
          {tab === "notifs" && unread > 0 ? (
            <Press
              onPress={() => {
                setRows((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
                setUnread(0);
                void markAllNotificationsRead();
              }}
              style={{ minHeight: 32, minWidth: 0 }}
            >
              <Text style={{ color: GOLD, fontWeight: "700", fontSize: 12 }}>
                {t("activity.markAll", { defaultValue: "Tout lire" })}
              </Text>
            </Press>
          ) : null}
        </View>
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(
          [
            ["notifs", t("activity.tabs.notifs", { defaultValue: "Notifs" })],
            ["messages", t("activity.tabs.messages", { defaultValue: "Messages" })],
          ] as const
        ).map(([k, label]) => (
          <Press
            key={k}
            onPress={() => {
              if (guestMode && k === "messages") return openAuth();
              setTab(k);
            }}
            style={[styles.tab, tab === k && { borderBottomColor: GOLD }]}
          >
            <Text
              style={{
                fontWeight: tab === k ? "800" : "600",
                color: tab === k ? colors.foreground : colors.mutedForeground,
              }}
            >
              {label}
            </Text>
          </Press>
        ))}
      </View>

      {tab === "messages" ? (
        guestMode || !user ? (
          <View style={{ padding: 24, alignItems: "center", gap: 12 }}>
            <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>
              {t("dm.signIn", { defaultValue: "Connecte-toi pour voir tes messages." })}
            </Text>
            <Press onPress={() => openAuth()} style={styles.signInBtn}>
              <Text style={{ fontWeight: "800", color: "#10162B" }}>{t("auth.welcome.signIn")}</Text>
            </Press>
          </View>
        ) : (
          <DmInbox onOpenThread={openThread} focusThreadId={focusThreadId} />
        )
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {loading ? (
            <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} />
          ) : rows.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 24 }}>
              {t("activity.empty.notifications")}
            </Text>
          ) : (
            rows.map((n) => {
              const Icon = iconFor(n.kind);
              const isUnread = !n.read_at;
              return (
                <SurfaceCard
                  key={n.id}
                  onPress={() => openRow(n)}
                  style={isUnread ? { borderColor: GOLD } : undefined}
                >
                  <View style={styles.card}>
                    <View style={styles.icon}>
                      <Icon size={18} color={GOLD} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ flex: 1, fontWeight: isUnread ? "800" : "600", color: colors.foreground }}>
                          {n.title}
                        </Text>
                        {isUnread ? <View style={styles.dot} /> : null}
                      </View>
                      {n.body ? (
                        <Text style={{ color: colors.mutedForeground, marginTop: 2 }}>{n.body}</Text>
                      ) : null}
                      <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 4 }}>
                        {timeAgo(n.created_at, i18n.language)}
                      </Text>
                    </View>
                  </View>
                </SurfaceCard>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, zIndex: 50 },
  back: { flexDirection: "row", alignItems: "center", minWidth: 0, paddingRight: 8 },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  tabs: { flexDirection: "row", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, height: 42, borderBottomWidth: 2, borderBottomColor: "transparent" },
  card: { flexDirection: "row", gap: 12 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(232,185,59,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GOLD },
  signInBtn: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: GOLD,
  },
});
