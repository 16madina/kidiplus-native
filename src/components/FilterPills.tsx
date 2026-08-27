import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SlidersHorizontal } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "./Press";
import { Glass } from "./Glass";
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
  const { colors, dark } = useAppTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Press onPress={onOpenFilters} style={styles.press}>
        <Glass tone={dark ? "dark" : "light"} intensity={36} radius={999} elevated={false}>
          <View style={styles.pill}>
            <SlidersHorizontal size={14} color={colors.foreground} strokeWidth={2.2} />
            <Text style={[styles.text, { color: colors.foreground }]}>{t("home.filters.filter")}</Text>
          </View>
        </Glass>
      </Press>
      {HOME_FILTERS.map((f) => {
        const isActive = f === active;
        return (
          <Press key={f} onPress={() => onChange(f)} style={styles.press}>
            <Glass
              tone={isActive ? "gold" : dark ? "dark" : "light"}
              intensity={isActive ? 52 : 36}
              radius={999}
              elevated={false}
            >
              <View style={styles.pill}>
                <Text style={[styles.text, { color: isActive ? "#fff" : colors.foreground }]}>
                  {t(HOME_FILTER_LABEL_KEY[f])}
                </Text>
              </View>
            </Glass>
          </Press>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  press: { minHeight: 32, minWidth: 0 },
  pill: {
    height: 32,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  text: { fontSize: 12.5, fontWeight: "600" },
});
