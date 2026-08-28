import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { Press } from "../Press";
import { initials, NAVY } from "../../theme";
import { isHttpUrl } from "../../lib/storage";
import type { StoryItem } from "./StoriesRow";

const { width: SCREEN_W } = Dimensions.get("window");
const STORY_DURATION = 5000;

export function StoryViewer({
  stories,
  initialIndex,
  visible,
  onClose,
}: {
  stories: StoryItem[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const progress = useRef(new Animated.Value(0)).current;

  const story = stories[index];

  const advance = useCallback(() => {
    if (index < stories.length - 1) {
      setIndex((i) => i + 1);
    } else {
      onClose();
    }
  }, [index, stories.length, onClose]);

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => { if (finished) advance(); });
    return () => anim.stop();
  }, [visible, index]);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  if (!story) return null;

  const handlePress = (evt: any) => {
    const x = evt.nativeEvent.locationX;
    if (x < SCREEN_W / 3) {
      if (index > 0) setIndex((i) => i - 1);
    } else {
      advance();
    }
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent>
      <View style={styles.root}>
        <View style={styles.progressRow}>
          {stories.map((_, i) => (
            <View key={i} style={styles.progressBg}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width:
                      i < index
                        ? "100%"
                        : i === index
                          ? progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })
                          : "0%",
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.header}>
          <View style={styles.userRow}>
            {isHttpUrl(story.avatar_url) ? (
              <Image source={{ uri: story.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.fallback]}>
                <Text style={styles.initials}>{initials(story.display_name)}</Text>
              </View>
            )}
            <Text style={styles.name}>{story.display_name}</Text>
          </View>
          <Press onPress={onClose} style={styles.closeBtn}>
            <X size={22} color="#fff" />
          </Press>
        </View>

        <TouchableWithoutFeedback onPress={handlePress}>
          <View style={styles.media}>
            <Image source={{ uri: story.media_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  progressRow: { flexDirection: "row", gap: 3, paddingHorizontal: 8, paddingTop: 54 },
  progressBg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)" },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  userRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: NAVY },
  fallback: { alignItems: "center", justifyContent: "center" },
  initials: { color: "#fff", fontSize: 12, fontWeight: "800" },
  name: { color: "#fff", fontSize: 14, fontWeight: "700" },
  closeBtn: { width: 36, height: 36, minHeight: 0, minWidth: 0 },
  media: { flex: 1, marginTop: 8 },
});
