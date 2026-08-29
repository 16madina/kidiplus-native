import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from "expo-camera";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { ImageIcon, RefreshCw } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { PublishPhotoEditor } from "./PublishPhotoEditor";
import { PublishVideoEditor } from "./PublishVideoEditor";
import {
  pickImageFromLibrary,
  pickStoryMediaFromLibrary,
  pickVideoFromLibrary,
  pickedMediaFromUri,
  type PickedImage,
} from "../../lib/pick-image";
import { createVitrinePost, uploadVitrineMedia } from "../../lib/vitrine";
import { createVitrineStory } from "../../lib/vitrine-stories";
import {
  encodeStoryPosterClip,
  encodeVideoClipCaption,
  formatClock,
  maxVideoSecForMode,
  shouldPersistClip,
  type VideoClip,
} from "../../lib/publish-media";
import { GOLD, LIVE_RED, NAVY } from "../../theme";
import type { PublishHubMode } from "../../lib/publish-hub";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

type Stage = "capture" | "edit" | "review";

function isVideoDraft(draft: PickedImage): boolean {
  return draft.contentType.startsWith("video/");
}

export function PublishCameraPane({
  mode,
  active,
  onPublished,
  onLockChange,
}: {
  mode: Exclude<PublishHubMode, "affiche">;
  active: boolean;
  onPublished: () => void;
  onLockChange?: (locked: boolean) => void;
}) {
  const { t } = useTranslation();
  const camRef = useRef<CameraView>(null);
  const holdRef = useRef(false);
  const elapsedRef = useRef(0);
  const [permission, requestPermission] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stage, setStage] = useState<Stage>("capture");
  const [draft, setDraft] = useState<PickedImage | null>(null);
  const [clip, setClip] = useState<VideoClip | null>(null);
  const [clipDuration, setClipDuration] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const maxSec = maxVideoSecForMode(mode);

  useEffect(() => {
    if (!active) return;
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
    if (mode !== "photo" && micPerm && !micPerm.granted && micPerm.canAskAgain) void requestMic();
  }, [active, mode, permission, micPerm, requestPermission, requestMic]);

  useEffect(() => {
    setDraft(null);
    setCaption("");
    setRecording(false);
    setElapsed(0);
    setStage("capture");
    setClip(null);
    setClipDuration(null);
    holdRef.current = false;
  }, [mode]);

  useEffect(() => {
    if (!active) return;
    onLockChange?.(stage !== "capture" || recording);
  }, [active, stage, recording, onLockChange]);

  useEffect(() => {
    if (!recording) {
      setElapsed(0);
      elapsedRef.current = 0;
      return;
    }
    const t0 = Date.now();
    const id = setInterval(() => {
      const next = (Date.now() - t0) / 1000;
      elapsedRef.current = next;
      setElapsed(next);
    }, 80);
    return () => clearInterval(id);
  }, [recording]);

  const openEdit = (next: PickedImage) => {
    setDraft(next);
    setClip(null);
    setClipDuration(next.durationSec ?? null);
    setStage("edit");
  };

  const takePhoto = async () => {
    try {
      const pic = await camRef.current?.takePictureAsync({ quality: 0.9 });
      if (!pic?.uri) return;
      openEdit(await pickedMediaFromUri(pic.uri, "image/jpeg", "shot.jpg", { width: pic.width, height: pic.height }));
    } catch {
      Alert.alert("KiDi+", t("publish.captureFail"));
    }
  };

  const startRecord = async () => {
    if (recording) return;
    try {
      setRecording(true);
      const rec = await camRef.current?.recordAsync({ maxDuration: maxSec });
      setRecording(false);
      holdRef.current = false;
      if (!rec?.uri) return;
      const recordedSec = elapsedRef.current > 0.4 ? elapsedRef.current : undefined;
      openEdit(
        await pickedMediaFromUri(rec.uri, "video/mp4", "clip.mp4", {
          durationSec: recordedSec,
        }),
      );
    } catch {
      setRecording(false);
      holdRef.current = false;
      Alert.alert("KiDi+", t("publish.recordFail"));
    }
  };

  const stopRecord = () => {
    if (!recording) return;
    camRef.current?.stopRecording();
  };

  const toggleRecord = () => {
    if (recording) stopRecord();
    else void startRecord();
  };

  const fromGallery = async () => {
    const picked =
      mode === "photo"
        ? await pickImageFromLibrary()
        : mode === "video"
          ? await pickVideoFromLibrary(maxSec)
          : await pickStoryMediaFromLibrary();
    if (picked) openEdit(picked);
  };

  const publish = async () => {
    if (!draft || busy) return;
    setBusy(true);
    const url = await uploadVitrineMedia(draft);
    if (!url) {
      setBusy(false);
      Alert.alert("KiDi+", t("vitrine.uploadFail", { defaultValue: "Upload impossible." }));
      return;
    }
    const video = isVideoDraft(draft);
    const persistClip =
      video && clip && (clipDuration == null || shouldPersistClip(clip, clipDuration)) ? clip : null;
    const res =
      mode === "story"
        ? await createVitrineStory(url, encodeStoryPosterClip(null, persistClip))
        : await createVitrinePost({
            mediaUrls: [url],
            mediaType: video ? "video" : "image",
            caption: encodeVideoClipCaption(caption, persistClip, clipDuration ?? undefined),
          });
    setBusy(false);
    if (!res.ok) {
      Alert.alert("KiDi+", "error" in res ? res.error : t("publish.captureFail"));
      return;
    }
    setDraft(null);
    setCaption("");
    setStage("capture");
    setClip(null);
    onPublished();
    Alert.alert(
      "KiDi+",
      mode === "story" ? t("publish.storyPublished") : t("vitrine.published", { defaultValue: "Publié" }),
    );
  };

  const hint =
    mode === "video"
      ? t("publish.videoHintCapture")
      : mode === "story"
        ? t("publish.storyHintCapture")
        : t("publish.photoHintCapture");

  if (draft && stage === "edit") {
    if (isVideoDraft(draft)) {
      return (
        <PublishVideoEditor
          uri={draft.preview}
          durationSec={draft.durationSec}
          maxSec={maxSec}
          onCancel={() => {
            setDraft(null);
            setStage("capture");
          }}
          onConfirm={(nextClip, duration) => {
            setClip(nextClip);
            setClipDuration(duration);
            setStage("review");
          }}
        />
      );
    }
    return (
      <PublishPhotoEditor
        uri={draft.preview}
        imageWidth={draft.width}
        imageHeight={draft.height}
        onCancel={() => {
          setDraft(null);
          setStage("capture");
        }}
        onConfirm={(cropped) => {
          void pickedMediaFromUri(cropped, "image/jpeg", "crop.jpg").then((next) => {
            setDraft(next);
            setStage("review");
          });
        }}
      />
    );
  }

  if (draft && stage === "review") {
    return (
      <ReviewPane
        draft={draft}
        clip={clip}
        mode={mode}
        caption={caption}
        busy={busy}
        onCaption={setCaption}
        onChange={() => {
          setDraft(null);
          setClip(null);
          setStage("capture");
        }}
        onPublish={() => void publish()}
      />
    );
  }

  const cameraReady = permission?.granted && Platform.OS !== "web";
  const progress = recording ? Math.min(1, elapsed / maxSec) : 0;

  return (
    <View style={styles.pane}>
      {cameraReady ? (
        <CameraView
          ref={camRef}
          style={FILL}
          facing={facing}
          mode={mode === "photo" ? "picture" : "video"}
          mirror={facing === "front" && Platform.OS === "ios"}
        />
      ) : (
        <View style={[FILL, styles.center]}>
          <Text style={styles.hint}>
            {permission && !permission.granted ? t("publish.cameraDenied") : t("publish.fromGallery")}
          </Text>
          {permission && !permission.granted ? (
            <Press onPress={() => void requestPermission()} style={styles.cta}>
              <Text style={styles.ctaTxt}>{t("common.allow", { defaultValue: "Autoriser" })}</Text>
            </Press>
          ) : null}
        </View>
      )}

      {recording ? (
        <View style={styles.recBarWrap}>
          <View style={[styles.recBar, { width: `${progress * 100}%` }]} />
        </View>
      ) : null}

      <View style={styles.topChip}>
        {recording ? (
          <View style={styles.recChip}>
            <View style={styles.recDot} />
            <Text style={styles.recTxt}>
              {formatClock(elapsed)} / {formatClock(maxSec)}
            </Text>
          </View>
        ) : (
          <Text style={styles.topHint}>{hint}</Text>
        )}
      </View>

      <View style={styles.controls}>
        <Press onPress={() => void fromGallery()} style={styles.round}>
          <View style={styles.galleryThumb}>
            <ImageIcon size={20} color="#fff" />
          </View>
          <Text style={styles.ctrlLabel}>{t("publish.gallery")}</Text>
        </Press>

        <Pressable
          disabled={!cameraReady && mode !== "photo"}
          onPress={() => {
            if (mode === "photo") {
              void takePhoto();
              return;
            }
            if (mode === "story") {
              if (holdRef.current) return;
              void takePhoto();
              return;
            }
            toggleRecord();
          }}
          onLongPress={() => {
            if (mode !== "story" || !cameraReady) return;
            holdRef.current = true;
            void startRecord();
          }}
          onPressOut={() => {
            if (mode === "story" && holdRef.current) stopRecord();
          }}
          delayLongPress={220}
          style={({ pressed }) => [styles.shutterHit, pressed && { transform: [{ scale: 0.96 }] }]}
        >
          <View style={[styles.shutterOuter, recording && styles.shutterOuterRec]}>
            <View style={[styles.shutterInner, recording ? styles.shutterInnerRec : mode !== "photo" && styles.shutterInnerVideo]} />
          </View>
        </Pressable>

        <Press
          onPress={() => {
            if (recording) return;
            setFacing((f) => (f === "back" ? "front" : "back"));
          }}
          style={styles.round}
        >
          <RefreshCw size={20} color="#fff" />
          <Text style={styles.ctrlLabel}>{t("publish.flip")}</Text>
        </Press>
      </View>
    </View>
  );
}

