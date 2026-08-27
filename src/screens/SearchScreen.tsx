import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Clock, Radio, Search as SearchIcon, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { LiveCard } from "../components/LiveCard";
import { Press } from "../components/Press";
import { Glass } from "../components/Glass";
import { TAB_SAFE_PADDING } from "../components/BottomTabBar";
import { useNav } from "../context/navigation";
import { useAppTheme } from "../context/theme";
import { useLivesFeed } from "../hooks/useLivesFeed";
import { searchActiveShopProducts, type ShopSearchHit } from "../lib/shop";
import { BROWSE_CATEGORIES, TRENDS, formatViewersFr } from "../mock/browse";
import { GOLD, LIVE_RED } from "../theme";

export function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const { openList } = useNav();
  const { active, loading: livesLoading } = useLivesFeed();
  const [raw, setRaw] = useState("");
  const [focused, setFocused] = useState(false);
  const [tab, setTab] = useState(0);
  const [sort, setSort] = useState<"recommended" | "popular" | "alpha">("recommended");
  const [sellerScope, setSellerScope] = useState<"all" | "live">("all");
  const [recent, setRecent] = useState(["jordan 4", "chanel", "iphone", "pokémon", "ysl"]);
  const [products, setProducts] = useState<ShopSearchHit[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const query = raw.trim();
  const searching = query.length > 0;

  const liveResults = useMemo(() => {
    const q = query.toLowerCase();
    return active.filter(
      (s) =>
        s.seller.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.category.toLowerCase() === q,
    );
  }, [active, query]);

  useEffect(() => {
    if (!searching || tab !== 2) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    setProductsLoading(true);
    void searchActiveShopProducts(query).then((rows) => {
      if (!cancelled) {
        setProducts(rows);
        setProductsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query, searching, tab]);

  const cats = useMemo(() => {
    const list = [...BROWSE_CATEGORIES];
    if (sort === "popular") list.sort((a, b) => b.viewers - a.viewers);
    if (sort === "alpha") list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return list;
  }, [sort]);

  const sellers = useMemo(() => {
    const q = query.toLowerCase();
    const seen = new Set<string>();
    return active
      .filter((s) => sellerScope === "all" || !s.scheduled)
      .filter(
        (s) =>
          !searching ||
          s.seller.toLowerCase().includes(q) ||
          (s.sellerId ?? "").toLowerCase().includes(q),
      )
      .flatMap((s) => {
        const id = s.sellerId || s.seller;
        if (seen.has(id)) return [];
        seen.add(id);
        return [{ id, name: s.seller, handle: s.handle ?? "", avatar: s.avatar, live: !s.scheduled, viewers: s.viewers }];
      });
  }, [active, query, searching, sellerScope]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.searchRow}>
        <Glass tone={dark ? "dark" : "light"} intensity={44} radius={999} style={{ flex: 1 }} elevated={false}>
          <View style={styles.search}>
            <SearchIcon size={16} color={colors.mutedForeground} />
            <TextInput
              value={raw}
              onChangeText={setRaw}
              onFocus={() => setFocused(true)}
              placeholder={t("search.placeholder")}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground }]}
            />
            {raw ? (
              <Press onPress={() => setRaw("")} style={{ minHeight: 28, minWidth: 28 }}>
                <X size={16} color={colors.mutedForeground} />
              </Press>
            ) : null}
          </View>
        </Glass>
        {focused || searching ? (
          <Press
            onPress={() => {
              setFocused(false);
              setRaw("");
            }}
            style={{ minWidth: 0, paddingHorizontal: 8 }}
          >
            <Text style={{ color: colors.foreground, fontWeight: "700" }}>{t("common.cancel")}</Text>
          </Press>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: TAB_SAFE_PADDING + insets.bottom }} keyboardShouldPersistTaps="handled">
        {focused && !searching ? (
          <View style={{ paddingHorizontal: 16 }}>
            <Text style={[styles.h, { color: colors.foreground }]}>{t("search.recent")}</Text>
            {recent.map((r) => (
              <Press
                key={r}
                onPress={() => {
                  setRaw(r);
                  setRecent((prev) => [r, ...prev.filter((x) => x !== r)].slice(0, 8));
                }}
                style={styles.recent}
              >
                <Clock size={16} color={colors.mutedForeground} />
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>{r}</Text>
              </Press>
            ))}
          </View>
        ) : searching ? (
          <View>
            <View style={styles.tabs}>
              {(["search.tabs.lives", "search.tabs.sellers", "search.tabs.products"] as const).map((k, i) => (
                <Press key={k} onPress={() => setTab(i)} style={[styles.tab, tab === i && { borderBottomColor: GOLD }]}>
                  <Text style={{ fontWeight: tab === i ? "800" : "600", color: tab === i ? colors.foreground : colors.mutedForeground }}>
                    {t(k)}
                  </Text>
                </Press>
              ))}
            </View>
            {tab === 0 ? (
              livesLoading ? (
                <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} />
              ) : liveResults.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 32, paddingHorizontal: 24 }}>
                  {t("search.emptyResults", { query })}
                </Text>
              ) : (
                <View style={styles.grid}>
                  {liveResults.map((s) => (
                    <View key={s.id} style={styles.cell}>
                      <LiveCard stream={s} onPress={() => openList(liveResults, liveResults.indexOf(s))} />
                    </View>
                  ))}
                </View>
              )
            ) : null}
            {tab === 1 ? (
              <View style={{ paddingHorizontal: 16, gap: 8 }}>
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  {(["all", "live"] as const).map((k) => (
                    <Press
                      key={k}
                      onPress={() => setSellerScope(k)}
                      style={styles.chipPress}
                    >
                      <Glass tone={sellerScope === k ? "gold" : dark ? "dark" : "light"} intensity={36} radius={999} elevated={false}>
                        <View style={styles.chip}>
                          <Text style={{ color: sellerScope === k ? "#fff" : colors.foreground, fontWeight: "700", fontSize: 12 }}>
                            {t(k === "all" ? "search.sellerScope.all" : "search.sellerScope.live")}
                          </Text>
                        </View>
                      </Glass>
                    </Press>
                  ))}
                </View>
                {sellers.length === 0 ? (
                  <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 24 }}>
                    {t("search.emptyResults", { query })}
                  </Text>
                ) : (
                  sellers.map((s) => (
                  <View key={s.id} style={styles.seller}>
                    <Image source={{ uri: s.avatar }} style={styles.av} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontWeight: "800", color: colors.foreground }}>{s.name}</Text>
                        {s.live ? (
                          <View style={styles.livePill}>
                            <Radio size={10} color="#fff" />
                            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>LIVE</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                        {s.handle ? `@${s.handle}` : s.name}
                        {s.viewers ? ` · ${formatViewersFr(s.viewers)}` : ""}
                      </Text>
                    </View>
                    <Glass tone={dark ? "dark" : "light"} intensity={32} radius={999} elevated={false}>
                      <Press style={styles.follow}>
                        <Text style={{ fontWeight: "700", color: colors.foreground }}>{t("follow.follow")}</Text>
                      </Press>
                    </Glass>
                  </View>
                ))
                )}
              </View>
            ) : null}
            {tab === 2 ? (
              productsLoading ? (
                <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} />
              ) : products.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 32, paddingHorizontal: 24, paddingBottom: 24 }}>
                  {t("search.emptyResults", { query })}
                </Text>
              ) : (
                <View style={styles.grid}>
                  {products.map((p) => (
                    <Glass key={p.id} tone={dark ? "dark" : "light"} intensity={28} radius={16} style={styles.cell} elevated={false}>
                      <Image source={{ uri: p.image }} style={{ width: "100%", aspectRatio: 1 }} contentFit="cover" />
                      <View style={{ padding: 8 }}>
                        <Text numberOfLines={2} style={{ fontWeight: "700", color: colors.foreground }}>{p.name}</Text>
                        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{p.seller}</Text>
                        <Text style={{ fontWeight: "800", color: GOLD, marginTop: 4 }}>{p.price}</Text>
                      </View>
                    </Glass>
                  ))}
                </View>
              )
            ) : null}
          </View>
        ) : (
          <View>
            <Text style={[styles.h, { color: colors.foreground, paddingHorizontal: 16 }]}>{t("search.trending")}</Text>
            <View style={styles.trends}>
              {TRENDS.map((tr) => (
                <Press key={tr.id} onPress={() => setRaw(tr.name)} style={styles.trendPress}>
                  <Glass tone={dark ? "dark" : "light"} intensity={32} radius={14} elevated={false}>
                    <View style={styles.trend}>
                      <Image source={{ uri: tr.image }} style={styles.trendImg} contentFit="cover" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "700", color: colors.foreground, fontSize: 13 }}>{t(tr.nameKey)}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: LIVE_RED }} />
                          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{formatViewersFr(tr.viewers)}</Text>
                        </View>
                      </View>
                    </View>
                  </Glass>
                </Press>
              ))}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 18 }}>
              <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground }}>{t("search.categories")}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, marginVertical: 8 }}>
              {(["recommended", "popular", "alpha"] as const).map((k) => (
                <Press key={k} onPress={() => setSort(k)} style={styles.chipPress}>
                  <Glass tone={sort === k ? "gold" : dark ? "dark" : "light"} intensity={36} radius={999} elevated={false}>
                    <View style={styles.chip}>
                      <Text style={{ color: sort === k ? "#fff" : colors.foreground, fontWeight: "700", fontSize: 12 }}>
                        {t(`search.sort.${k === "alpha" ? "alpha" : k}`)}
                      </Text>
                    </View>
                  </Glass>
                </Press>
              ))}
            </View>
            <View style={styles.grid}>
              {cats.map((c) => (
                <Press key={c.id} onPress={() => setRaw(c.query)} style={styles.cat}>
                  <Image source={{ uri: c.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <View style={styles.catFrost}>
                    <Glass tone="dark" intensity={30} radius={10} elevated={false}>
                      <Text style={styles.catLabel}>{t(c.nameKey)}</Text>
                    </Glass>
                  </View>
                  <View style={styles.catViewersWrap}>
                    <Glass tone="dark" intensity={24} radius={8} elevated={false}>
                      <Text style={styles.catViewers}>{formatViewersFr(c.viewers)}</Text>
                    </Glass>
                  </View>
                </Press>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  search: {
    height: 40,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  h: { fontSize: 16, fontWeight: "800", marginBottom: 8, marginTop: 8 },
  recent: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  tabs: { flexDirection: "row", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E6E8EF" },
  tab: { flex: 1, height: 40, borderBottomWidth: 2, borderBottomColor: "transparent" },
  grid: { paddingHorizontal: 16, flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 12 },
  cell: { width: "48.5%" },
  chipPress: { minHeight: 32, minWidth: 0 },
  chip: { height: 32, minHeight: 32, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  seller: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  av: { width: 48, height: 48, borderRadius: 24 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: LIVE_RED, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  follow: { height: 32, minHeight: 32, borderRadius: 999, paddingHorizontal: 12 },
  trends: { paddingHorizontal: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  trendPress: { width: "48%", minHeight: 64, minWidth: 0, alignItems: "stretch" },
  trend: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 64, paddingRight: 8 },
  trendImg: { width: 56, height: 56, borderRadius: 10 },
  cat: {
    width: "48.5%",
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1C2440",
    minHeight: 0,
    minWidth: 0,
    alignItems: "stretch",
  },
  catLabel: { color: "#fff", fontWeight: "800", fontSize: 15, paddingHorizontal: 10, paddingVertical: 6 },
  catFrost: { position: "absolute", top: 10, left: 10 },
  catViewersWrap: { position: "absolute", bottom: 10, left: 10 },
  catViewers: { color: "rgba(255,255,255,0.92)", fontWeight: "600", paddingHorizontal: 8, paddingVertical: 4, fontSize: 12 },
});
