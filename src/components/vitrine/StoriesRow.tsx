import { FlatList, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { GOLD, initials, NAVY } from "../../theme";
import { isHttpUrl } from "../../lib/storage";
import type { VitrineStory } from "../../lib/vitrine-stories";

export type StoryItem = VitrineStory;

export function StoriesRow({
  stories,
  onPress,
  onAdd,
}: {
  stories: VitrineStory[];
  onPress: (stories: VitrineStory[], index: number) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();

  return (
    <FlatList
      data={stories}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <Press onPress={onAdd} style={styles.item}>
          <View style={styles.yourRing}>
            <View style={styles.plusDisk}>
              <Plus size={22} color="#fff" />
            </View>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {t("vitrine.yourStory")}
          </Text>
        </Press>
      }
      renderItem={({ item, index }) => (
        <Press onPress={() => onPress(stories, index)} style={styles.item}>
          <View style={[styles.ring, !item.unread && styles.ringRead]}>
            {isHttpUrl(item.avatarUrl ?? item.posterUrl) ? (
              <Image source={{ uri: item.avatarUrl || item.posterUrl || item.mediaUrl }} style={styles.avatar} />
            ) : isHttpUrl(item.mediaUrl) && !item.mediaUrl.includes("video") ? (
              <Image source={{ uri: item.mediaUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.fallback]}>
                <Text style={styles.initials}>{initials(item.displayName)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {item.displayName.split(" ")[0]}
          </Text>
        </Press>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 12, paddingVertical: 10, gap: 12, alignItems: "center" },
  item: { alignItems: "center", width: 68, minHeight: 0 },
  yourRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  plusDisk: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
    borderColor: GOLD,
    padding: 2,
  },
  ringRead: { borderColor: "rgba(255,255,255,0.35)" },
  avatar: { flex: 1, borderRadius: 28, backgroundColor: NAVY },
  fallback: { alignItems: "center", justifyContent: "center" },
  initials: { color: "#fff", fontSize: 16, fontWeight: "800" },
  name: { marginTop: 4, fontSize: 11, fontWeight: "600", color: "#fff", textAlign: "center" },
});
