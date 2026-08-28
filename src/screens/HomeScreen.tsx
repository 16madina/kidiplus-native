import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Check, Moon, Store, Sun } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Logo } from "../components/Logo";
import { CategoryTiles } from "../components/CategoryTiles";
import { FilterPills } from "../components/FilterPills";
import { LiveCard } from "../components/LiveCard";
import { Press } from "../components/Press";
import { Glass, GlassIconButton } from "../components/Glass";
import { UpcomingLivesRow } from "../components/UpcomingLivesRow";
import { EmailConfirmBanner } from "../components/EmailConfirmBanner";
import { TAB_SAFE_PADDING } from "../components/BottomTabBar";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import { useAppTheme } from "../context/theme";
import { useLivesFeed } from "../hooks/useLivesFeed";
import { useBlockedIds } from "../lib/moderation";
import {
  applyHomeCategory,
  sampleLivesForCategory,
  sortLivesNewestFirst,
  type HomeCategory,
  type HomeFilter,
} from "../mock/home-categories";
import { mergeUpcomingWithDemos } from "../mock/upcoming-demos";
import { GOLD, NAVY } from "../theme";

const demoPoster = require("../../assets/demo-live-poster.jpg");

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, dark, setDark } = useAppTheme();
  const { user, openAuth } = useAuth();
  const { openList, openOverlay } = useNav();
  const { active, upcoming, loading } = useLivesFeed();
  const blockedIds = useBlockedIds();
  const [category, setCategory] = useState<HomeCategory>("Pour toi");
  const [filter, setFilter] = useState<HomeFilter>("Recommandés");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [liveOnly, setLiveOnly] = useState(false);

  const upcomingRow = useMemo(
    () =>
      mergeUpcomingWithDemos(
        upcoming.filter((s) => !s.sellerId || !blockedIds.has(s.sellerId)),
      ),
    [upcoming, blockedIds],
  );

  const filtered = useMemo(() => {
    const unblocked = active.filter((s) => !s.sellerId || !blockedIds.has(s.sellerId));
    const scopedReal = applyHomeCategory(unblocked, category);
    const samples = sampleLivesForCategory(category, scopedReal.length);
    let list = sortLivesNewestFirst([...scopedReal, ...samples]);
    if (filter === "Populaires") list = [...list].sort((a, b) => b.viewers - a.viewers);
    if (filter === "Nouveautés") list = sortLivesNewestFirst(list);
    if (liveOnly) list = list.filter((s) => !s.scheduled);
    return list;
  }, [active, category, filter, liveOnly, blockedIds]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Glass
          tone={dark ? "dark" : "light"}
          intensity={55}
          radius={0}
          borderless
          elevated={false}
          style={styles.headerFrost}
        />
        <Logo size={40} />
        <View style={styles.headerRight}>
          <GlassIconButton tone={dark ? "dark" : "light"} onPress={() => openOverlay({ kind: "activity" })}>
            <Bell size={20} color={colors.foreground} strokeWidth={1.9} />
          </GlassIconButton>
          <GlassIconButton tone={dark ? "dark" : "light"} onPress={() => setDark(!dark)}>
            {dark ? (
              <Moon size={20} color={colors.foreground} strokeWidth={1.9} />
            ) : (
              <Sun size={20} color={colors.foreground} strokeWidth={1.9} />
            )}
          </GlassIconButton>
          <GlassIconButton
            tone={dark ? "dark" : "light"}
            onPress={() => (user ? openOverlay({ kind: "shop" }) : openAuth())}
          >
            <Store size={18} color={colors.foreground} strokeWidth={1.9} />
          </GlassIconButton>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_SAFE_PADDING + insets.bottom }}
      >
        <View style={{ height: 8 }} />
        <EmailConfirmBanner />
        <CategoryTiles active={category} onChange={setCategory} />
        <View style={{ height: 12 }} />
        <FilterPills active={filter} onChange={setFilter} onOpenFilters={() => setFilterSheetOpen(true)} />

        <UpcomingLivesRow items={upcomingRow} onOpen={openList} />

        <Text style={[styles.section, { color: colors.foreground }]}>{t("home.livesNearYou")}</Text>
        {loading ? (
          <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.grid}>
            <Press
              onPress={() => {
                if (filtered[0]) openList(filtered, 0);
              }}
              style={styles.demo}
            >
              <Image source={demoPoster} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={styles.demoBadge}>
                <Glass tone="gold" intensity={36} radius={8} elevated={false}>
                  <Text style={styles.demoBadgeText}>{t("home.demo.badge")}</Text>
                </Glass>
              </View>
              <View style={styles.demoBottom}>
                <Glass tone="dark" intensity={36} radius={12} elevated={false} padded>
                  <Text style={styles.demoTitle}>{t("home.demo.title")}</Text>
                  <Text style={styles.demoSub}>{t("home.demo.subtitle")}</Text>
                </Glass>
              </View>
            </Press>
            {filtered.map((s) => (
              <View key={s.id} style={styles.cell}>
                <LiveCard stream={s} onPress={() => openList(filtered, filtered.indexOf(s))} />
              </View>
            ))}
          </View>
        )}
        {!loading && filtered.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 16, marginBottom: 32, paddingHorizontal: 24 }}>
            {t("home.empty")}
          </Text>
        ) : null}
      </ScrollView>

      <Modal visible={filterSheetOpen} animationType="slide" transparent onRequestClose={() => setFilterSheetOpen(false)}>
        <Press style={styles.sheetBg} onPress={() => setFilterSheetOpen(false)} haptic="none">
          <View />
        </Press>
        <Glass
          tone={dark ? "dark" : "light"}
          intensity={58}
          radius={28}
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
        >
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{t("home.filters.filter")}</Text>
            <Press
              onPress={() => {
                setFilter("Recommandés");
                setLiveOnly(false);
              }}
              style={{ minHeight: 32 }}
            >
              <Text style={{ color: GOLD, fontWeight: "700" }}>Réinitialiser</Text>
            </Press>
          </View>
          {(["Recommandés", "Populaires", "Nouveautés", "Achat immédiat"] as HomeFilter[]).map((f) => (
            <Press
              key={f}
              onPress={() => setFilter(f)}
              style={styles.sheetRow}
            >
              <Glass tone={filter === f ? "gold" : dark ? "dark" : "light"} intensity={32} radius={16} elevated={false} style={{ width: "100%" }}>
                <View style={styles.sheetRowInner}>
                  <Text style={{ fontWeight: "700", color: colors.foreground }}>{t(
                    f === "Recommandés" ? "home.filters.recommended" : f === "Populaires" ? "home.filters.popular" : f === "Nouveautés" ? "home.filters.new" : "home.filters.buyNow",
                  )}</Text>
                  {filter === f ? <Check size={18} color={GOLD} /> : null}
                </View>
              </Glass>
            </Press>
          ))}
          <Press
            onPress={() => setLiveOnly(!liveOnly)}
            style={styles.sheetRow}
          >
            <Glass tone={liveOnly ? "gold" : dark ? "dark" : "light"} intensity={32} radius={16} elevated={false} style={{ width: "100%" }}>
              <View style={styles.sheetRowInner}>
                <Text style={{ fontWeight: "700", color: colors.foreground }}>Uniquement en direct</Text>
                {liveOnly ? <Check size={18} color={GOLD} /> : null}
              </View>
            </Glass>
          </Press>
          <Press onPress={() => setFilterSheetOpen(false)} style={[styles.apply, { backgroundColor: GOLD }]}>
            <Text style={{ fontWeight: "800", color: NAVY }}>Voir les résultats</Text>
          </Press>
        </Glass>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    height: "auto",
    paddingBottom: 10,
    overflow: "hidden",
  },
  headerFrost: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  grid: {
    paddingHorizontal: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cell: { width: "48.5%" },
  demo: {
    width: "48.5%",
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: NAVY,
    minHeight: 0,
    minWidth: 0,
    alignItems: "stretch",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
  },
  demoBadge: {
    position: "absolute",
    top: 8,
    left: 8,
  },
  demoBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 4 },
  demoBottom: { position: "absolute", left: 8, right: 8, bottom: 8 },
  demoTitle: { color: "#fff", fontWeight: "800", fontSize: 13 },
  demoSub: { color: "rgba(255,255,255,0.8)", fontSize: 11, marginTop: 2 },
  sheetBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", minHeight: 0 },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 16,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.45)", marginBottom: 12 },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingHorizontal: 4 },
  sheetTitle: { fontSize: 17, fontWeight: "800" },
  sheetRow: {
    minHeight: 48,
    marginBottom: 6,
    width: "100%",
    alignItems: "stretch",
  },
  sheetRowInner: {
    height: 48,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  apply: { marginTop: 16, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
