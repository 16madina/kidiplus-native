import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Home } from "lucide-react-native";
import { Logo } from "../Logo";
import { Press } from "../Press";
import { fetchLiveGiftsTotal, fetchLiveSales, fmtDuration } from "../../lib/live-host";
import { formatMoney } from "../../lib/money";
import { supabase } from "../../lib/supabase";
import { GOLD, LIVE_RED, NAVY } from "../../theme";

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
  const [currency, setCurrency] = useState("EUR");
  const [sales, setSales] = useState({ revenue: 0, count: 0 });
  const [gifts, setGifts] = useState({ count: 0, sellerNet: 0 });
  const fmt = (n: number) => formatMoney(n, currency, i18n.language);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      fetchLiveSales(liveId),
      fetchLiveGiftsTotal(liveId),
      supabase.from("lives").select("currency").eq("id", liveId).maybeSingle(),
    ]).then(([s, g, liveRes]) => {
      if (!alive) return;
      setSales(s);
      setGifts(g);
      if (liveRes.data?.currency) setCurrency(String(liveRes.data.currency));
    });
    return () => {
      alive = false;
    };
  }, [liveId]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Logo size={56} />
      <Text style={styles.title}>{t("broadcast.summary.title")} 🎉</Text>
      <Text style={styles.sub}>{title}</Text>

      <View style={styles.tiles}>
        <Tile label={t("broadcast.summary.duration")} value={fmtDuration(durationSec)} />
        <Tile label={t("broadcast.summary.peakViewers")} value={String(Math.max(0, peakViewers))} />
        <Tile label={t("broadcast.summary.sales")} value={String(sales.count)} />
      </View>

      <View style={styles.revenue}>
        <Text style={styles.revenueLabel}>{t("broadcast.summary.revenue")}</Text>
        <Text style={styles.revenueValue}>{fmt(sales.revenue)}</Text>
      </View>

      {gifts.count > 0 ? (
        <View style={styles.gifts}>
          <View>
            <Text style={styles.giftsTitle}>{t("gifts.summaryTitle")}</Text>
            <Text style={styles.giftsCount}>{t("gifts.summaryCount", { count: gifts.count })}</Text>
          </View>
          <Text style={styles.giftsNet}>+{fmt(gifts.sellerNet)}</Text>
        </View>
      ) : null}

      <Press onPress={onDone} style={styles.home}>
        <Home size={18} color={NAVY} />
        <Text style={styles.homeTxt}>{t("broadcast.summary.close")}</Text>
      </Press>
    </ScrollView>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  content: { paddingHorizontal: 22, alignItems: "center", gap: 14 },
  title: { color: NAVY, fontSize: 28, fontWeight: "900", textAlign: "center" },
  sub: { color: "#6B7289", fontSize: 14, textAlign: "center", marginTop: -6 },
  tiles: { flexDirection: "row", gap: 8, width: "100%", marginTop: 8 },
  tile: {
    flex: 1,
    backgroundColor: "#F2F3F7",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  tileLabel: { color: "#6B7289", fontSize: 10, fontWeight: "700", textTransform: "uppercase", textAlign: "center" },
  tileValue: { color: NAVY, fontSize: 16, fontWeight: "900", marginTop: 4, fontVariant: ["tabular-nums"] },
  revenue: {
    width: "100%",
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: LIVE_RED,
  },
  revenueLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  revenueValue: { color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 4 },
  gifts: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F2F3F7",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  giftsTitle: { color: NAVY, fontWeight: "800", fontSize: 14 },
  giftsCount: { color: "#6B7289", fontSize: 12, marginTop: 2 },
  giftsNet: { color: GOLD, fontWeight: "900", fontSize: 16 },
  home: {
    marginTop: 8,
    height: 52,
    width: "100%",
    borderRadius: 999,
    backgroundColor: GOLD,
    flexDirection: "row",
    gap: 8,
  },
  homeTxt: { color: NAVY, fontWeight: "900", fontSize: 16 },
});
