import { useState } from "react";
import { Modal, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { GOLD, NAVY } from "../../theme";

const PINK = "#FE2C55";

export function TiktokRtmpSheet({
  open,
  onClose,
  busy,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  onStart: (creds: { serverUrl: string; streamKey: string }) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [serverUrl, setServerUrl] = useState("");
  const [streamKey, setStreamKey] = useState("");
  const can = serverUrl.trim().startsWith("rtmp") && streamKey.trim().length > 4;

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.back}>
        <Press haptic="none" onPress={onClose} style={{ flex: 1 }} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.title}>{t("broadcast.tiktok.guideTitle")}</Text>
          <Text style={styles.body}>{t("broadcast.tiktok.guideIntro")}</Text>
          <Text style={styles.label}>{t("broadcast.rtmp.serverUrl")}</Text>
          <TextInput
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="rtmp://..."
            placeholderTextColor="#9AA0B4"
            style={styles.input}
          />
          <Text style={styles.label}>{t("broadcast.rtmp.streamKey")}</Text>
          <TextInput
            value={streamKey}
            onChangeText={setStreamKey}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="••••"
            placeholderTextColor="#9AA0B4"
            style={styles.input}
            secureTextEntry
          />
          <Press
            disabled={!can || busy}
            onPress={() => onStart({ serverUrl: serverUrl.trim(), streamKey: streamKey.trim() })}
            style={[styles.cta, (!can || busy) && { opacity: 0.45 }]}
          >
            <Text style={styles.ctaTxt}>
              {busy ? t("common.loading") : t("broadcast.tiktok.goLive", "Diffuser sur TikTok")}
            </Text>
          </Press>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  back: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  title: { fontSize: 20, fontWeight: "800", color: NAVY },
  body: { marginTop: 6, color: "#6B7289", fontSize: 13, lineHeight: 18 },
  label: { marginTop: 12, fontWeight: "700", color: NAVY, fontSize: 12 },
  input: {
    marginTop: 6,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    color: NAVY,
    fontWeight: "600",
  },
  cta: { marginTop: 16, height: 50, borderRadius: 16, backgroundColor: PINK },
  ctaTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
});

void GOLD;
