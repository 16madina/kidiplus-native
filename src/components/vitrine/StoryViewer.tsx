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
import { useVideoPlayer, VideoView } from "expo-video";
import { Flag, X } from "lucide-react-native";
import { Press } from "../Press";
import { ReportSheet } from "../moderation/ReportSheet";
import { useAuth } from "../../context/auth";
import { encodeContentReportNote } from "../../lib/admin-takedown-logic";
import { initials, NAVY } from "../../theme";
import { isHttpUrl } from "../../lib/storage";
import { isStoryVideoUrl, STORY_IMAGE_MS, type VitrineStory } from "../../lib/vitrine-stories";
import { VitrineMusicLayer } from "./VitrineMusicLayer";

const { width: SCREEN_W } = Dimensions.get("window");
const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

export function StoryViewer({
  stories,
  initialIndex,
  visible,
  onClose,
}: {
  stories: VitrineStory[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [index, setIndex] = useState(initialIndex);
  const [reportOpen, setReportOpen] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const story = stories[index];
  const video = !!story && isStoryVideoUrl(story.mediaUrl);
  const mine = !!user?.id && !!story && user.id === story.userId;

  const advance = useCallback(() => {
    if (index < stories.length - 1) {
      setIndex((i) => i + 1);
    } else {
      onClose();
    }
  }, [index, stories.length, onClose]);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, visible]);

  useEffect(() => {
    if (!visible || !story || video) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_IMAGE_MS,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) advance();
    });
    return () => anim.stop();
  }, [visible, index, video, story, advance, progress]);

  if (!story) return null;

  const handlePress = (evt: { nativeEvent: { locationX: number } }) => {
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
            <View key={stories[i]?.id ?? i} style={styles.progressBg}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width:
                      i < index
                        ? "100%"
                        : i === index && !video
                          ? progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })
                          : i === index
                            ? "50%"
                            : "0%",
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.header}>
          <View style={styles.userRow}>
            {isHttpUrl(story.avatarUrl) ? (
              <Image source={{ uri: story.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.fallback]}>
                <Text style={styles.initials}>{initials(story.displayName)}</Text>
              </View>
            )}
            <Text style={styles.name}>{story.displayName}</Text>
          </View>
          <View style={styles.headActions}>
            {!mine ? (
              <Press onPress={() => setReportOpen(true)} style={styles.closeBtn}>
                <Flag size={18} color="#fff" />
              </Press>
            ) : null}
            <Press onPress={onClose} style={styles.closeBtn}>
              <X size={22} color="#fff" />
            </Press>
          </View>
        </View>

        <TouchableWithoutFeedback onPress={handlePress}>
          <View style={styles.media}>
            {video ? (
              <StoryVideo uri={story.mediaUrl} clip={story.clip} active={visible} onEnded={advance} />
            ) : (
              <Image source={{ uri: story.mediaUrl }} style={FILL} contentFit="cover" />
            )}
            <VitrineMusicLayer music={story.music} active={visible} />
          </View>
        </TouchableWithoutFeedback>
        <ReportSheet
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="user"
          targetId={story.userId}
          defaultNote={encodeContentReportNote("vitrine_story", story.id, `Vitrine story: ${story.id}`)}
        />
      </View>
    </Modal>
  );
}

function StoryVideo({
  uri,
  clip,
  active,
  onEnded,
}: {
  uri: string;
  clip: { startSec: number; endSec: number } | null;
  active: boolean;
  onEnded: () => void;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = false;
    p.timeUpdateEventInterval = 0.1;
    p.audioMixingMode = "doNotMix";
  });
  const endedRef = useRef(false);
  const start = clip?.startSec ?? 0;
  const end = clip?.endSec;

  useEffect(() => {
    endedRef.current = false;
    try {
      if (active) {
        player.currentTime = start;
        player.play();
      } else {
        player.pause();
      }
    } catch {
      /* native player not ready */
    }
  }, [active, uri, player, start]);

  useEffect(() => {
    const id = setInterval(() => {
      if (endedRef.current) return;
      const duration = end ?? player.duration;
      const time = player.currentTime;
      if (duration > 0 && time >= duration - 0.2) {
        endedRef.current = true;
        onEnded();
      }
    }, 200);
    return () => clearInterval(id);
  }, [player, onEnded, end]);

  return <VideoView player={player} style={FILL} contentFit="cover" nativeControls={false} />;
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
  headActions: { flexDirection: "row", alignItems: "center" },
  media: { flex: 1, marginTop: 8 },
});
