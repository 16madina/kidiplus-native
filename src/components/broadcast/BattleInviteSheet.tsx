import { useEffect, useState } from "react";
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
import { Radio, Swords, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { fetchActiveLives } from "../../lib/lives";
import {
  BATTLE_DEFAULT_DURATION_SEC,
  BATTLE_DURATIONS_SEC,
  BATTLE_PROTO_DEMO_SEC,
  battleInvite,
  searchSellerProfiles,
  type BattleInviteDraft,
} from "../../lib/battles";
import { resolveAvatarUrl } from "../../lib/storage";
import { GOLD, LIVE_RED, NAVY } from "../../theme";

export function BattleInviteSheet({
  open,
  onClose,
  liveId,
  excludeSellerId,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  liveId: string;
  excludeSellerId: string;
  onToast: (msg: string) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"live" | "search">("live");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveRows, setLiveRows] = useState<BattleInviteDraft[]>([]);
  const [searchRows, setSearchRows] = useState<BattleInviteDraft[]>([]);
  const [selected, setSelected] = useState<BattleInviteDraft | null>(null);
  const [durationSec, setDurationSec] = useState(BATTLE_DEFAULT_DURATION_SEC);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab("live");
    setQuery("");
    setSelected(null);
    setDurationSec(BATTLE_DEFAULT_DURATION_SEC);
    let cancelled = false;
    setLoading(true);
    void fetchActiveLives(80)
      .then((lives) => {
        const rows: BattleInviteDraft[] = lives
          .filter((s) => s.sellerId && s.sellerId !== excludeSellerId && !String(s.sellerId).startsWith("fictitious"))
          .map((s) => ({
            toSellerId: s.sellerId!,
            toLiveId: s.liveId ?? s.id,
            displayName: s.seller,
            handle: s.handle ?? null,
            avatarUrl: s.avatar || null,
            isLive: true,
          }));
        if (!cancelled) setLiveRows(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, excludeSellerId]);

  useEffect(() => {
    if (!open || tab !== "search") return;
    const q = query.trim();
    if (q.length < 2) {
      setSearchRows([]);
      return;
    }
    let cancelled = false;
    const tmr = setTimeout(() => {
      setLoading(true);
      void (async () => {
        const [lives, profiles] = await Promise.all([fetchActiveLives(40), searchSellerProfiles(q, 30)]);
        const liveBySeller = new Map(lives.filter((s) => s.sellerId).map((s) => [s.sellerId!, s]));
        const rows: BattleInviteDraft[] = [];
        for (const p of profiles) {
          if (p.id === excludeSellerId) continue;
          const live = liveBySeller.get(p.id);
          rows.push({
            toSellerId: p.id,
            toLiveId: live?.liveId ?? live?.id ?? null,
            displayName: p.display_name || p.handle || t("battle.unknownSeller"),
            handle: p.handle,
            avatarUrl: p.avatar_url ? await resolveAvatarUrl(p.avatar_url) : null,
            isLive: !!live,
          });
        }
        if (!cancelled) setSearchRows(rows);
      })().finally(() => {
        if (!cancelled) setLoading(false);
      });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(tmr);
    };
  }, [open, tab, query, excludeSellerId, t]);

  const list = tab === "live" ? liveRows : searchRows;

  const send = async () => {
    if (!selected || sending) return;
    if (!selected.isLive) {
      onToast(t("battle.invite.notLiveHint"));
      return;
    }
    setSending(true);
    try {
      const res = await battleInvite({
        fromLiveId: liveId,
        toSellerId: selected.toSellerId,
        durationSec,
        rematchOf: null,
      });
      if (!res.ok) {
        onToast(res.error ?? t("battle.invite.failed"));
        return;
      }
      onToast(t("battle.invite.sent"));
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Press haptic="none" onPress={onClose} style={styles.dim} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.head}>
            <View style={styles.headTitle}>
              <Swords size={18} color={NAVY} />
              <Text style={styles.title}>{t("battle.invite.title")}</Text>
            </View>
            <Press onPress={onClose} style={styles.close}>
              <X size={18} color={NAVY} />
            </Press>
          </View>
          <Text style={styles.sub}>{t("battle.invite.subtitle")}</Text>
          <View style={styles.tabs}>
            {(["live", "search"] as const).map((id) => (
              <Press key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabOn]}>
                <Text style={[styles.tabTxt, tab === id && styles.tabTxtOn]}>
                  {id === "live" ? t("battle.invite.tabLive") : t("battle.invite.tabSearch")}
                </Text>
              </Press>
            ))}
          </View>
          {tab === "search" ? (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("battle.invite.searchPlaceholder")}
              placeholderTextColor="#9AA0B4"
              autoCapitalize="none"
              style={styles.search}
            />
          ) : null}
          <ScrollView style={{ maxHeight: 280 }}>
            {loading && list.length === 0 ? (
              <ActivityIndicator color={GOLD} style={{ marginVertical: 24 }} />
            ) : list.length === 0 ? (
              <Text style={styles.empty}>
                {tab === "live"
                  ? t("battle.invite.emptyLive")
                  : query.trim().length < 2
                    ? t("battle.invite.searchHint")
                    : t("battle.invite.emptySearch")}
              </Text>
            ) : (
              list.map((row) => {
                const on = selected?.toSellerId === row.toSellerId;
                return (
                  <Press key={row.toSellerId} onPress={() => setSelected(row)} style={[styles.row, on && styles.rowOn]}>
                    {row.avatarUrl ? (
                      <Image source={{ uri: row.avatarUrl }} style={styles.av} contentFit="cover" />
                    ) : (
                      <View style={[styles.av, styles.avPh]}>
                        <Text style={styles.avLetter}>{(row.displayName[0] || "?").toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{row.displayName}</Text>
                      <Text style={styles.handle}>{row.handle ? `@${row.handle}` : t("battle.invite.shop")}</Text>
                    </View>
                    {row.isLive ? (
                      <View style={styles.liveBadge}>
                        <Radio size={10} color="#fff" />
                        <Text style={styles.liveBadgeTxt}>{t("battle.invite.liveBadge")}</Text>
                      </View>
                    ) : (
                      <Text style={styles.off}>{t("battle.invite.offlineBadge")}</Text>
                    )}
                  </Press>
                );
              })
            )}
          </ScrollView>
          {selected ? (
            <View style={styles.footer}>
              {!selected.isLive ? <Text style={styles.warn}>{t("battle.invite.notLiveHint")}</Text> : null}
              <Text style={styles.durLabel}>{t("battle.invite.duration")}</Text>
              <View style={styles.durs}>
                <Press
                  onPress={() => setDurationSec(BATTLE_PROTO_DEMO_SEC)}
                  style={[styles.dur, durationSec === BATTLE_PROTO_DEMO_SEC && styles.durOn]}
                >
                  <Text style={styles.durTxt}>{t("battle.duration.demo")}</Text>
                </Press>
                {BATTLE_DURATIONS_SEC.map((sec) => (
                  <Press
                    key={sec}
                    onPress={() => setDurationSec(sec)}
                    style={[styles.dur, durationSec === sec && styles.durOn]}
                  >
                    <Text style={styles.durTxt}>{t("battle.duration.min", { count: sec / 60 })}</Text>
                  </Press>
                ))}
              </View>
              <Press onPress={() => void send()} disabled={sending} style={styles.cta}>
                {sending ? (
                  <ActivityIndicator color={NAVY} />
                ) : (
                  <Text style={styles.ctaTxt}>{t("battle.invite.cta")}</Text>
                )}
              </Press>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
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
    maxHeight: "86%",
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headTitle: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  title: { color: NAVY, fontSize: 18, fontWeight: "800", flexShrink: 1 },
  close: { width: 36, height: 36, minWidth: 36, minHeight: 36 },
  sub: { color: "#6B7289", fontSize: 13, marginTop: 4, marginBottom: 12 },
  tabs: { flexDirection: "row", backgroundColor: "#F2F3F7", borderRadius: 999, padding: 4, marginBottom: 10 },
  tab: { flex: 1, height: 36, minHeight: 36, borderRadius: 999 },
  tabOn: { backgroundColor: GOLD },
  tabTxt: { color: NAVY, fontWeight: "700", fontSize: 13 },
  tabTxtOn: { fontWeight: "800" },
  search: {
    height: 44,
    borderRadius: 999,
    backgroundColor: "#F2F3F7",
    paddingHorizontal: 16,
    color: NAVY,
    marginBottom: 8,
  },
  empty: { color: "#6B7289", textAlign: "center", paddingVertical: 24, fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 16,
    minHeight: 0,
    minWidth: 0,
  },
  rowOn: { backgroundColor: "rgba(232,185,59,0.16)", borderWidth: 1, borderColor: GOLD },
  av: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#eee" },
  avPh: { alignItems: "center", justifyContent: "center", backgroundColor: NAVY },
  avLetter: { color: "#fff", fontWeight: "800" },
  name: { color: NAVY, fontWeight: "800", fontSize: 15 },
  handle: { color: "#6B7289", fontSize: 12, marginTop: 1 },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: LIVE_RED,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "900" },
  off: { color: "#6B7289", fontSize: 10, fontWeight: "700" },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E6E8EF", paddingTop: 12, marginTop: 8 },
  warn: { color: "#B45309", fontSize: 11, marginBottom: 8 },
  durLabel: { color: "#6B7289", fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginBottom: 8 },
  durs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  dur: {
    minHeight: 36,
    height: 36,
    minWidth: 0,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#F2F3F7",
  },
  durOn: { backgroundColor: GOLD },
  durTxt: { color: NAVY, fontWeight: "800", fontSize: 12 },
  cta: { height: 48, borderRadius: 999, backgroundColor: GOLD },
  ctaTxt: { color: NAVY, fontWeight: "900", fontSize: 15 },
});
