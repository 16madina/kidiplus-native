import { ScrollView, StyleSheet, Text } from "react-native";
import { SlidersHorizontal } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "./Press";
import { NAVY_700 } from "../theme";
import { useAppTheme } from "../context/theme";
import {
  HOME_FILTERS,
  HOME_FILTER_LABEL_KEY,
  type HomeFilter,
} from "../mock/home-categories";

export function FilterPills({
  active,
  onChange,
  onOpenFilters,
}: {
  active: HomeFilter;
  onChange: (f: HomeFilter) => void;
  onOpenFilters?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Press
        onPress={onOpenFilters}
        style={[styles.pill, { backgroundColor: colors.muted }]}
      >
        <SlidersHorizontal size={14} color={colors.foreground} strokeWidth={2.2} />
        <Text style={[styles.text, { color: colors.foreground }]}>{t("home.filters.filter")}</Text>
      </Press>
      {HOME_FILTERS.map((f) => {
        const isActive = f === active;
        return (
          <Press
            key={f}
            onPress={() => onChange(f)}
            style={[
              styles.pill,
              { backgroundColor: isActive ? NAVY_700 : colors.muted },
            ]}
          >
            <Text style={[styles.text, { color: isActive ? "#fff" : colors.foreground }]}>
              {t(HOME_FILTER_LABEL_KEY[f])}
            </Text>
          </Press>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 8 },
  pill: {
    height: 32,
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  text: { fontSize: 12.5, fontWeight: "600" },
});
