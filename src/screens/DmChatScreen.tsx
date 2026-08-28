import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, MoreHorizontal, Send } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Press } from "../components/Press";
import { ReportSheet } from "../components/moderation/ReportSheet";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { useNav } from "../context/navigation";
import {
  findDmThread,
  listDmMessages,
  markDmThreadRead,
  sendDm,
  subscribeDmThread,
  type DmChatTarget,
  type DmMessageRow,
} from "../lib/dm";
import { blockUserAndNotify, listMyBlockedIds, unblockUser } from "../lib/moderation";
import { resolveAvatarUrl } from "../lib/storage";
import { GOLD, NAVY, initials } from "../theme";

export function DmChatScreen({ target, onClose }: { target: DmChatTarget; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const [threadId, setThreadId] = useState<string | null>(target.threadId ?? null);
  const [messages, setMessages] = useState<DmMessageRow[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(target.otherAvatarUrl ?? null);
  const [reportOpen, setReportOpen] = useState(false);
  const [iBlockedThem, setIBlockedThem] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    void resolveAvatarUrl(target.otherAvatarUrl ?? null).then(setAvatar);
  }, [target.otherAvatarUrl]);

  useEffect(() => {
    void listMyBlockedIds().then((ids) => setIBlockedThem(ids.has(target.otherId)));
  }, [target.otherId]);

  const reload = useCallback(async () => {
    let tid = threadId;
    if (!tid) {
      tid = await findDmThread(target.otherId);
      if (tid) setThreadId(tid);
    }
    if (!tid) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const rows = await listDmMessages(tid);
    setMessages(rows);
    setLoading(false);
    void markDmThreadRead(tid);
  }, [threadId, target.otherId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!threadId) return;
    return subscribeDmThread(threadId, () => {
      void reload();
    });
  }, [threadId, reload]);

  const send = async () => {
    const text = body.trim();
    if (!text || sending || !user?.id) return;
    if (iBlockedThem) {
      Alert.alert("KiDi+", t("dm.blockedNotice", { defaultValue: "Tu as bloqué cet utilisateur." }));
      return;
    }
    setSending(true);
    const res = await sendDm(target.otherId, text);
    setSending(false);
    if (!res.ok) {
      const msg =
        res.error === "blocked"
          ? t("dm.errors.blocked", { defaultValue: "Tu ne peux pas écrire à cet utilisateur." })
          : res.error === "suspended"
            ? t("dm.errors.suspended", { defaultValue: "Compte suspendu." })
            : t("dm.errors.send", { defaultValue: "Envoi impossible." });
      Alert.alert("KiDi+", msg);
      return;
    }
    setBody("");
    setThreadId(res.threadId);
    setMessages((prev) => [...prev, res.message]);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  const doBlock = () => {
    Alert.alert(t("block.action"), t("block.confirm"), [
      { text: t("block.cancel"), style: "cancel" },
      {
        text: t("block.action"),
        style: "destructive",
        onPress: () => {
          void blockUserAndNotify(target.otherId, {
            displayName: target.otherName,
            avatarUrl: target.otherAvatarUrl,
          }).then((r) => {
            if (r.ok) {
              setIBlockedThem(true);
              Alert.alert("KiDi+", t("block.blocked"), [{ text: "OK", onPress: onClose }]);
            } else {
              Alert.alert("KiDi+", r.error ?? t("block.failed"));
            }
          });
        },
      },
    ]);
  };

  const doUnblock = () => {
    void unblockUser(target.otherId).then((r) => {
      if (r.ok) {
        setIBlockedThem(false);
        Alert.alert("KiDi+", t("block.unblocked"));
      } else {
        Alert.alert("KiDi+", r.error ?? t("block.failed"));
      }
    });
  };

  const onMenu = () => {
    Alert.alert(target.otherName, undefined, [
      {
        text: t("report.action"),
        onPress: () => setReportOpen(true),
      },
      iBlockedThem
        ? { text: t("block.unblock"), onPress: doUnblock }
        : { text: t("block.action"), style: "destructive" as const, onPress: doBlock },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.head, { zIndex: 50 }]}>
        <Press onPress={onClose} style={styles.back} hitSlop={12}>
          <ChevronLeft size={24} color={colors.foreground} />
        </Press>
        <Press onPress={onMenu} style={styles.headCenter}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.av} />
          ) : (
            <View style={[styles.av, { backgroundColor: NAVY, alignItems: "center", justifyContent: "center" }]}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{initials(target.otherName)}</Text>
            </View>
          )}
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {target.otherName}
          </Text>
        </Press>
        <Press onPress={onMenu} style={styles.back} hitSlop={8}>
          <MoreHorizontal size={22} color={colors.foreground} />
        </Press>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        {loading ? (
          <ActivityIndicator color={GOLD} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1, justifyContent: "flex-end" }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40 }}>
                {t("dm.emptyThread", { defaultValue: "Dis bonjour 👋" })}
              </Text>
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              return (
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs, { backgroundColor: mine ? GOLD : colors.card }]}>
                  <Text style={{ color: mine ? NAVY : colors.foreground, fontWeight: "600", fontSize: 15 }}>
                    {item.body}
                  </Text>
                </View>
              );
            }}
          />
        )}

        {iBlockedThem ? (
          <View style={[styles.blockedBanner, { backgroundColor: colors.muted }]}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center", fontWeight: "600" }}>
              {t("dm.blockedNotice", { defaultValue: "Tu as bloqué cet utilisateur." })}
            </Text>
            <Press onPress={doUnblock} style={{ marginTop: 6 }}>
              <Text style={{ color: GOLD, fontWeight: "800", textAlign: "center", fontSize: 13 }}>
                {t("block.unblock")}
              </Text>
            </Press>
          </View>
        ) : (
          <View
            style={[
              styles.composer,
              { paddingBottom: insets.bottom + 8, borderTopColor: colors.border, backgroundColor: colors.background },
            ]}
          >
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={t("dm.placeholder", { defaultValue: "Écris un message…" })}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              multiline
            />
            <Press
              onPress={() => void send()}
              disabled={sending || !body.trim()}
              style={[styles.send, { opacity: body.trim() ? 1 : 0.4 }]}
            >
              {sending ? <ActivityIndicator color={NAVY} /> : <Send size={18} color={NAVY} />}
            </Press>
          </View>
        )}
      </KeyboardAvoidingView>

      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="user"
        targetId={target.otherId}
        defaultNote={`Reported from DM · ${target.otherName}`}
      />
    </View>
  );
}

/** Convenience when opened as nav overlay. */
export function DmChatOverlay() {
  const { findOverlay, closeOverlay } = useNav();
  const entry = findOverlay("dm-chat");
  if (!entry) return null;
  return <DmChatScreen target={entry.target} onClose={closeOverlay} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    minHeight: 52,
  },
  back: { width: 40, height: 40, minWidth: 40, minHeight: 40, alignItems: "center", justifyContent: "center" },
  headCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 },
  av: { width: 32, height: 32, borderRadius: 16 },
  name: { fontSize: 16, fontWeight: "800", flex: 1 },
  bubble: {
    maxWidth: "82%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mine: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  theirs: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  blockedBanner: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 14,
    padding: 12,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
});
