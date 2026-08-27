import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../components/Press";
import { GoldButton } from "../components/Buttons";
import { useAppTheme } from "../context/theme";
import { useNav } from "../context/navigation";
import type { Overlay } from "../context/navigation";

const TITLES: Record<string, string> = {
  shop: "Ma boutique",
  wallet: "Portefeuille",
  orders: "Mes commandes",
  earnings: "Mes gains",
  settings: "Paramètres",
  help: "Aide & support",
  addresses: "Mes adresses",
};

export function PlaceholderScreen({ kind }: { kind: Overlay["kind"] }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { closeOverlay, overlay } = useNav();
  const title = TITLES[String(kind)] ?? String(kind);
  const isBroadcast = overlay.kind === "broadcast-setup";
  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Press onPress={closeOverlay} style={styles.back}>
          <ChevronLeft size={24} color={colors.foreground} />
          <Text style={{ fontWeight: "700", color: colors.foreground }}>{t("common.close")}</Text>
        </Press>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {isBroadcast ? (overlay.mode === "now" ? "Commencer un live" : "Programmer un live") : title}
        </Text>
        <View style={{ width: 64 }} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.p, { color: colors.mutedForeground }]}>
          {isBroadcast
            ? "La caméra, les enchères et le streaming LiveKit seront branchés dans une prochaine itération. Le UI d’entrée Go Live est déjà en place."
            : "Données mock — le backend KiDi+ (paiements, boutique, commandes) sera connecté plus tard. Cette app native ne touche pas au listing store com.kidiplus.app."}
        </Text>
        <GoldButton label={t("common.ok")} onPress={closeOverlay} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 },
  back: { flexDirection: "row", alignItems: "center", minWidth: 0, paddingRight: 8 },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  body: { padding: 24, gap: 20 },
  p: { fontSize: 15, lineHeight: 22 },
});
