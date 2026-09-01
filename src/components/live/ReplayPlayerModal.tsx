import { Modal, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Download, Trash2 } from "lucide-react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Press } from "../Press";

export type ReplayOpen = { url: string; title: string; liveId: string };

export function ReplayPlayerModal({
  replay,
  onClose,
  onDownload,
  onDelete,
}: {
  replay: ReplayOpen | null;
  onClose: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  if (!replay) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.bar}>
          <Text numberOfLines={1} style={styles.title}>
            {replay.title || t("broadcast.replay.playerTitle")}
          </Text>
          {onDownload ? (
            <Press onPress={onDownload} style={styles.action}>
              <Download size={16} color="#fff" />
              <Text style={styles.actionTxt}>{t("broadcast.replay.download")}</Text>
            </Press>
          ) : null}
          {onDelete ? (
            <Press onPress={onDelete} style={[styles.action, styles.delete]}>
              <Trash2 size={16} color="#fff" />
              <Text style={styles.actionTxt}>{t("broadcast.replay.delete")}</Text>
            </Press>
          ) : null}
          <Press onPress={onClose} style={styles.close}>
            <Text style={styles.closeTxt}>{t("common.close")}</Text>
          </Press>
        </View>
        <ReplayPlayer uri={replay.url} />
      </View>
    </Modal>
  );
}

function ReplayPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });
  return <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 54,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  title: { flex: 1, color: "#fff", fontWeight: "700", fontSize: 14 },
  action: {
    minHeight: 40,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    flexDirection: "row",
    gap: 6,
  },
  delete: { backgroundColor: "rgba(220,38,38,0.9)" },
  actionTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
  close: {
    minHeight: 40,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  closeTxt: { color: "#111", fontWeight: "800" },
});
