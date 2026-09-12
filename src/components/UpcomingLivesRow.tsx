import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Press } from "./Press";
import type { LiveStream } from "../mock/lives";
import { useAppTheme } from "../context/theme";

export function UpcomingLivesRow({
  items,
  onOpen,
}: {
  items: LiveStream[];
  onOpen: (list: LiveStream[], index: number) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.foreground }]}>
        {t("schedule.upcomingTitle", "À venir 📅")}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {items.map((s, i) => (
          <Press
            key={s.id}
            onPress={() => onOpen(items, i)}
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel={`${s.seller}, ${s.startsInMin ?? "?"} min`}
          >
            <Image source={{ uri: s.thumbnail }} style={styles.img} contentFit="cover" />
            <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>
              {s.seller}
            </Text>
            <Text numberOfLines={1} style={[styles.when, { color: colors.mutedForeground }]}>
              {s.startsInMin != null ? `${s.startsInMin} min` : "—"}
            </Text>
            {s.deliversToMe === false ? (
              <Text numberOfLines={2} style={styles.noShip}>
                {t("delivery.feedBadge", "Ne livre pas dans ton pays")}
              </Text>
            ) : null}
          </Press>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, paddingTop: 8 },
  title: {
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  row: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  card: {
    width: 96,
    minHeight: 0,
    minWidth: 0,
    alignItems: "flex-start",
  },
  img: {
    width: 96,
    height: 96,
    borderRadius: 18,
    backgroundColor: "rgba(16,22,43,0.08)",
  },
  name: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
    maxWidth: 96,
  },
  when: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
    maxWidth: 96,
  },
  noShip: {
    fontSize: 9,
    fontWeight: "800",
    color: "#B45309",
    marginTop: 2,
    maxWidth: 96,
  },
});
