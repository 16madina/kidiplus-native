import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ImagePlus, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Press } from "../Press";
import { useAppTheme } from "../../context/theme";
import { pickImageFromLibrary, type PickedImage } from "../../lib/pick-image";
import { createVitrinePost, uploadVitrineMedia } from "../../lib/vitrine";
import { GOLD, NAVY } from "../../theme";

export function CreateVitrinePostSheet({
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
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const next = await pickImageFromLibrary();
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
    const res = await createVitrinePost({
      mediaUrls: [url],
      mediaType: "image",
      caption,
    });
    setBusy(false);
    if (!res.ok) {
      Alert.alert("KiDi+", res.error);
      return;
    }
    setCaption("");
    setPicked(null);
    onCreated();
    onClose();
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Press haptic="none" onPress={onClose} style={styles.dim} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.head}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {t("vitrine.publish", { defaultValue: "Publier" })}
              </Text>
              <Press onPress={onClose} style={styles.close}>
                <X size={18} color={colors.foreground} />
              </Press>
            </View>
            <Press onPress={() => void pick()} style={[styles.pick, { borderColor: colors.border, backgroundColor: colors.card }]}>
              {picked ? (
                <Image source={{ uri: picked.preview }} style={styles.preview} contentFit="cover" />
              ) : (
                <View style={{ alignItems: "center", gap: 8 }}>
                  <ImagePlus size={28} color={GOLD} />
                  <Text style={{ color: colors.mutedForeground, fontWeight: "700" }}>
                    {t("vitrine.pickPhoto", { defaultValue: "Choisir une photo" })}
                  </Text>
                </View>
              )}
            </Press>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder={t("vitrine.captionPlaceholder", { defaultValue: "Légende…" })}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              multiline
              maxLength={500}
            />
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
        </KeyboardAvoidingView>
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
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  title: { fontSize: 18, fontWeight: "800" },
  close: { width: 36, height: 36, minWidth: 36, minHeight: 36 },
  pick: {
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  preview: { width: "100%", height: "100%" },
  input: {
    marginTop: 12,
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
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
