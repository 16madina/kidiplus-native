import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Press } from "./Press";
import { Glass } from "./Glass";
import { ExploreIcon, HomeIcon, PersonIcon, VitrineIcon } from "./TabIcons";
import { GOLD, LIVE_BADGE } from "../theme";
import { useAppTheme } from "../context/theme";
import type { TabKey } from "../context/navigation";

const liveBadge = require("../../assets/brand/kidi-live-round.png");

type TabDef = { key: TabKey; labelKey: string; Icon: typeof HomeIcon };

const LEFT: TabDef[] = [
  { key: "home", labelKey: "tabs.home", Icon: HomeIcon },
  { key: "search", labelKey: "tabs.search", Icon: ExploreIcon },
];
const RIGHT: TabDef[] = [
  { key: "vitrine", labelKey: "tabs.vitrine", Icon: VitrineIcon },
  { key: "profile", labelKey: "tabs.profile", Icon: PersonIcon },
];

export function BottomTabBar({
  active,
  onChange,
  hidden,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
  hidden?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  if (hidden) return null;

  const renderTab = ({ key, labelKey, Icon }: TabDef) => {
    const isActive = active === key;
    const color = isActive ? colors.accent : colors.mutedForeground;
    return (
      <Press
        key={key}
        accessibilityLabel={t(labelKey)}
        onPress={() => onChange(key)}
        style={styles.tab}
        haptic="light"
      >
        <Icon active={isActive} color={color} fillBg={dark ? "#0C1122" : "#fff"} />
        <Text style={[styles.label, { color, fontWeight: isActive ? "700" : "500" }]}>{t(labelKey)}</Text>
        {isActive ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : <View style={styles.dotSpacer} />}
      </Press>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <LinearGradient
        colors={
          dark
            ? ["rgba(12,17,34,0)", "rgba(12,17,34,0.72)", "rgba(12,17,34,0.96)"]
            : ["rgba(255,255,255,0)", "rgba(255,255,255,0.55)", "rgba(248,249,252,0.92)"]
        }
        style={styles.fade}
        pointerEvents="none"
      />
      <View style={styles.inner}>
        <Glass tone={dark ? "dark" : "light"} intensity={55} radius={32} style={styles.pill}>
          <View style={styles.row}>
            {LEFT.map(renderTab)}
            <View style={styles.centerSpacer} />
            {RIGHT.map(renderTab)}
          </View>
        </Glass>
        <View style={styles.liveWrap} pointerEvents="box-none">
          <Press accessibilityLabel={t("tabs.live")} onPress={() => onChange("live")} style={styles.liveBtn} haptic="light">
            <View style={styles.badgeSlot}>
              <View style={styles.liveGlow} pointerEvents="none" />
              <Image
                source={liveBadge}
                style={styles.liveImg}
                contentFit="contain"
                accessibilityLabel="KiDi+"
              />
            </View>
            <Text
              style={[
                styles.label,
                {
                  marginTop: 2,
                  color: active === "live" ? colors.accent : colors.mutedForeground,
                  fontWeight: active === "live" ? "700" : "500",
                },
              ]}
            >
              {t("tabs.live")}
            </Text>
            {active === "live" ? (
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
            ) : (
              <View style={styles.dotSpacer} />
            )}
          </Press>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    elevation: 50,
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  inner: {
    marginHorizontal: 16,
    marginBottom: 4,
    height: 64,
    overflow: "visible",
  },
  pill: {
    height: 64,
  },
  row: {
    height: 64,
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  centerSpacer: { width: 88 },
  label: { fontSize: 10, lineHeight: 12 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  dotSpacer: { width: 4, height: 4, marginTop: 2 },
  liveWrap: {
    position: "absolute",
    top: -20,
    left: "50%",
    width: 88,
    marginLeft: -44,
    alignItems: "center",
    zIndex: 60,
    elevation: 60,
  },
  liveBtn: {
    minHeight: 0,
    minWidth: 0,
    alignItems: "center",
  },
  badgeSlot: {
    width: LIVE_BADGE,
    height: LIVE_BADGE,
    alignItems: "center",
    justifyContent: "center",
  },
  liveGlow: {
    position: "absolute",
    width: LIVE_BADGE - 8,
    height: LIVE_BADGE - 8,
    borderRadius: 18,
    backgroundColor: "rgba(232,185,59,0.22)",
    shadowColor: GOLD,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    // No Android elevation — it was painting over the logo.
  },
  liveImg: {
    width: LIVE_BADGE,
    height: LIVE_BADGE,
    zIndex: 2,
  },
});

export const TAB_SAFE_PADDING = 88;
