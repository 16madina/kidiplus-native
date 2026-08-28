import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../components/Press";
import { useAppTheme } from "../context/theme";
import { pickLegal, type LegalDoc } from "../lib/legal-content";
import { NAVY } from "../theme";

export type LegalPage = "terms" | "privacy" | "community" | "safety";

export function LegalScreen({
  page,
  onClose,
}: {
  page: LegalPage;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const { colors } = useAppTheme();

  const bundle = pickLegal(i18n.language);
  const doc: LegalDoc =
    page === "safety"
      ? {
          title: "Sécurité et communauté",
          intro:
            "KiDi+ est réservé aux personnes majeures (18 ans et plus). " +
            "Voici nos directives communautaires et nos engagements en matière de sécurité.",
          sections: bundle.community.sections,
        }
      : bundle[page];

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Press onPress={onClose} style={styles.back}>
          <ChevronLeft size={24} color={colors.foreground} strokeWidth={2.2} />
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>Retour</Text>
        </Press>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]}>{doc.title}</Text>
        {doc.intro ? (
          <Text style={[styles.intro, { color: colors.mutedForeground }]}>{doc.intro}</Text>
        ) : null}
        {doc.sections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={[styles.sectionH, { color: colors.foreground }]}>{section.h}</Text>
            {section.p.map((para, pIdx) => (
              <Text key={pIdx} style={[styles.p, { color: colors.mutedForeground }]}>
                {para}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 12, paddingVertical: 8, zIndex: 50 },
  back: { flexDirection: "row", alignItems: "center" },
  body: { padding: 24, paddingBottom: 64 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 12, color: NAVY },
  intro: { fontSize: 14, lineHeight: 21, marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionH: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  p: { fontSize: 14, lineHeight: 21, marginBottom: 8 },
});
