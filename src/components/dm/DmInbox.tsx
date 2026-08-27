import { useCallback, useEffect, useState } from "react";
import { useRef } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Press } from "../Press";
import { useAuth } from "../../context/auth";
import { useAppTheme } from "../../context/theme";
import {
  listMyDmThreads,
  subscribeMyDmInbox,
  type DmChatTarget,
  type DmThreadRow,
} from "../../lib/dm";
import { listMyBlockedIds } from "../../lib/moderation";
import { resolveAvatarUrl } from "../../lib/storage";
import { GOLD, NAVY, initials } from "../../theme";

function timeAgo(iso: string, locale: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  const en = locale.toLowerCase().startsWith("en");
  if (min < 1) return en ? "now" : "à l’instant";
  if (min < 60) return en ? `${min} min` : `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return en ? `${h} h` : `${h} h`;
  const d = Math.floor(h / 24);
  return en ? `${d} d` : `${d} j`;
}

export function DmInbox({
  onOpenThread,
  focusThreadId,
}: {
  onOpenThread: (target: DmChatTarget) => void;
  focusThreadId?: string | null;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [rows, setRows] = useState<DmThreadRow[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const openedRef = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    const [inbox, blocked] = await Promise.all([listMyDmThreads(50), listMyBlockedIds()]);
    const filtered = inbox.rows.filter((r) => !blocked.has(r.other_id));
    setRows(filtered);
    setLoading(false);
    const map: Record<string, string | null> = {};
    await Promise.all(
      filtered.map(async (r) => {
        map[r.id] = await resolveAvatarUrl(r.other_avatar_url);
      }),
    );
    setAvatars(map);
  }, [user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!user?.id) return;
    return subscribeMyDmInbox(user.id, () => {
      void reload();
    });
  }, [user?.id, reload]);

  useEffect(() => {
    if (!focusThreadId || loading) return;
    if (openedRef.current === focusThreadId) return;
    const row = rows.find((r) => r.id === focusThreadId);
    if (!row) return;
    openedRef.current = focusThreadId;
    onOpenThread({
      otherId: row.other_id,
      otherName: row.other_name || row.other_handle || "User",
      otherAvatarUrl: row.other_avatar_url,
      otherIsVerified: row.other_is_verified,
      threadId: row.id,
    });
  }, [focusThreadId, loading, rows, onOpenThread]);

  if (loading) return <ActivityIndicator color={GOLD} style={{ marginTop: 32 }} />;
  if (rows.length === 0) {
    return (
      <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 32, paddingHorizontal: 24 }}>
        {t("dm.empty", { defaultValue: "Aucun message pour le moment." })}
      </Text>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      renderItem={({ item }) => {
        const mine = item.last_sender_id === user?.id;
        const preview = item.last_message_preview || "";
        const av = avatars[item.id];
        return (
          <Press
            onPress={() =>
              onOpenThread({
                otherId: item.other_id,
                otherName: item.other_name || item.other_handle || "User",
                otherAvatarUrl: item.other_avatar_url,
                otherIsVerified: item.other_is_verified,
                threadId: item.id,
              })
            }
            style={[styles.row, { backgroundColor: colors.card, borderColor: item.unread > 0 ? GOLD : colors.border }]}
          >
            {av ? (
              <Image source={{ uri: av }} style={styles.av} />
            ) : (
              <View style={[styles.av, { backgroundColor: NAVY, alignItems: "center", justifyContent: "center" }]}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
                  {initials(item.other_name || item.other_handle || "?")}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontWeight: "800", color: colors.foreground, flex: 1 }} numberOfLines={1}>
                  {item.other_name || item.other_handle || "User"}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                  {timeAgo(item.last_message_at, i18n.language)}
                </Text>
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                {mine ? `${t("dm.you", { defaultValue: "Toi" })} : ${preview}` : preview}
              </Text>
            </View>
            {item.unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{item.unread > 9 ? "9+" : item.unread}</Text>
              </View>
            ) : null}
          </Press>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    minHeight: 64,
  },
  av: { width: 44, height: 44, borderRadius: 22 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeTxt: { color: NAVY, fontWeight: "900", fontSize: 11 },
});
