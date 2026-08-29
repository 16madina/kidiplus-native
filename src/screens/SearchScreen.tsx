import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Clock, Radio, Search as SearchIcon, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { LiveCard } from "../components/LiveCard";
import { Press } from "../components/Press";
import { Glass } from "../components/Glass";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { ReferredBadge } from "../components/ReferredBadge";
import { TAB_SAFE_PADDING } from "../components/BottomTabBar";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import { useAppTheme } from "../context/theme";
import { useLivesFeed } from "../hooks/useLivesFeed";
import { followUser, unfollowUser } from "../lib/follows";
import { searchSellers, type SellerSearchHit } from "../lib/search";
import { searchActiveShopProducts, type ShopSearchHit } from "../lib/shop";
import {
  browseTileSearchQuery,
  exploreCategoryLabel,
  liveMatchesExploreQuery,
  pickExploreResultTab,
} from "../lib/explore-search";
import { BROWSE_CATEGORIES, formatViewersFr } from "../mock/browse";
import { GOLD, LIVE_RED, initials } from "../theme";

export function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const { openList, openOverlay } = useNav();
  const { user, guestMode, openAuth } = useAuth();
  const { active, upcoming, loading: livesLoading } = useLivesFeed();
  const [raw, setRaw] = useState("");
  const [focused, setFocused] = useState(false);
  const [tab, setTab] = useState(0);
  const [sort, setSort] = useState<"recommended" | "popular" | "alpha">("recommended");
  const [sellerScope, setSellerScope] = useState<"all" | "live">("all");
  const [recent, setRecent] = useState(["jordan 4", "chanel", "iphone", "pokémon", "ysl"]);
  const [products, setProducts] = useState<ShopSearchHit[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [sellerHits, setSellerHits] = useState<SellerSearchHit[]>([]);
  const [sellersLoading, setSellersLoading] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const query = raw.trim();
  const searching = query.length > 0;
  const routedQuery = useRef("");

  const toggleFollow = async (sellerId: string) => {
    if (guestMode || !user) {
      openAuth();
      return;
    }
    if (!sellerId || sellerId === user.id) return;
    const prev = !!followingMap[sellerId];
    setFollowingMap((m) => ({ ...m, [sellerId]: !prev }));
    try {
      if (prev) await unfollowUser(sellerId);
      else await followUser(sellerId);
    } catch {
      setFollowingMap((m) => ({ ...m, [sellerId]: prev }));
    }
  };

  const liveResults = useMemo(() => {
    if (!query) return [];
    const match = (s: (typeof active)[number]) => liveMatchesExploreQuery(s, query);
    return [...active.filter(match), ...upcoming.filter(match)];
  }, [active, upcoming, query]);

  const liveSellerIds = useMemo(
    () => new Set(active.filter((s) => !s.scheduled && s.sellerId).map((s) => s.sellerId as string)),
    [active],
  );

  const trends = useMemo(() => {
    const byCat = new Map<string, { viewers: number; image: string }>();
    for (const l of active) {
      if (l.scheduled) continue;
      const key = l.category || "Other";
      const prev = byCat.get(key);
      byCat.set(key, {
        viewers: (prev?.viewers ?? 0) + (l.viewers || 0),
        image: prev?.image || l.thumbnail,
      });
    }
    return Array.from(byCat.entries())
      .map(([id, v]) => ({
        id,
        name: exploreCategoryLabel(id),
        viewers: v.viewers,
        image: v.image,
      }))
      .sort((a, b) => b.viewers - a.viewers)
      .slice(0, 8);
  }, [active]);

  useEffect(() => {
    if (!searching) {
      setProducts([]);
      setSellerHits([]);
      setProductsLoading(false);
      setSellersLoading(false);
      routedQuery.current = "";
      return;
    }
    let cancelled = false;
    setProductsLoading(true);
    setSellersLoading(true);
    void Promise.all([searchSellers(query), searchActiveShopProducts(query)]).then(
      ([sellers, rows]) => {
        if (cancelled) return;
        setSellerHits(sellers.map((r) => ({ ...r, live: liveSellerIds.has(r.id) })));
        setProducts(rows);
        setProductsLoading(false);
        setSellersLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [query, searching, liveSellerIds]);

  useEffect(() => {
    if (!searching || sellersLoading || productsLoading) return;
    if (routedQuery.current === query) return;
    routedQuery.current = query;
    setTab(
      pickExploreResultTab({
        query,
        liveCount: liveResults.length,
        sellerCount: sellerHits.length,
        productCount: products.length,
      }),
    );
  }, [
    query,
    searching,
    sellersLoading,
    productsLoading,
    liveResults.length,
    sellerHits.length,
    products.length,
  ]);

  const cats = useMemo(() => {
    const list = [...BROWSE_CATEGORIES];
    if (sort === "popular") list.sort((a, b) => b.viewers - a.viewers);
    if (sort === "alpha") list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return list;
  }, [sort]);

  const sellers = useMemo(() => {
    return sellerHits.filter((s) => sellerScope === "all" || s.live);
  }, [sellerHits, sellerScope]);

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
              {(
                [
                  ["search.tabs.lives", liveResults.length],
                  ["search.tabs.sellers", sellers.length],
                  ["search.tabs.products", products.length],
                ] as const
              ).map(([k, count], i) => (
                <Press key={k} onPress={() => setTab(i)} style={[styles.tab, tab === i && { borderBottomColor: GOLD }]}>
                  <Text style={{ fontWeight: tab === i ? "800" : "600", color: tab === i ? colors.foreground : colors.mutedForeground }}>
                    {count ? `${t(k)} (${count})` : t(k)}
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
                {sellersLoading ? (
                  <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} />
                ) : sellers.length === 0 ? (
                  <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 24 }}>
                    {t("search.emptyResults", { query })}
                  </Text>
                ) : (
                  sellers.map((s) => (
                  <Press
                    key={s.id}
                    onPress={() => openOverlay({ kind: "seller-profile", sellerId: s.id })}
                    style={styles.seller}
                  >
                    {s.avatar ? (
                      <Image source={{ uri: s.avatar }} style={styles.av} />
                    ) : (
                      <View style={[styles.av, { backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }]}>
                        <Text style={{ fontWeight: "800", color: colors.foreground }}>{initials(s.name)}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontWeight: "800", color: colors.foreground }}>{s.name}</Text>
                        {s.isVerified ? <VerifiedBadge size={14} /> : null}
                        <ReferredBadge referred={s.isReferred} size={13} />
                        {s.live ? (
                          <View style={styles.livePill}>
                            <Radio size={10} color="#fff" />
                            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>LIVE</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                        {s.handle ? `@${s.handle}` : s.name}
                        {` · ${s.followers} ${t("profile.stats.followers")}`}
                        {s.ratingAvg != null ? ` · ${s.ratingAvg.toFixed(1)}★` : ""}
                      </Text>
                    </View>
                    <Glass tone={dark ? "dark" : "light"} intensity={32} radius={999} elevated={false}>
                      <Press
                        style={styles.follow}
                        onPress={() => void toggleFollow(s.id)}
                      >
                        <Text style={{ fontWeight: "700", color: colors.foreground }}>
                          {followingMap[s.id]
                            ? t("follow.following", { defaultValue: "Abonné" })
                            : t("follow.follow")}
                        </Text>
                      </Press>
                    </Glass>
                  </Press>
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
                    <Press
                      key={p.id}
                      style={styles.cell}
                      onPress={() => openOverlay({ kind: "seller-profile", sellerId: p.sellerId })}
                    >
                      <Glass tone={dark ? "dark" : "light"} intensity={28} radius={16} elevated={false}>
                        <Image source={{ uri: p.image }} style={{ width: "100%", aspectRatio: 1 }} contentFit="cover" />
                        <View style={{ padding: 8 }}>
                          <Text numberOfLines={2} style={{ fontWeight: "700", color: colors.foreground }}>{p.name}</Text>
                          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{p.seller}</Text>
                          <Text style={{ fontWeight: "800", color: GOLD, marginTop: 4 }}>{p.price}</Text>
                        </View>
                      </Glass>
                    </Press>
                  ))}
                </View>
              )
            ) : null}
          </View>
        ) : (
          <View>
            {trends.length > 0 ? (
              <>
            <Text style={[styles.h, { color: colors.foreground, paddingHorizontal: 16 }]}>{t("search.trending")}</Text>
            <View style={styles.trends}>
              {trends.map((tr) => (
                <Press
                  key={tr.id}
                  onPress={() => {
                    setRaw(tr.id);
                    setFocused(true);
                    setTab(0);
                    routedQuery.current = tr.id;
                    setRecent((prev) => [tr.name, ...prev.filter((x) => x !== tr.name)].slice(0, 8));
                  }}
                  style={styles.trendPress}
                >
                  <Glass tone={dark ? "dark" : "light"} intensity={32} radius={14} elevated={false}>
                    <View style={styles.trend}>
                      <Image source={{ uri: tr.image }} style={styles.trendImg} contentFit="cover" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "700", color: colors.foreground, fontSize: 13 }}>{tr.name}</Text>
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
              </>
            ) : null}
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
                <Press
                  key={c.id}
                  onPress={() => {
                    const q = browseTileSearchQuery(c.id);
                    setRaw(q);
                    setFocused(true);
                    setTab(0);
                    routedQuery.current = q;
                    setRecent((prev) => [t(c.nameKey), ...prev.filter((x) => x !== t(c.nameKey))].slice(0, 8));
                  }}
                  style={styles.cat}
                >
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