function ReviewPane({
  draft,
  clip,
  mode,
  caption,
  busy,
  onCaption,
  onChange,
  onPublish,
}: {
  draft: PickedImage;
  clip: VideoClip | null;
  mode: Exclude<PublishHubMode, "affiche">;
  caption: string;
  busy: boolean;
  onCaption: (v: string) => void;
  onChange: () => void;
  onPublish: () => void;
}) {
  const { t } = useTranslation();
  const video = isVideoDraft(draft);
  return (
    <View style={styles.pane}>
      {video ? (
        <ReviewVideo uri={draft.preview} clip={clip} />
      ) : (
        <Image source={{ uri: draft.preview }} style={FILL} contentFit="cover" />
      )}
      {mode !== "story" ? (
        <TextInput
          value={caption}
          onChangeText={onCaption}
          placeholder={t("vitrine.captionPlaceholder", { defaultValue: "Légende…" })}
          placeholderTextColor="rgba(255,255,255,0.6)"
          style={styles.caption}
        />
      ) : (
        <Text style={[styles.hint, { position: "absolute", bottom: 88, alignSelf: "center" }]}>
          {t("publish.storyHint")}
        </Text>
      )}
      <View style={styles.reviewRow}>
        <Press onPress={onChange} style={styles.ghost}>
          <Text style={styles.ghostTxt}>{t("publish.changeMedia")}</Text>
        </Press>
        <Press onPress={onPublish} disabled={busy} style={styles.cta}>
          {busy ? <ActivityIndicator color={NAVY} /> : <Text style={styles.ctaTxt}>{t("publish.cta")}</Text>}
        </Press>
      </View>
    </View>
  );
}

