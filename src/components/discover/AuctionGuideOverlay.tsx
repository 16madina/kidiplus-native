import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react-native";
import { Press } from "../Press";
import { AUCTION_GUIDE_STEPS, auctionGuideCopy } from "../../lib/auction-guide";
import { GOLD, NAVY } from "../../theme";

export function AuctionGuideOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.head}>
          <Text style={styles.title}>{t("discover.bidGuide.title", "Comment enchérir")}</Text>
          <Press onPress={onClose} style={styles.close}>
            <X size={20} color={NAVY} />
          </Press>
        </View>
        <Text style={styles.intro}>
          {t(
            "discover.bidGuide.intro",
            "Les enchères KiDi+ se paient avec le portefeuille. Voici les 6 étapes, comme sur le site.",
          )}
        </Text>
        <ScrollView contentContainerStyle={{ paddingBottom: 24, gap: 12 }}>
          {AUCTION_GUIDE_STEPS.map((step, i) => {
            const copy = auctionGuideCopy(step, i18n.language);
            return (
              <View key={step.id} style={styles.card}>
                <View style={styles.num}>
                  <Text style={styles.numTxt}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{copy.title}</Text>
                  <Text style={styles.cardBody}>{copy.body}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
        <Press onPress={onClose} style={styles.cta}>
          <Text style={styles.ctaTxt}>{t("common.gotIt", "Compris")}</Text>
        </Press>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 16 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontWeight: "800", color: NAVY, flex: 1 },
  close: { width: 40, height: 40, minWidth: 40, minHeight: 40 },
  intro: { marginTop: 8, marginBottom: 16, color: "#6B7289", fontSize: 14, lineHeight: 20 },
  card: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(232,185,59,0.35)",
    backgroundColor: "rgba(232,185,59,0.08)",
    padding: 14,
  },
  num: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  numTxt: { fontWeight: "900", color: "#0a0a12" },
  cardTitle: { fontWeight: "800", color: NAVY, fontSize: 15 },
  cardBody: { marginTop: 4, color: "#374151", fontSize: 13, lineHeight: 18 },
  cta: { height: 52, borderRadius: 16, backgroundColor: GOLD },
  ctaTxt: { color: "#0a0a12", fontWeight: "800", fontSize: 16 },
});
