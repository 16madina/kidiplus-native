import { useState } from "react";
import { Modal, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import type { RtmpCredentials } from "../../lib/livekit-ingress";
import { GOLD, NAVY } from "../../theme";

export function RtmpCredentialsSheet({
  open,
  onClose,
  creds,
  onCopied,
}: {
  open: boolean;
  onClose: () => void;
  creds: RtmpCredentials | null;
  onCopied?: (kind: "url" | "key") => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [showKey, setShowKey] = useState(false);
  if (!creds) return null;

  const copy = async (kind: "url" | "key") => {
    const value = kind === "url" ? creds.url : creds.streamKey;
    try {
      await Share.share({ message: value });
      onCopied?.(kind);
    } catch {
      /* share cancelled */
    }
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.back}>
        <Press haptic="none" onPress={onClose} style={{ flex: 1 }} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.title}>{t("broadcast.rtmp.title")}</Text>
          <Text style={styles.body}>{t("broadcast.rtmp.subtitle")}</Text>
          {[1, 2, 3, 4].map((n) => (
            <Text key={n} style={styles.step}>
              {n}. {t(`broadcast.rtmp.step${n}` as never)}
            </Text>
          ))}
          <Text style={styles.label}>{t("broadcast.rtmp.serverUrl")}</Text>
          <Press onPress={() => void copy("url")} style={styles.box}>
            <Text selectable style={styles.mono}>
              {creds.url}
            </Text>
          </Press>
          <View style={styles.keyRow}>
            <Text style={styles.label}>{t("broadcast.rtmp.streamKey")}</Text>
            <Press onPress={() => setShowKey((v) => !v)} style={styles.tiny}>
              <Text style={styles.tinyTxt}>
                {showKey ? t("broadcast.rtmp.hide") : t("broadcast.rtmp.show")}
              </Text>
            </Press>
          </View>
          <Press onPress={() => void copy("key")} style={styles.box}>
            <Text selectable style={styles.mono}>
              {showKey ? creds.streamKey : "••••••••••••••••"}
            </Text>
          </Press>
          <Text style={styles.note}>{t("broadcast.rtmp.securityNote")}</Text>
          <Press onPress={onClose} style={styles.cta}>
            <Text style={styles.ctaTxt}>{t("broadcast.rtmp.done")}</Text>
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
  step: { marginTop: 6, color: NAVY, fontSize: 13, lineHeight: 18 },
  label: { marginTop: 12, fontWeight: "700", color: NAVY, fontSize: 12 },
  box: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
    minHeight: 44,
    alignItems: "flex-start",
  },
  mono: { fontSize: 12, color: NAVY, fontWeight: "600" },
  keyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tiny: { minHeight: 28, height: 28, paddingHorizontal: 8 },
  tinyTxt: { color: GOLD, fontWeight: "800", fontSize: 12 },
  note: { marginTop: 10, color: "#6B7289", fontSize: 11, lineHeight: 16 },
  cta: { marginTop: 16, height: 50, borderRadius: 16, backgroundColor: GOLD },
  ctaTxt: { color: "#0a0a12", fontWeight: "800", fontSize: 15 },
});
