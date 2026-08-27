import { Image, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Press } from "./Press";
import { ExploreIcon, HomeIcon, PersonIcon, VitrineIcon } from "./TabIcons";
import { GOLD, LIVE_BADGE, NAVY } from "../theme";
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
        <Icon active={isActive} color={color} fillBg={colors.background} />
        <Text style={[styles.label, { color, fontWeight: isActive ? "600" : "500" }]}>{t(labelKey)}</Text>
        {isActive ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : <View style={styles.dotSpacer} />}
      </Press>
    );
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View
        pointerEvents="none"
        style={[
          styles.fade,
          {
            backgroundColor: dark
              ? "transparent"
              : undefined,
          },
        ]}
      />
      <View style={styles.inner}>
        <View
          style={[
            styles.pill,
            {
              backgroundColor: dark ? "rgba(20,27,51,0.92)" : "rgba(255,255,255,0.92)",
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.row}>
            {LEFT.map(renderTab)}
            <View style={styles.centerSpacer} />
            {RIGHT.map(renderTab)}
          </View>
        </View>
        <View pointerEvents="box-none" style={styles.liveWrap}>
          <Press accessibilityLabel={t("tabs.live")} onPress={() => onChange("live")} style={styles.liveBtn} haptic="light">
            <View style={styles.liveGlow} />
            <Image source={liveBadge} style={styles.liveImg} />
            <Text
              style={[
                styles.label,
                {
                  marginTop: 2,
                  color: active === "live" ? colors.accent : colors.mutedForeground,
                  fontWeight: active === "live" ? "600" : "500",
                },
              ]}
            >
              {t("tabs.live")}
            </Text>
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
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: -8,
  },
  inner: {
    marginHorizontal: 16,
    marginBottom: 4,
    height: 64,
  },
  pill: {
    height: 64,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    overflow: "hidden",
  },
  row: {
    flex: 1,
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
    left: 0,
    right: 0,
    top: -20,
    alignItems: "center",
  },
  liveBtn: {
    minHeight: 0,
    minWidth: 0,
    alignItems: "center",
  },
  liveGlow: {
    position: "absolute",
    width: LIVE_BADGE - 8,
    height: LIVE_BADGE - 8,
    borderRadius: 16,
    top: 4,
    shadowColor: GOLD,
    shadowOpacity: 0.42,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  liveImg: {
    width: LIVE_BADGE,
    height: LIVE_BADGE,
    resizeMode: "contain",
  },
});

export const TAB_SAFE_PADDING = 88;
