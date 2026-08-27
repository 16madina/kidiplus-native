import { useEffect, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Bell, ChevronRight, Moon, Sun, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { AuthLanguageToggle } from "../components/AuthLanguageToggle";
import { CurrencySheet } from "../components/CurrencySheet";
import { SurfaceCard } from "../components/SurfaceCard";
import { OverlayHeader, MockBanner } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import { usePush } from "../context/push";
import { useAppTheme } from "../context/theme";
import { currencySymbol, normalizeCurrency } from "../lib/money";
import { GOLD } from "../theme";
import { LegalScreen } from "./LegalScreen";

export function SettingsScreen() {
  const { t } = useTranslation();
  const { colors, dark, setDark } = useAppTheme();
  const { user, signOut } = useAuth();
  const { closeOverlay, openOverlay } = useNav();
  const push = usePush();
  const [legal, setLegal] = useState<null | "terms" | "privacy">(null);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const currency = normalizeCurrency(user?.walletCurrency);
  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    void push.refresh();
  }, [push]);

  const pushLabel =
    push.status === "granted"
      ? t("push.statusOn", { defaultValue: "Activées" })
      : push.status === "denied"
        ? t("push.statusDenied", { defaultValue: "Refusées" })
        : push.status === "unavailable"
          ? t("push.statusUnavailable", {
              defaultValue: "Rebuild requis (npx expo run:ios --device)",
            })
          : t("push.statusOff", { defaultValue: "Désactivées" });

  const onTogglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (push.status === "unavailable") {
        Alert.alert(
          t("push.rebuildTitle", { defaultValue: "Build natif requis" }),
          t("push.rebuildBody", {
            defaultValue:
              "Les notifications demandent un nouveau build : npm install && npx expo run:ios --device",
          }),
        );
        return;
      }
      if (push.status === "granted") {
        flash(t("push.alreadyOn", { defaultValue: "Les notifications sont déjà activées." }));
        return;
      }
      if (push.status === "denied") {
        Alert.alert(
          t("push.deniedTitle", { defaultValue: "Notifications refusées" }),
          t("push.deniedBody", {
            defaultValue: "Active-les dans Réglages iPhone → KiDi+ → Notifications.",
          }),
          [
            { text: t("common.cancel", { defaultValue: "Annuler" }), style: "cancel" },
            {
              text: t("push.openSettings", { defaultValue: "Ouvrir Réglages" }),
              onPress: () => void Linking.openSettings(),
            },
          ],
        );
        return;
      }
      const ok = await push.requestWithPrePrompt(
        t("push.prepromptBody", {
          defaultValue:
            "Active les notifications pour les rappels de live, enchères, commandes et messages.",
        }),
      );
      flash(
        ok
          ? t("push.enabledToast", { defaultValue: "Notifications activées" })
          : t("push.notEnabledToast", { defaultValue: "Notifications non activées" }),
      );
    } finally {
      setPushBusy(false);
    }
  };

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
          <Press onPress={() => setCurrencyOpen(true)} style={styles.row}>
            <Text style={[styles.rowTitle, { flex: 1, color: colors.foreground }]}>{t("settings.currency")}</Text>
            <Text style={{ fontWeight: "800", color: colors.foreground }}>
              {currency} · {currencySymbol(currency)}
            </Text>
            <ChevronRight size={18} color={colors.mutedForeground} />
          </Press>
          <Press onPress={() => void onTogglePush()} style={styles.row}>
            <Bell size={18} color={colors.foreground} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                {t("common.notifications", { defaultValue: "Notifications" })}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{pushLabel}</Text>
            </View>
            <ChevronRight size={18} color={colors.mutedForeground} />
          </Press>
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
          <Press onPress={() => openOverlay({ kind: "delete-account" })} style={styles.row}>
            <Trash2 size={18} color="#C0392B" />
            <Text style={[styles.rowTitle, { flex: 1, color: "#C0392B" }]}>{t("account.delete.menuItem")}</Text>
            <ChevronRight size={18} color={colors.mutedForeground} />
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

      <CurrencySheet
        open={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
        onToast={(msg: string) => {
          setCurrencyOpen(false);
          flash(msg);
        }}
      />
      {legal ? (
        <View style={StyleSheet.absoluteFill}>
          <LegalScreen page={legal} onClose={() => setLegal(null)} />
        </View>
      ) : null}
      <MockBanner text={toast} />
    </View>
  );
}

function Label({ text, color }: { text: string; color: string }) {
  return <Text style={[styles.label, { color }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, gap: 10 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    minHeight: 54,
  },
  rowTitle: { fontSize: 15, fontWeight: "700" },
});
