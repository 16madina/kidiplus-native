import { useEffect, useState } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { Home, Play, Share2 } from "lucide-react-native";
import { Logo } from "../Logo";
import { Press } from "../Press";
import { MockBanner } from "../OverlayHeader";
import { ReplayPlayerModal, type ReplayOpen } from "../live/ReplayPlayerModal";
import { downloadLiveReplay } from "../../lib/live-replay-download";
import {
  fetchLiveGiftsTotal,
  fetchLivePaidOrders,
  fmtDuration,
  type LivePaidOrder,
} from "../../lib/live-host";
import {
  fetchLiveReplayMeta,
  isReplayPlayable,
  playableReplayUrl,
  type LiveReplayMeta,
} from "../../lib/live-replay";
import { formatMoney } from "../../lib/money";
import { supabase } from "../../lib/supabase";
import { GOLD, NAVY } from "../../theme";

export function BroadcastSummary({
  liveId,
  title,
  durationSec,
  peakViewers,
  onDone,
}: {
  liveId: string;
  title: string;
  durationSec: number;
  peakViewers: number;
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [heading, setHeading] = useState(title);
  const [category, setCategory] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [orders, setOrders] = useState<LivePaidOrder[]>([]);
  const [gifts, setGifts] = useState({ count: 0, sellerNet: 0 });
  const [replayMeta, setReplayMeta] = useState<LiveReplayMeta | null>(null);
  const [replayOpen, setReplayOpen] = useState<ReplayOpen | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fmt = (n: number, cur: string = currency) => formatMoney(n, cur, i18n.language);

  const revenue = orders.reduce((s, o) => s + o.amount, 0);
  const salesCount = orders.length;
  const replayReady = isReplayPlayable(replayMeta);
  const replayPending =
    replayMeta?.replay_status === "recording" || replayMeta?.replay_status === "processing";
  const showReplay = replayReady || replayPending;

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      fetchLivePaidOrders(liveId),
      fetchLiveGiftsTotal(liveId),
      supabase.from("lives").select("title, category, currency").eq("id", liveId).maybeSingle(),
    ]).then(([paid, g, liveRes]) => {
      if (!alive) return;
      setOrders(paid);
      setGifts(g);
      const row = liveRes.data;
      if (row?.title) setHeading(String(row.title));
      if (row?.category) setCategory(String(row.category));
      if (row?.currency) setCurrency(String(row.currency));
    });
    return () => {
      alive = false;
    };
  }, [liveId]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      const meta = await fetchLiveReplayMeta(liveId);
      if (alive) setReplayMeta(meta);
    };
    void poll();
    const iv = setInterval(() => void poll(), 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [liveId]);

  const openReplay = async () => {
    if (!replayReady) return;
    const url = await playableReplayUrl(liveId, replayMeta);
    if (!url) {
      setToast(t("broadcast.replay.openFailed"));
      return;
    }
    setReplayOpen({ url, title: heading, liveId });
  };

  const share = async () => {
    try {
      await Share.share({
        title: heading,
        message: `https://kidiplus.com/live/${liveId}`,
        url: `https://kidiplus.com/live/${liveId}`,
      });
    } catch {
      setToast(t("common.copied"));
    }
  };

  const subtitle = category ? `${heading} · ${category}` : heading;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Logo size={48} />
        <View style={styles.hero}>
          <Text style={styles.title}>{t("broadcast.summary.title")} 🎉</Text>
          <Text style={styles.sub}>{subtitle}</Text>
        </View>

        <View style={styles.tiles}>
          <Tile label={t("broadcast.summary.duration")} value={fmtDuration(durationSec)} />
          <Tile label={t("broadcast.summary.peakViewers")} value={String(Math.max(0, peakViewers))} />
          <Tile label={t("broadcast.summary.sales")} value={String(salesCount)} />
        </View>

        <LinearGradient colors={["#E85A62", "#C62828"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.revenue}>
          <Text style={styles.revenueLabel}>{t("broadcast.summary.revenue")}</Text>
          <Text style={styles.revenueValue}>{fmt(revenue)}</Text>
        </LinearGradient>

        {gifts.count > 0 ? (
          <View style={styles.gifts}>
            <View style={styles.giftsLeft}>
              <Text style={styles.giftsEmoji}>🎁</Text>
              <View>
                <Text style={styles.giftsTitle}>{t("gifts.summaryTitle")}</Text>
                <Text style={styles.giftsCount}>{t("gifts.summaryCount", { count: gifts.count })}</Text>
              </View>
            </View>
            <Text style={styles.giftsNet}>+{fmt(gifts.sellerNet)}</Text>
          </View>
        ) : null}

        <View style={styles.salesBlock}>
          <Text style={styles.salesHead}>{t("broadcast.summary.sales")}</Text>
          {salesCount === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTxt}>{t("home.empty")}</Text>
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              {orders.map((o) => (
                <View key={o.id} style={styles.saleRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.saleName} numberOfLines={1}>
                      {o.item_name}
                    </Text>
                    <Text style={styles.saleKind}>
                      {o.kind === "auction" ? t("pay.kind.auction") : t("pay.kind.fixed")}
                    </Text>
                  </View>
                  <Text style={styles.saleAmt}>{fmt(o.amount, o.currency ?? currency)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {showReplay ? (
            <Press disabled={!replayReady} onPress={() => void openReplay()} style={styles.replayBtn}>
              <LinearGradient
                colors={["#B4232C", "#8E1B22"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.replayGrad}
              >
                <Play size={16} color="#fff" fill="#fff" />
                <Text style={styles.replayTxt}>
                  {replayReady ? t("broadcast.replay.watch") : t("broadcast.replay.preparing")}
                </Text>
              </LinearGradient>
            </Press>
          ) : null}

          <Press onPress={() => void share()} style={styles.shareBtn}>
            <Share2 size={16} color="#fff" />
            <Text style={styles.shareTxt}>{t("common.share")}</Text>
          </Press>

          <Press onPress={onDone} style={styles.home}>
            <Home size={16} color={NAVY} />
            <Text style={styles.homeTxt}>{t("broadcast.summary.close")}</Text>
          </Press>
        </View>
      </ScrollView>
      <MockBanner text={toast} />
      <ReplayPlayerModal
        replay={replayOpen}
        onClose={() => setReplayOpen(null)}
        onDownload={async () => {
          if (!replayOpen) return;
          try {
            const mode = await downloadLiveReplay(replayOpen.url, replayOpen.title);
            setToast(
              mode === "shared" ? t("broadcast.replay.downloadShared") : t("broadcast.replay.downloadOpened"),
            );
          } catch {
            setToast(t("broadcast.replay.downloadFailed"));
          }
        }}
      />
    </View>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

const MUTED = "#F2F3F7";
const MUTED_FG = "#6B7289";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, alignItems: "center", gap: 16 },
  hero: { alignItems: "center", gap: 4 },
  title: { color: NAVY, fontSize: 28, fontWeight: "800", textAlign: "center", letterSpacing: -0.4 },
  sub: { color: MUTED_FG, fontSize: 14, textAlign: "center" },
  tiles: { flexDirection: "row", gap: 8, width: "100%" },
  tile: {
    flex: 1,
    backgroundColor: MUTED,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  tileLabel: {
    color: MUTED_FG,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  tileValue: { color: NAVY, fontSize: 18, fontWeight: "800", marginTop: 4, fontVariant: ["tabular-nums"] },
  revenue: {
    width: "100%",
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  revenueLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  revenueValue: { color: "#fff", fontSize: 36, fontWeight: "800", marginTop: 6, fontVariant: ["tabular-nums"] },
  gifts: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: MUTED,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  giftsLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  giftsEmoji: { fontSize: 24 },
  giftsTitle: { color: NAVY, fontWeight: "800", fontSize: 13 },
  giftsCount: { color: MUTED_FG, fontSize: 11, marginTop: 2 },
  giftsNet: { color: GOLD, fontWeight: "800", fontSize: 16 },
  salesBlock: { width: "100%", gap: 8 },
  salesHead: { color: NAVY, fontSize: 15, fontWeight: "800" },
  empty: { backgroundColor: MUTED, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 12 },
  emptyTxt: { color: MUTED_FG, fontSize: 13, textAlign: "center" },
  saleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: MUTED,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  saleName: { color: NAVY, fontSize: 14, fontWeight: "700" },
  saleKind: { color: MUTED_FG, fontSize: 12, marginTop: 2 },
  saleAmt: { color: NAVY, fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
  actions: { width: "100%", gap: 8, paddingTop: 4 },
  replayBtn: { width: "100%", height: 48, borderRadius: 16, overflow: "hidden" },
  replayGrad: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  replayTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  shareBtn: {
    height: 48,
    width: "100%",
    borderRadius: 16,
    backgroundColor: NAVY,
    flexDirection: "row",
    gap: 8,
  },
  shareTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  home: {
    height: 48,
    width: "100%",
    borderRadius: 16,
    backgroundColor: MUTED,
    flexDirection: "row",
    gap: 8,
  },
  homeTxt: { color: NAVY, fontWeight: "700", fontSize: 15 },
});
