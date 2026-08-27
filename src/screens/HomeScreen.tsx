import { useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Check, Moon, Store, Sun } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Logo } from "../components/Logo";
import { CategoryTiles } from "../components/CategoryTiles";
import { FilterPills } from "../components/FilterPills";
import { LiveCard } from "../components/LiveCard";
import { Press } from "../components/Press";
import { TAB_SAFE_PADDING } from "../components/BottomTabBar";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import { useAppTheme } from "../context/theme";
import { makeStreams } from "../mock/lives";
import {
  applyHomeCategory,
  sampleLivesForCategory,
  sortLivesNewestFirst,
  type HomeCategory,
  type HomeFilter,
} from "../mock/home-categories";
import { GOLD, NAVY } from "../theme";

const demoPoster = require("../../assets/demo-live-poster.jpg");

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, dark, setDark } = useAppTheme();
  const { user, guestMode, openAuth } = useAuth();
  const { openList, openOverlay } = useNav();
  const [category, setCategory] = useState<HomeCategory>("Pour toi");
  const [filter, setFilter] = useState<HomeFilter>("Recommandés");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [liveOnly, setLiveOnly] = useState(false);

  const filtered = useMemo(() => {
    const pool = makeStreams(0, 36);
    const scoped = applyHomeCategory(pool, category);
    const samples = sampleLivesForCategory(category, 0);
    let list = sortLivesNewestFirst([...scoped, ...samples]);
    if (filter === "Populaires") list = [...list].sort((a, b) => b.viewers - a.viewers);
    if (filter === "Nouveautés") list = [...list].reverse();
    if (liveOnly) list = list.filter((s) => !s.scheduled);
    return list;
  }, [category, filter, liveOnly]);

  const upcoming = useMemo(
    () => makeStreams(0, 24).filter((s) => s.scheduled).slice(0, 8),
    [],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Logo size={40} />
        <View style={styles.headerRight}>
          <Press onPress={() => openOverlay({ kind: "activity" })} style={styles.iconBtn}>
            <Bell size={22} color={colors.foreground} strokeWidth={1.9} />
          </Press>
          <Press onPress={() => setDark(!dark)} style={styles.iconBtn}>
            {dark ? (
              <Moon size={22} color={colors.foreground} strokeWidth={1.9} />
            ) : (
              <Sun size={22} color={colors.foreground} strokeWidth={1.9} />
            )}
          </Press>
          <Press
            onPress={() => (user ? openOverlay({ kind: "shop" }) : openAuth())}
            style={styles.iconBtn}
          >
            <Store size={20} color={colors.foreground} strokeWidth={1.9} />
          </Press>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_SAFE_PADDING + insets.bottom }}
      >
        <View style={{ height: 8 }} />
        <CategoryTiles active={category} onChange={setCategory} />
        <View style={{ height: 12 }} />
        <FilterPills active={filter} onChange={setFilter} onOpenFilters={() => setFilterSheetOpen(true)} />

        {upcoming.length > 0 ? (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.section, { color: colors.foreground, paddingHorizontal: 16 }]}>
              {t("schedule.upcomingTitle")}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingTop: 8 }}>
              {upcoming.map((s) => (
                <Press key={s.id} onPress={() => openList(upcoming, upcoming.indexOf(s))} style={styles.upCard}>
                  <Image source={{ uri: s.thumbnail }} style={styles.upImg} contentFit="cover" />
                  <Text numberOfLines={1} style={styles.upName}>{s.seller}</Text>
                  <Text numberOfLines={1} style={styles.upWhen}>{s.startsInMin} min</Text>
                </Press>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Text style={[styles.section, { color: colors.foreground }]}>{t("home.livesNearYou")}</Text>
        <View style={styles.grid}>
          <Press
            onPress={() => {
              if (filtered[0]) openList(filtered, 0);
            }}
            style={styles.demo}
          >
            <Image source={demoPoster} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>{t("home.demo.badge")}</Text>
            </View>
            <View style={styles.demoBottom}>
              <Text style={styles.demoTitle}>{t("home.demo.title")}</Text>
              <Text style={styles.demoSub}>{t("home.demo.subtitle")}</Text>
            </View>
          </Press>
          {filtered.map((s) => (
            <View key={s.id} style={styles.cell}>
              <LiveCard stream={s} onPress={() => openList(filtered, filtered.indexOf(s))} />
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={filterSheetOpen} animationType="slide" transparent onRequestClose={() => setFilterSheetOpen(false)}>
        <Press style={styles.sheetBg} onPress={() => setFilterSheetOpen(false)} haptic="none">
          <View />
        </Press>
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
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
              style={[styles.sheetRow, filter === f && { backgroundColor: "rgba(232,185,59,0.12)" }]}
            >
              <Text style={{ fontWeight: "700", color: colors.foreground }}>{t(
                f === "Recommandés" ? "home.filters.recommended" : f === "Populaires" ? "home.filters.popular" : f === "Nouveautés" ? "home.filters.new" : "home.filters.buyNow",
              )}</Text>
              {filter === f ? <Check size={18} color={GOLD} /> : null}
            </Press>
          ))}
          <Press
            onPress={() => setLiveOnly(!liveOnly)}
            style={[styles.sheetRow, liveOnly && { backgroundColor: "rgba(232,185,59,0.12)" }]}
          >
            <Text style={{ fontWeight: "700", color: colors.foreground }}>Uniquement en direct</Text>
            {liveOnly ? <Check size={18} color={GOLD} /> : null}
          </Press>
          <Press onPress={() => setFilterSheetOpen(false)} style={[styles.apply, { backgroundColor: GOLD }]}>
            <Text style={{ fontWeight: "800", color: NAVY }}>Voir les résultats</Text>
          </Press>
        </View>
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
    paddingBottom: 8,
  },
  headerRight: { flexDirection: "row", alignItems: "center" },
  iconBtn: { width: 44, height: 44 },
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
  },
  demoBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: NAVY,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  demoBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  demoBottom: { position: "absolute", left: 10, right: 10, bottom: 10 },
  demoTitle: { color: "#fff", fontWeight: "800", fontSize: 13 },
  demoSub: { color: "rgba(255,255,255,0.8)", fontSize: 11, marginTop: 2 },
  upCard: { width: 88, minHeight: 0, minWidth: 0, alignItems: "flex-start" },
  upImg: { width: 88, height: 88, borderRadius: 16 },
  upName: { fontSize: 11, fontWeight: "700", marginTop: 4, color: "#10162B" },
  upWhen: { fontSize: 10, color: "#6B7289" },
  sheetBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", minHeight: 0 },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#D7DAE3", marginBottom: 12 },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sheetTitle: { fontSize: 17, fontWeight: "800" },
  sheetRow: {
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  apply: { marginTop: 16, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
