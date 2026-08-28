import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Press } from "../Press";
import { GOLD, initials, NAVY } from "../../theme";
import { supabase } from "../../lib/supabase";
import { isHttpUrl } from "../../lib/storage";

export type StoryItem = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  media_url: string;
};

export function StoriesRow({ onPress }: { onPress: (stories: StoryItem[], index: number) => void }) {
  const [stories, setStories] = useState<StoryItem[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("vitrine_posts")
        .select("id, user_id, media_url, profiles!inner(display_name, avatar_url)")
        .eq("media_type", "video")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!alive || !data) return;
      const items: StoryItem[] = (data as any[]).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        display_name: (row.profiles as any)?.display_name ?? "?",
        avatar_url: (row.profiles as any)?.avatar_url ?? null,
        media_url: row.media_url,
      }));
      setStories(items);
    };
    void load();
    return () => { alive = false; };
  }, []);

  if (stories.length === 0) return null;

  return (
    <FlatList
      data={stories}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <Press onPress={() => onPress(stories, index)} style={styles.item}>
          <View style={styles.ring}>
            {isHttpUrl(item.avatar_url) ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.fallback]}>
                <Text style={styles.initials}>{initials(item.display_name)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.name} numberOfLines={1}>{item.display_name.split(" ")[0]}</Text>
        </Press>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 12, paddingVertical: 10, gap: 12 },
  item: { alignItems: "center", width: 68, minHeight: 0 },
  ring: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
    borderColor: GOLD,
    padding: 2,
  },
  avatar: { flex: 1, borderRadius: 28, backgroundColor: NAVY },
  fallback: { alignItems: "center", justifyContent: "center" },
  initials: { color: "#fff", fontSize: 16, fontWeight: "800" },
  name: { marginTop: 4, fontSize: 11, fontWeight: "600", color: "#fff", textAlign: "center" },
});