function ReviewVideo({ uri, clip }: { uri: string; clip: VideoClip | null }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = false;
    p.timeUpdateEventInterval = 0.1;
    p.audioMixingMode = "doNotMix";
  });

  useEffect(() => {
    const start = clip?.startSec ?? 0;
    try {
      player.currentTime = start;
      void player.play();
    } catch {
      /* native */
    }
    const time = player.addListener("timeUpdate", (e) => {
      if (!clip) return;
      if (e.currentTime >= clip.endSec - 0.05 || e.currentTime < clip.startSec - 0.15) {
        try {
          player.currentTime = clip.startSec;
        } catch {
          /* native */
        }
      }
    });
    return () => time.remove();
  }, [player, clip]);

  return <VideoView player={player} style={FILL} contentFit="cover" nativeControls={false} />;
}

const styles = StyleSheet.create({
  pane: { flex: 1, backgroundColor: "#05060a" },
  center: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  hint: { color: "rgba(255,255,255,0.75)", fontWeight: "700", textAlign: "center" },
  topChip: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    alignItems: "center",
  },
  topHint: {
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 6,
  },
  recBarWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  recBar: { height: 3, backgroundColor: LIVE_RED },
  recChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LIVE_RED },
  recTxt: { color: "#fff", fontWeight: "800", fontVariant: ["tabular-nums"] },
  controls: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 22,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  round: {
    width: 72,
    alignItems: "center",
    gap: 6,
    minHeight: 0,
    minWidth: 0,
  },
  galleryThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlLabel: { color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "700" },
  shutterHit: { width: 86, height: 86, alignItems: "center", justifyContent: "center" },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  shutterOuterRec: { borderColor: "#fecaca" },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
  },
  shutterInnerVideo: { backgroundColor: "rgba(255,255,255,0.92)" },
  shutterInnerRec: { width: 28, height: 28, borderRadius: 6, backgroundColor: LIVE_RED },
  caption: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 88,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  reviewRow: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: "row",
    gap: 10,
  },
  ghost: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  ghostTxt: { color: "#fff", fontWeight: "800" },
  cta: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTxt: { color: NAVY, fontWeight: "900" },
});
