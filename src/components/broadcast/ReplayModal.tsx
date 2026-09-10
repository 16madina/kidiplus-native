import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useVideoPlayer, VideoView } from "expo-video";
import { Download, Link2, X } from "lucide-react-native";
import { saveLiveReplayToDevice } from "../../lib/live-replay-download";
import { GOLD, NAVY } from "../../theme";
import { Press } from "../Press";

export function ReplayModal({
  url,
  title,
  onClose,
  onMessage,
}: {
  url: string | null;
  title?: string | null;
  onClose: () => void;
  onMessage?: (message: string) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);

  if (!url) return null;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveLiveReplayToDevice(url, title);
    } catch (error) {
      console.warn("[live-replay] save failed", error);
      onMessage?.(t("broadcast.replay.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const shareLink = async () => {
    try {
      await Share.share({
        title: title || "Replay KiDi+",
        message: `${title || "Replay KiDi+"}\n${url}`,
        url,
      });
    } catch (error) {
      console.warn("[live-replay] share link failed", error);
      onMessage?.(t("broadcast.replay.shareFailed"));
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <ReplayPlayer uri={url} />

        <Press
          accessibilityLabel={t("common.close")}
          onPress={onClose}
          style={[styles.close, { top: insets.top + 8 }]}
        >
          <X size={22} color="#fff" />
        </Press>

        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Press disabled={saving} onPress={() => void save()} style={styles.primary}>
            {saving ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <Download size={18} color={NAVY} />
            )}
            <Text style={styles.primaryText}>
              {saving
                ? t("broadcast.replay.downloading")
                : t("broadcast.replay.saveVideo")}
            </Text>
          </Press>

          <Press onPress={() => void shareLink()} style={styles.secondary}>
            <Link2 size={18} color="#fff" />
            <Text style={styles.secondaryText}>{t("broadcast.replay.shareLink")}</Text>
          </Press>
        </View>
      </View>
    </Modal>
  );
}

function ReplayPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    instance.muted = false;
    instance.play();
  });

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls
      fullscreenOptions={{ enable: true }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  close: {
    position: "absolute",
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(16,22,43,0.78)",
  },
  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    backgroundColor: GOLD,
  },
  primaryText: { color: NAVY, fontWeight: "800", fontSize: 13 },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(16,22,43,0.88)",
  },
  secondaryText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
