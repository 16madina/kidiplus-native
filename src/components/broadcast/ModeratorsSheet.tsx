import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Shield, Trash2, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import {
  addModerator,
  fetchFollowerModeratorCandidates,
  fetchModeratorCandidatesByIds,
  fetchModerators,
  MAX_LIVE_MODERATORS,
  removeModerator,
  searchModeratorCandidates,
  type ModeratorCandidate,
  type ModeratorRow,
} from "../../lib/moderators";
import { GOLD, NAVY } from "../../theme";

export function ModeratorsSheet({
  open,
  onClose,
  liveId,
  hostId,
  presentIds,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  liveId: string;
  hostId: string;
  presentIds: Array<{ id: string; name?: string }>;
  onToast: (msg: string) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [mods, setMods] = useState<ModeratorRow[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [present, setPresent] = useState<ModeratorCandidate[]>([]);
  const [followers, setFollowers] = useState<ModeratorCandidate[]>([]);
  const [suggestions, setSuggestions] = useState<ModeratorCandidate[]>([]);

  const existingIds = useMemo(() => new Set(mods.map((m) => m.userId)), [mods]);
  const excludeIds = useMemo(() => {
    const s = new Set(existingIds);
    s.add(hostId);
    return s;
  }, [existingIds, hostId]);
  const atLimit = mods.length >= MAX_LIVE_MODERATORS;

  const reload = async () => {
    const rows = await fetchModerators(liveId);
    setMods(rows);
  };

  useEffect(() => {
    if (!open) return;
    setQuery("");
    void reload();
  }, [open, liveId]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void (async () => {
      const [inLive, graph] = await Promise.all([
        fetchModeratorCandidatesByIds(
          presentIds.map((p) => p.id),
          { hostId, excludeIds, limit: 16 },
        ),
        fetchFollowerModeratorCandidates(hostId, { excludeIds, limit: 16 }),
      ]);
      if (!alive) return;
      setPresent(inLive);
      const seen = new Set(inLive.map((c) => c.id));
      setFollowers(graph.filter((c) => !seen.has(c.id)));
    })();
    return () => {
      alive = false;
    };
  }, [open, hostId, excludeIds, presentIds.map((p) => p.id).join(",")]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim().replace(/^@+/, "");
    if (q.length < 1 || atLimit) {
      setSuggestions([]);
      return;
    }
    let alive = true;
    const tmr = setTimeout(() => {
      void searchModeratorCandidates(q, { hostId, excludeIds, limit: 8 }).then((rows) => {
        if (alive) setSuggestions(rows);
      });
    }, 220);
    return () => {
      alive = false;
      clearTimeout(tmr);
    };
  }, [query, open, hostId, excludeIds, atLimit]);

  const errorMsg = (code?: string, fallback?: string) => {
    if (code === "moderator_limit_reached") return t("moderator.limitReached", { count: MAX_LIVE_MODERATORS });
    if (code === "moderator_not_follower") return t("moderator.mustFollow");
    if (code === "already_mod") return t("moderator.alreadyMod");
    return fallback ?? t("moderator.addFailed");
  };

  const promote = async (userId: string) => {
    if (busy || atLimit) return;
    setBusy(true);
    try {
      const res = await addModerator(liveId, userId, hostId);
      if (!res.ok) {
        onToast(errorMsg(res.code, res.error));
        return;
      }
      onToast(t("moderator.added"));
      setQuery("");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const demote = async (userId: string) => {
    const res = await removeModerator(liveId, userId);
    if (!res.ok) onToast(res.error ?? t("moderator.removeFailed"));
    else {
      onToast(t("moderator.removed"));
      await reload();
    }
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Press haptic="none" onPress={onClose} style={styles.dim} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <View style={styles.headTitle}>
              <Shield size={18} color={NAVY} />
              <Text style={styles.title}>{t("moderator.title")}</Text>
            </View>
            <Press onPress={onClose} style={styles.close}>
              <X size={18} color={NAVY} />
            </Press>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>
            {mods.length === 0 ? (
              <Text style={styles.empty}>{t("moderator.empty")}</Text>
            ) : (
              mods.map((m) => (
                <View key={m.userId} style={styles.row}>
                  <Avatar url={m.avatarUrl} name={m.displayName ?? m.handle ?? "?"} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{m.displayName ?? m.handle ?? m.userId.slice(0, 8)}</Text>
                    {m.handle ? <Text style={styles.handle}>@{m.handle}</Text> : null}
                  </View>
                  <Press onPress={() => void demote(m.userId)} style={styles.iconBtn}>
                    <Trash2 size={16} color="#C62828" />
                  </Press>
                </View>
              ))
            )}

            <Text style={styles.section}>{t("moderator.addSection")}</Text>
            <Text style={styles.hint}>
              {t("moderator.followersOnlyHint", { count: MAX_LIVE_MODERATORS, used: mods.length })}
            </Text>
            {atLimit ? (
              <Text style={styles.empty}>{t("moderator.limitReached", { count: MAX_LIVE_MODERATORS })}</Text>
            ) : (
              <View style={styles.searchRow}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t("moderator.promotePlaceholder")}
                  placeholderTextColor="#9AA0B4"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                <Press
                  onPress={() => {
                    const first = suggestions[0];
                    if (first) void promote(first.id);
                  }}
                  disabled={busy || !query.trim()}
                  style={styles.promote}
                >
                  {busy ? <ActivityIndicator color={NAVY} /> : <Text style={styles.promoteTxt}>{t("moderator.promote")}</Text>}
                </Press>
              </View>
            )}

            {suggestions.map((c) => (
              <Candidate key={c.id} c={c} already={existingIds.has(c.id)} onPick={() => void promote(c.id)} />
            ))}
            {!query.trim() && present.length > 0 ? (
              <>
                <Text style={styles.section}>{t("moderator.inLiveNow")}</Text>
                {present.map((c) => (
                  <Candidate key={c.id} c={c} already={existingIds.has(c.id)} badge={t("moderator.badgeLive")} onPick={() => void promote(c.id)} />
                ))}
              </>
            ) : null}
            {!query.trim() && followers.length > 0 ? (
              <>
                <Text style={styles.section}>{t("moderator.fromFollowers")}</Text>
                {followers.map((c) => (
                  <Candidate key={c.id} c={c} already={existingIds.has(c.id)} onPick={() => void promote(c.id)} />
                ))}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) return <Image source={{ uri: url }} style={styles.av} contentFit="cover" />;
  return (
    <View style={[styles.av, styles.avPh]}>
      <Text style={styles.avLetter}>{(name[0] || "?").toUpperCase()}</Text>
    </View>
  );
}

function Candidate({
  c,
  already,
  badge,
  onPick,
}: {
  c: ModeratorCandidate;
  already: boolean;
  badge?: string;
  onPick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Press onPress={onPick} disabled={already} style={styles.row}>
      <Avatar url={c.avatarUrl} name={c.displayName ?? c.handle ?? "?"} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{c.displayName || c.handle || "—"}</Text>
        {c.handle ? <Text style={styles.handle}>@{c.handle}</Text> : null}
      </View>
      {already ? (
        <Text style={styles.badge}>{t("moderator.alreadyModShort")}</Text>
      ) : badge ? (
        <Text style={styles.badge}>{badge}</Text>
      ) : null}
    </Press>
  );
}

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  dim: { ...FILL, backgroundColor: "rgba(0,0,0,0.45)", minHeight: 0, minWidth: 0 },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: "82%",
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  headTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: NAVY, fontSize: 18, fontWeight: "800" },
  close: { width: 36, height: 36, minWidth: 36, minHeight: 36 },
  empty: { color: "#6B7289", fontSize: 13, paddingVertical: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    minHeight: 0,
    minWidth: 0,
  },
  av: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#eee" },
  avPh: { alignItems: "center", justifyContent: "center", backgroundColor: NAVY },
  avLetter: { color: "#fff", fontWeight: "800" },
  name: { color: NAVY, fontWeight: "800", fontSize: 14 },
  handle: { color: "#6B7289", fontSize: 11, marginTop: 1 },
  iconBtn: { width: 36, height: 36, minWidth: 36, minHeight: 36 },
  section: {
    marginTop: 14,
    marginBottom: 6,
    color: "#6B7289",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  hint: { color: "#6B7289", fontSize: 11, marginBottom: 8 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E6E8EF",
    paddingHorizontal: 14,
    color: NAVY,
    fontSize: 13,
  },
  promote: {
    height: 40,
    minHeight: 40,
    minWidth: 0,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  promoteTxt: { color: NAVY, fontWeight: "800", fontSize: 12 },
  badge: { color: "#6B7289", fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
});
