import { useEffect } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { RefreshCw, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { useFilter } from "../../lib/filters/filter-context";
import type { Lens } from "../../lib/filters/lenses-catalog";
import { GOLD, NAVY } from "../../theme";

export function FiltersCarousel({
  open,
  onClose,
  doneLabel,
  hint,
}: {
  open: boolean;
  onClose: () => void;
  doneLabel?: string;
  hint?: string;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    lenses,
    activeLens,
    setActiveLens,
    loadLenses,
    refreshLenses,
    lensesLoading,
    lensesError,
    cameraKitReady,
  } = useFilter();

  useEffect(() => {
    if (open) loadLenses();
  }, [open, loadLenses]);

  if (!open) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
    >
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{t("broadcast.filters.title", "Filtres")}</Text>
          <Press
            onPress={() => refreshLenses()}
            style={styles.iconBtn}
            accessibilityLabel={t("broadcast.filters.refresh", "Actualiser")}
          >
            <RefreshCw size={12} color="#fff" />
          </Press>
          <Text style={styles.activeName} numberOfLines={1}>
            {activeLens.lensId === "none" ? t("broadcast.filters.none", "Aucun") : activeLens.name}
          </Text>
        </View>
        <Press
          onPress={onClose}
          style={doneLabel ? styles.doneBtn : styles.iconBtn}
          accessibilityLabel={doneLabel ?? t("common.close", "Fermer")}
        >
          {doneLabel ? (
            <Text style={styles.doneTxt}>{doneLabel}</Text>
          ) : (
            <X size={14} color="#fff" />
          )}
        </Press>
      </View>

      {!cameraKitReady ? (
        <Text style={styles.banner}>
          {t(
            "broadcast.filters.nativePending",
            "Filtres AR Snap : rebuild natif requis. Styles locaux disponibles.",
          )}
        </Text>
      ) : null}
      {lensesError ? <Text style={styles.error}>{lensesError}</Text> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {lensesLoading && lenses.length <= 1 ? (
          <View style={styles.loading}>
            <ActivityIndicator color={GOLD} />
          </View>
        ) : (
          lenses.map((lens) => (
            <LensThumb
              key={`${lens.groupId}:${lens.lensId}`}
              lens={lens}
              active={activeLens.lensId === lens.lensId}
              onPress={() => setActiveLens(lens)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function LensThumb({
  lens,
  active,
  onPress,
}: {
  lens: Lens;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Press onPress={onPress} style={styles.thumb} accessibilityRole="button">
      <View style={[styles.swatch, active && styles.swatchOn]}>
        {lens.iconUrl ? (
          <Image source={{ uri: lens.iconUrl }} style={styles.swatchImg} contentFit="cover" />
        ) : (
          <Text style={styles.emoji}>{lens.icon}</Text>
        )}
      </View>
      <Text style={[styles.thumbName, active && styles.thumbNameOn]} numberOfLines={1}>
        {lens.name}
      </Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 120,
    elevation: 24,
    paddingHorizontal: 12,
    paddingTop: 14,
    backgroundColor: "rgba(0,0,0,0.78)",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(232,185,59,0.35)",
  },
  hint: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  title: { color: "#fff", fontWeight: "800", fontSize: 13 },
  activeName: { color: "rgba(255,255,255,0.6)", fontSize: 11, flexShrink: 1 },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },
  doneBtn: {
    height: 36,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GOLD,
  },
  doneTxt: { color: NAVY, fontWeight: "800", fontSize: 12 },
  banner: {
    color: GOLD,
    fontSize: 11,
    marginBottom: 8,
    textAlign: "center",
    fontWeight: "700",
  },
  error: {
    color: "#ff8a8a",
    fontSize: 11,
    marginBottom: 8,
    textAlign: "center",
  },
  row: { gap: 12, paddingVertical: 4, paddingRight: 16, alignItems: "flex-start" },
  loading: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  thumb: { width: 72, alignItems: "center", gap: 6, minHeight: 0, minWidth: 0 },
  swatch: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  swatchOn: { borderColor: GOLD, borderWidth: 3 },
  swatchImg: { width: "100%", height: "100%" },
  emoji: { fontSize: 26 },
  thumbName: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" },
  thumbNameOn: { color: "#fff", fontWeight: "800" },
});
