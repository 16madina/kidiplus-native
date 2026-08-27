import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ChevronRight, Moon, Sun } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { AuthLanguageToggle } from "../components/AuthLanguageToggle";
import { SurfaceCard } from "../components/SurfaceCard";
import { OverlayHeader } from "../components/OverlayHeader";
import { PushScreen } from "../components/PushScreen";
import { Press } from "../components/Press";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import { useAppTheme } from "../context/theme";
import { GOLD } from "../theme";
import { LegalScreen } from "./LegalScreen";

export function SettingsScreen() {
  const { t } = useTranslation();
  const { colors, dark, setDark } = useAppTheme();
  const { user, signOut } = useAuth();
  const { closeOverlay } = useNav();
  const [legal, setLegal] = useState<null | "terms" | "privacy">(null);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title={t("settings.title")} />
      <ScrollView contentContainerStyle={styles.body}>
        <Label text={t("settings.preferences")} color={colors.mutedForeground} />
        <SurfaceCard padded={false}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>{t("settings.language")}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{t("settings.languageSubtitle")}</Text>
            </View>
            <AuthLanguageToggle variant={dark ? "dark" : "light"} />
          </View>
          <Press onPress={() => setDark(!dark)} style={styles.row}>
            {dark ? <Moon size={18} color={colors.foreground} /> : <Sun size={18} color={colors.foreground} />}
            <Text style={[styles.rowTitle, { flex: 1, color: colors.foreground }]}>{t("profile.menu.darkMode")}</Text>
            <Text style={{ color: GOLD, fontWeight: "800" }}>{dark ? "ON" : "OFF"}</Text>
          </Press>
          <View style={styles.row}>
            <Text style={[styles.rowTitle, { flex: 1, color: colors.foreground }]}>{t("settings.currency")}</Text>
            <Text style={{ fontWeight: "800", color: colors.foreground }}>EUR · €</Text>
          </View>
        </SurfaceCard>

        <Label text={t("settings.account")} color={colors.mutedForeground} />
        <SurfaceCard padded={false}>
          <View style={styles.row}>
            <Text style={[styles.rowTitle, { flex: 1, color: colors.foreground }]}>{user?.email ?? "—"}</Text>
          </View>
          <Press
            onPress={() => {
              closeOverlay();
              signOut();
            }}
            style={styles.row}
          >
            <Text style={[styles.rowTitle, { color: "#C0392B" }]}>{t("settings.logout")}</Text>
          </Press>
        </SurfaceCard>

        <Label text={t("settings.about")} color={colors.mutedForeground} />
        <SurfaceCard padded={false}>
          <View style={styles.row}>
            <Text style={[styles.rowTitle, { flex: 1, color: colors.foreground }]}>{t("settings.version")}</Text>
            <Text style={{ color: colors.mutedForeground, fontWeight: "700" }}>1.0.0</Text>
          </View>
          <Press onPress={() => setLegal("terms")} style={styles.row}>
            <Text style={[styles.rowTitle, { flex: 1, color: colors.foreground }]}>{t("profile.menu.terms")}</Text>
            <ChevronRight size={18} color={colors.mutedForeground} />
          </Press>
          <Press onPress={() => setLegal("privacy")} style={styles.row}>
            <Text style={[styles.rowTitle, { flex: 1, color: colors.foreground }]}>{t("profile.menu.privacy")}</Text>
            <ChevronRight size={18} color={colors.mutedForeground} />
          </Press>
        </SurfaceCard>
      </ScrollView>
      <PushScreen open={!!legal} onClose={() => setLegal(null)} zIndex={20}>
        {legal ? <LegalScreen page={legal} onClose={() => setLegal(null)} /> : null}
      </PushScreen>
    </View>
  );
}

function Label({ text, color }: { text: string; color: string }) {
  return (
    <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 0.7, color, marginTop: 8, marginBottom: 2 }}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 8 },
  row: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowTitle: { fontSize: 15, fontWeight: "600" },
});
