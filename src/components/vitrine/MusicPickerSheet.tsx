import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Music2, X } from "lucide-react-native";
import { Press } from "../Press";
import {
  defaultMusicFor,
  MUSIC_LIBRARY,
  musicLabel,
  type VitrineMusic,
} from "../../lib/vitrine-music";
import { GOLD, NAVY } from "../../theme";

export function MusicPickerSheet({
  open,
  onClose,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  value: VitrineMusic | null;
  onChange: (music: VitrineMusic | null) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<VitrineMusic | null>(value);

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.back}>
        <Press haptic="none" onPress={onClose} style={{ flex: 1 }} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.head}>
            <Text style={styles.title}>{t("publish.music.title")}</Text>
            <Press onPress={onClose} style={styles.close}>
              <X size={20} color={NAVY} />
            </Press>
          </View>
          <Text style={styles.hint}>{t("publish.music.hint")}</Text>
          <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
            {MUSIC_LIBRARY.map((track) => {
              const on = picked?.url === track.url;
              return (
                <Press
                  key={track.id}
                  onPress={() => setPicked(defaultMusicFor(track))}
                  style={[styles.track, on && styles.trackOn]}
                >
                  <Music2 size={16} color={on ? "#0a0a12" : GOLD} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.trackTitle, on && { color: "#0a0a12" }]}>{track.title}</Text>
                    <Text style={[styles.trackArtist, on && { color: "rgba(10,10,18,0.65)" }]}>
                      {track.artist} · {track.mood}
                    </Text>
                  </View>
                </Press>
              );
            })}
          </ScrollView>
          {picked ? (
            <Text style={styles.selected}>
              {t("publish.music.selected")} — {musicLabel(picked)}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {picked ? (
              <Press
                onPress={() => {
                  setPicked(null);
                  onChange(null);
                }}
                style={styles.ghost}
              >
                <Text style={styles.ghostTxt}>{t("publish.music.remove")}</Text>
              </Press>
            ) : null}
            <Press
              onPress={() => {
                onChange(picked);
                onClose();
              }}
              style={styles.cta}
            >
              <Text style={styles.ctaTxt}>{t("common.done", "OK")}</Text>
            </Press>
          </View>
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
    paddingHorizontal: 16,
    paddingTop: 14,
    maxHeight: "78%",
  },
  head: { flexDirection: "row", alignItems: "center" },
  title: { flex: 1, fontSize: 18, fontWeight: "800", color: NAVY },
  close: { width: 36, height: 36, minWidth: 36, minHeight: 36 },
  hint: { color: "#6B7289", fontSize: 12, marginBottom: 10, marginTop: 2 },
  track: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  trackOn: { backgroundColor: GOLD, borderColor: GOLD },
  trackTitle: { fontWeight: "800", color: NAVY, fontSize: 14 },
  trackArtist: { color: "#6B7289", fontSize: 11, marginTop: 2 },
  selected: { color: NAVY, fontWeight: "700", fontSize: 12, marginBottom: 8 },
  actions: { flexDirection: "row", gap: 8 },
  ghost: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  ghostTxt: { fontWeight: "800", color: NAVY },
  cta: { flex: 1, height: 48, borderRadius: 14, backgroundColor: GOLD },
  ctaTxt: { fontWeight: "800", color: "#0a0a12" },
});
