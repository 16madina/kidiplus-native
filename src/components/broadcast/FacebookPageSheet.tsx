import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import type { FacebookPageOption } from "../../lib/facebook-restream";
import { GOLD, NAVY } from "../../theme";

export function FacebookPageSheet({
  open,
  onClose,
  pages,
  selectedPageId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  pages: FacebookPageOption[];
  selectedPageId?: string | null;
  onPick: (pageId: string) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.back}>
        <Press haptic="none" onPress={onClose} style={{ flex: 1 }} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.title}>{t("broadcast.facebook.pickPageTitle")}</Text>
          <Text style={styles.body}>{t("broadcast.facebook.pickPageHint")}</Text>
          <ScrollView contentContainerStyle={{ gap: 8, paddingTop: 12, paddingBottom: 8 }}>
            {pages.length === 0 ? (
              <Text style={styles.empty}>{t("broadcast.facebook.noPages")}</Text>
            ) : (
              pages.map((p) => {
                const on = p.id === selectedPageId;
                return (
                  <Press key={p.id} onPress={() => onPick(p.id)} style={[styles.row, on && styles.rowOn]}>
                    <Text style={[styles.rowTxt, on && { color: "#0a0a12" }]}>{p.name}</Text>
                  </Press>
                );
              })
            )}
          </ScrollView>
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
    maxHeight: "70%",
  },
  title: { fontSize: 20, fontWeight: "800", color: NAVY },
  body: { marginTop: 6, color: "#6B7289", fontSize: 13 },
  empty: { color: "#6B7289", marginTop: 12 },
  row: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    alignItems: "flex-start",
  },
  rowOn: { backgroundColor: GOLD, borderColor: GOLD },
  rowTxt: { fontWeight: "800", color: NAVY },
});
