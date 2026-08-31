import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Music2 } from "lucide-react-native";
import type { VitrineMusic } from "../../lib/vitrine-music";
import { musicLabel } from "../../lib/vitrine-music";

/** Plays overlay music next to a story / post (TikTok model — not baked in). */
export function VitrineMusicLayer({
  music,
  active,
  originalPlayerVolume,
}: {
  music: VitrineMusic | null | undefined;
  active: boolean;
  /** Called so the video can duck its original audio. */
  originalPlayerVolume?: (n: number) => void;
}) {
  const url = music?.url ?? null;
  const player = useVideoPlayer(url ?? "", (p) => {
    p.loop = true;
    p.muted = false;
    p.audioMixingMode = "mixWithOthers";
  });

  useEffect(() => {
    originalPlayerVolume?.(active && music ? music.originalVolume : 1);
  }, [active, music, originalPlayerVolume]);

  useEffect(() => {
    if (!url) return;
    try {
      if (!active) {
        player.pause();
        return;
      }
      player.volume = music?.volume ?? 0.8;
      player.muted = false;
      if ((music?.startSec ?? 0) > 0 && player.currentTime < (music?.startSec ?? 0) - 0.2) {
        player.currentTime = music?.startSec ?? 0;
      }
      void player.play();
    } catch {
      /* native player */
    }
  }, [active, url, player, music?.volume, music?.startSec]);

  if (!music?.url || !active) return null;
  const label = musicLabel(music);
  return (
    <View pointerEvents="none" style={styles.badge}>
      <VideoView player={player} style={styles.hidden} nativeControls={false} />
      <Music2 size={12} color="#fff" />
      {label ? (
        <Text numberOfLines={1} style={styles.txt}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    left: 12,
    bottom: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "70%",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  txt: { color: "#fff", fontWeight: "700", fontSize: 11, flexShrink: 1 },
  hidden: { width: 1, height: 1, opacity: 0 },
});
