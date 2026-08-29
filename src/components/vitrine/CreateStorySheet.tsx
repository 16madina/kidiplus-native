import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ImagePlus, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Press } from "../Press";
import { useAppTheme } from "../../context/theme";
import { pickStoryMediaFromLibrary, type PickedImage } from "../../lib/pick-image";
import { createVitrineStory, isStoryVideoUrl } from "../../lib/vitrine-stories";
import { uploadVitrineMedia } from "../../lib/vitrine";
import { GOLD, NAVY } from "../../theme";

export function CreateStorySheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const next = await pickStoryMediaFromLibrary();
    if (!next) return;
    setPicked(next);
  };

  const publish = async () => {
    if (!picked || busy) return;
    setBusy(true);
    const url = await uploadVitrineMedia(picked);
    if (!url) {
      setBusy(false);
      Alert.alert("KiDi+", t("vitrine.uploadFail", { defaultValue: "Upload impossible." }));
      return;
    }
    const res = await createVitrineStory(url);
    setBusy(false);
    if (!res.ok) {
      Alert.alert("KiDi+", res.error);
      return;
    }
    setPicked(null);
    onCreated();
    onClose();
    Alert.alert("KiDi+", t("publish.storyPublished"));
  };

  const videoPreview = picked ? isStoryVideoUrl(picked.preview) || picked.contentType.startsWith("video/") : false;

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Press haptic="none" onPress={onClose} style={styles.dim} />
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {t("publish.compose.story", { defaultValue: "Nouvelle story" })}
            </Text>
            <Press onPress={onClose} style={styles.close}>
              <X size={18} color={colors.foreground} />
            </Press>
          </View>
          <Text style={{ color: colors.mutedForeground, fontWeight: "600", marginBottom: 10 }}>
            {t("publish.storyHint")}
          </Text>
          <Press
            onPress={() => void pick()}
            style={[styles.pick, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            {picked ? (
              videoPreview ? (
                <View style={styles.videoHint}>
                  <Text style={{ color: "#fff", fontWeight: "800" }}>VIDEO</Text>
                </View>
              ) : (
                <Image source={{ uri: picked.preview }} style={styles.preview} contentFit="cover" />
              )
            ) : (
              <View style={{ alignItems: "center", gap: 8 }}>
                <ImagePlus size={28} color={GOLD} />
                <Text style={{ color: colors.mutedForeground, fontWeight: "700", textAlign: "center" }}>
                  {t("publish.storyHintCapture")}
                </Text>
              </View>
            )}
          </Press>
          <Press
            onPress={() => void publish()}
            disabled={busy || !picked}
            style={[styles.cta, { opacity: picked && !busy ? 1 : 0.45 }]}
          >
            {busy ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <Text style={styles.ctaTxt}>{t("vitrine.publishCta", { defaultValue: "Publier" })}</Text>
            )}
          </Press>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  dim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  title: { fontSize: 18, fontWeight: "800" },
  close: { width: 36, height: 36, minWidth: 36, minHeight: 36 },
  pick: {
    height: 260,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  preview: { width: "100%", height: "100%" },
  videoHint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  cta: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTxt: { color: NAVY, fontWeight: "900", fontSize: 15 },
});
