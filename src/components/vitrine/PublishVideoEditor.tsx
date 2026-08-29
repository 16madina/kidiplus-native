import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useVideoPlayer, VideoView } from "expo-video";
import { Pause, Play } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import {
  clampTrimRange,
  formatClock,
  initialTrimWindow,
  moveTrimWindow,
  resizeTrimEnd,
  resizeTrimStart,
  videoNeedsForcedTrim,
  type VideoClip,
} from "../../lib/publish-media";
import { GOLD, NAVY } from "../../theme";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

export function PublishVideoEditor({
  uri,
  durationSec,
  maxSec,
  onCancel,
  onConfirm,
}: {
  uri: string;
  durationSec?: number | null;
  maxSec: number;
  onCancel: () => void;
  onConfirm: (clip: VideoClip, durationSec: number) => void;
}) {
  const { t } = useTranslation();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = false;
    p.timeUpdateEventInterval = 0.08;
    p.audioMixingMode = "doNotMix";
  });
  const [duration, setDuration] = useState(Math.max(0, durationSec ?? 0));
  const [clip, setClip] = useState<VideoClip>(() => initialTrimWindow(durationSec ?? maxSec, maxSec));
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [trackW, setTrackW] = useState(1);
  const clipRef = useRef(clip);
  clipRef.current = clip;

  useEffect(() => {
    const applyDuration = (d: number) => {
      if (d <= 0) return;
      setDuration(d);
      setClip((prev) => clampTrimRange(d, prev.startSec, prev.endSec, maxSec));
    };
    if ((durationSec ?? 0) > 0) applyDuration(durationSec as number);
    const load = player.addListener("sourceLoad", (e) => {
      applyDuration(e.duration);
    });
    const time = player.addListener("timeUpdate", (e) => {
      const c = clipRef.current;
      setNow(e.currentTime);
      if (e.currentTime >= c.endSec - 0.04) {
        try {
          player.currentTime = c.startSec;
          player.pause();
        } catch {
          /* native */
        }
        setPlaying(false);
      }
    });
    const ended = player.addListener("playToEnd", () => {
      try {
        player.currentTime = clipRef.current.startSec;
        player.pause();
      } catch {
        /* native */
      }
      setPlaying(false);
    });
    const play = player.addListener("playingChange", (e) => setPlaying(e.isPlaying));
    try {
      player.currentTime = clip.startSec;
    } catch {
      /* native */
    }
    return () => {
      load.remove();
      time.remove();
      ended.remove();
      play.remove();
    };
    // clip.startSec only for initial seek
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, maxSec, durationSec]);

  const seekTo = (sec: number) => {
    const next = Math.min(clip.endSec - 0.05, Math.max(clip.startSec, sec));
    try {
      player.currentTime = next;
    } catch {
      /* native */
    }
    setNow(next);
  };

  const togglePlay = () => {
    try {
      if (playing) {
        player.pause();
        setPlaying(false);
        return;
      }
      if (player.currentTime < clip.startSec || player.currentTime >= clip.endSec - 0.05) {
        player.currentTime = clip.startSec;
      }
      void player.play();
      setPlaying(true);
    } catch {
      /* native */
    }
  };

  const xToSec = (x: number) => {
    const dur = Math.max(duration, 0.01);
    return (Math.min(trackW, Math.max(0, x)) / trackW) * dur;
  };

  const startWin = useRef({ start: 0, end: 0 });
  const dragKind = useRef<"left" | "right" | "move" | "seek">("move");
  const trackPan = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      startWin.current = { start: clip.startSec, end: clip.endSec };
      const leftEdge = ready ? (clip.startSec / duration) * trackW : 0;
      const rightEdge = ready ? (clip.endSec / duration) * trackW : 0;
      if (Math.abs(e.x - leftEdge) <= 26) dragKind.current = "left";
      else if (Math.abs(e.x - rightEdge) <= 26) dragKind.current = "right";
      else if (e.x > leftEdge && e.x < rightEdge) dragKind.current = "move";
      else dragKind.current = "seek";
    })
    .onUpdate((e) => {
      const dur = Math.max(duration, 0.01);
      if (dragKind.current === "seek") {
        seekTo(xToSec(e.x));
        return;
      }
      const delta = (e.translationX / trackW) * dur;
      if (dragKind.current === "move") {
        setClip(moveTrimWindow(duration, startWin.current.start, startWin.current.end, delta, maxSec));
      } else if (dragKind.current === "left") {
        setClip(
          resizeTrimStart(duration, startWin.current.start, startWin.current.end, startWin.current.start + delta, maxSec),
        );
      } else {
        setClip(
          resizeTrimEnd(duration, startWin.current.start, startWin.current.end, startWin.current.end + delta, maxSec),
        );
      }
    })
    .onEnd(() => {
      if (dragKind.current === "seek") return;
      seekTo(clipRef.current.startSec);
    });

  const forced = videoNeedsForcedTrim(duration, maxSec);
  const ready = duration > 0.2;
  const left = ready ? (clip.startSec / duration) * trackW : 0;
  const width = ready ? ((clip.endSec - clip.startSec) / duration) * trackW : 0;
  const playX = ready ? (now / duration) * trackW : 0;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t("publish.edit.trim")}</Text>
      <View style={styles.preview}>
        <VideoView player={player} style={FILL} contentFit="cover" nativeControls={false} />
        <Press onPress={togglePlay} haptic="none" style={styles.playHit}>
          <View style={styles.playBtn}>
            {playing ? <Pause size={22} color="#fff" fill="#fff" /> : <Play size={22} color="#fff" fill="#fff" />}
          </View>
        </Press>
      </View>

      <View style={styles.meta}>
        <Text style={styles.clock}>
          {formatClock(clip.startSec)} – {formatClock(clip.endSec)}
        </Text>
        <Text style={styles.dur}>
          {formatClock(clip.endSec - clip.startSec)} / {formatClock(maxSec)}
        </Text>
      </View>
      <Text style={styles.hint}>
        {forced
          ? t("publish.edit.trimHint", { sec: maxSec, dur: formatClock(duration) })
          : t("publish.edit.trimOk", { sec: maxSec })}
      </Text>

      <GestureDetector gesture={trackPan}>
        <View style={styles.track} onLayout={(e) => setTrackW(Math.max(1, e.nativeEvent.layout.width))}>
          <View style={styles.film}>
            {Array.from({ length: 14 }).map((_, i) => (
              <View key={i} style={styles.sprocket} />
            ))}
          </View>
          <View pointerEvents="none" style={[styles.window, { left, width: Math.max(28, width) }]}>
            <View style={styles.windowFill} />
            <View style={[styles.handle, styles.handleL]}>
              <View style={styles.handleBar} />
            </View>
            <View style={[styles.handle, styles.handleR]}>
              <View style={styles.handleBar} />
            </View>
          </View>
          <View pointerEvents="none" style={[styles.playhead, { left: playX }]} />
        </View>
      </GestureDetector>

      <View style={styles.row}>
        <Press onPress={onCancel} style={styles.ghost}>
          <Text style={styles.ghostTxt}>{t("common.back", { defaultValue: "Retour" })}</Text>
        </Press>
        <Press
          onPress={() => ready && onConfirm(clip, duration)}
          disabled={!ready}
          style={[styles.cta, !ready && { opacity: 0.5 }]}
        >
          <Text style={styles.ctaTxt}>{t("publish.edit.trim")}</Text>
        </Press>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingHorizontal: 12, paddingBottom: 8 },
  title: { color: "#fff", fontWeight: "900", fontSize: 16, textAlign: "center", marginVertical: 8 },
  preview: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#111",
    maxHeight: "58%",
  },
  playHit: { ...FILL, minHeight: 0, minWidth: 0 },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  clock: { color: "#fff", fontWeight: "800", fontSize: 16 },
  dur: { color: GOLD, fontWeight: "800" },
  hint: { color: "rgba(255,255,255,0.68)", marginTop: 6, marginBottom: 10, fontWeight: "600", fontSize: 12 },
  track: {
    height: 56,
    borderRadius: 12,
    backgroundColor: "#1a1a1a",
    overflow: "hidden",
    marginBottom: 14,
  },
  film: {
    ...FILL,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    alignItems: "center",
  },
  sprocket: { width: 8, height: 36, borderRadius: 2, backgroundColor: "#2a2a2a" },
  window: { position: "absolute", top: 0, bottom: 0 },
  windowFill: {
    ...FILL,
    backgroundColor: "rgba(232,185,59,0.28)",
    borderWidth: 2,
    borderColor: GOLD,
    borderRadius: 8,
  },
  handle: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GOLD,
  },
  handleL: { left: 0, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  handleR: { right: 0, borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  handleBar: { width: 3, height: 18, borderRadius: 2, backgroundColor: NAVY },
  playhead: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#fff",
    marginLeft: -1,
  },
  row: { flexDirection: "row", gap: 10 },
  ghost: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  ghostTxt: { color: "#fff", fontWeight: "800" },
  cta: { flex: 1, minHeight: 48, borderRadius: 999, backgroundColor: GOLD },
  ctaTxt: { color: NAVY, fontWeight: "900" },
});
