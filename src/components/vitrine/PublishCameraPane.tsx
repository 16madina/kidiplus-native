import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from "expo-camera";
import { Image } from "expo-image";
import { ImageIcon, RefreshCw } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import {
  pickImageFromLibrary,
  pickStoryMediaFromLibrary,
  pickedMediaFromUri,
  type PickedImage,
} from "../../lib/pick-image";
import { createVitrinePost, uploadVitrineMedia } from "../../lib/vitrine";
import { createVitrineStory, isStoryVideoUrl } from "../../lib/vitrine-stories";
import { GOLD, NAVY } from "../../theme";
import type { PublishHubMode } from "../../lib/publish-hub";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

export function PublishCameraPane({
  mode,
  active,
  onPublished,
}: {
  mode: Exclude<PublishHubMode, "affiche">;
  active: boolean;
  onPublished: () => void;
}) {
  const { t } = useTranslation();
  const camRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [recording, setRecording] = useState(false);
  const [draft, setDraft] = useState<PickedImage | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active) return;
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
    if (mode !== "photo" && micPerm && !micPerm.granted && micPerm.canAskAgain) void requestMic();
  }, [active, mode, permission, micPerm, requestPermission, requestMic]);

  useEffect(() => {
    setDraft(null);
    setCaption("");
    setRecording(false);
  }, [mode]);

  const takePhoto = async () => {
    try {
      const pic = await camRef.current?.takePictureAsync({ quality: 0.88 });
      if (!pic?.uri) return;
      setDraft(await pickedMediaFromUri(pic.uri, "image/jpeg", "shot.jpg"));
    } catch {
      Alert.alert("KiDi+", t("publish.captureFail"));
    }
  };

  const toggleRecord = async () => {
    try {
      if (recording) {
        camRef.current?.stopRecording();
        return;
      }
      setRecording(true);
      const rec = await camRef.current?.recordAsync({
        maxDuration: mode === "story" ? 15 : 60,
      });
      setRecording(false);
      if (!rec?.uri) return;
      setDraft(await pickedMediaFromUri(rec.uri, "video/mp4", "clip.mp4"));
    } catch {
      setRecording(false);
      Alert.alert("KiDi+", t("publish.recordFail"));
    }
  };

  const fromGallery = async () => {
    const picked =
      mode === "photo" ? await pickImageFromLibrary() : await pickStoryMediaFromLibrary();
    if (picked) setDraft(picked);
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
    const video = isStoryVideoUrl(url) || draft.contentType.startsWith("video/");
    const res =
      mode === "story"
        ? await createVitrineStory(url)
        : await createVitrinePost({
            mediaUrls: [url],
            mediaType: video ? "video" : "image",
            caption,
          });
    setBusy(false);
    if (!res.ok) {
      Alert.alert("KiDi+", "error" in res ? res.error : t("publish.captureFail"));
      return;
    }
    setDraft(null);
    setCaption("");
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

  if (draft) {
    const videoDraft = draft.contentType.startsWith("video/") || isStoryVideoUrl(draft.preview);
    return (
      <View style={styles.pane}>
        {videoDraft ? (
          <View style={[FILL, styles.center]}>
            <Text style={styles.hint}>VIDEO</Text>
          </View>
        ) : (
          <Image source={{ uri: draft.preview }} style={FILL} contentFit="cover" />
        )}
        {mode !== "story" ? (
          <TextInput
            value={caption}
            onChangeText={setCaption}
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
          <Press onPress={() => setDraft(null)} style={styles.ghost}>
            <Text style={styles.ghostTxt}>{t("publish.changeMedia")}</Text>
          </Press>
          <Press onPress={() => void publish()} disabled={busy} style={styles.cta}>
            {busy ? <ActivityIndicator color={NAVY} /> : <Text style={styles.ctaTxt}>{t("publish.cta")}</Text>}
          </Press>
        </View>
      </View>
    );
  }

  const cameraReady = permission?.granted && Platform.OS !== "web";

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

      <Text style={styles.topHint}>{hint}</Text>
      <View style={styles.controls}>
        <Press onPress={() => void fromGallery()} style={styles.round}>
          <ImageIcon size={20} color="#fff" />
        </Press>
        <Press
          onPress={() => void (mode === "photo" ? takePhoto() : toggleRecord())}
          style={[styles.shutter, recording && styles.shutterRec]}
        />
        <Press onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))} style={styles.round}>
          <RefreshCw size={20} color="#fff" />
        </Press>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: { flex: 1, backgroundColor: "#05060a" },
  center: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  hint: { color: "rgba(255,255,255,0.75)", fontWeight: "700", textAlign: "center" },
  topHint: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    fontWeight: "600",
  },
  controls: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 6,
    borderColor: "#fff",
    backgroundColor: modeSafeWhite(),
  },
  shutterRec: { backgroundColor: "#EF4444", borderColor: "#fecaca" },
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

function modeSafeWhite() {
  return "rgba(255,255,255,0.35)";
}
