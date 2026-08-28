import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../components/Press";
import { Glass } from "../components/Glass";
import { useAppTheme } from "../context/theme";
import { NAVY } from "../theme";

export function LegalScreen({
  page,
  onClose,
}: {
  page: "terms" | "privacy";
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const title = page === "terms" ? t("profile.menu.terms") : t("profile.menu.privacy");
  const body =
    page === "terms"
      ? "KiDi+ est une application de live shopping et d'enchères en direct. En utilisant l'application, tu acceptes de respecter la communauté, de ne pas proposer de produits illicites, et d'avoir au moins 18 ans.\n\nLes enchères sont engageantes. Les paiements, livraisons et litiges seront branchés au backend existant de kidiplus.com dans une prochaine itération native.\n\nCette application native (com.kidiplus.app) remplace progressivement la version Capacitor sur le même listing store."
      : "KiDi+ collecte les informations nécessaires au compte (email, nom, téléphone, pays) pour te permettre d'acheter et de vendre en live.\n\nCette version native utilise uniquement des données mock. Aucun secret, aucun backend et aucun identifiant store n'est branché pour l'instant.";

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Press onPress={onClose} style={styles.back}>
          <ChevronLeft size={24} color={colors.foreground} strokeWidth={2.2} />
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>{t("common.back")}</Text>
        </Press>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Glass tone={dark ? "dark" : "light"} intensity={36} radius={20} padded>
          <Text style={[styles.p, { color: colors.mutedForeground }]}>{body}</Text>
        </Glass>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 12, paddingVertical: 8, zIndex: 50 },
  back: { flexDirection: "row", alignItems: "center" },
  body: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 16, color: NAVY },
  p: { fontSize: 15, lineHeight: 22 },
});
