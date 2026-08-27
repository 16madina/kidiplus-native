import { useMemo, useState } from "react";
import { ImageBackground, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { AuthLanguageToggle } from "../components/AuthLanguageToggle";
import { GoldButton, OutlineButton } from "../components/Buttons";
import { Glass, GlassIconButton } from "../components/Glass";
import { Press } from "../components/Press";
import { X } from "lucide-react-native";
import { GOLD_WELCOME, WELCOME_BG } from "../theme";
import { useAuth } from "../context/auth";
import { LegalScreen } from "./LegalScreen";

const BGS = [
  require("../../assets/welcome/auth-bg-1.jpg"),
  require("../../assets/welcome/auth-bg-2.jpg"),
  require("../../assets/welcome/auth-bg-3.jpg"),
  require("../../assets/welcome/auth-bg-4.jpg"),
];
const badge = require("../../assets/brand/kidi-badge-v2.png");

export function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { setView, enterGuestMode, authOverlay, closeAuth } = useAuth();
  const bg = useMemo(() => BGS[Math.floor(Math.random() * BGS.length)], []);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [legal, setLegal] = useState<null | "terms" | "privacy">(null);
  const [toast, setToast] = useState<string | null>(null);

  const requireTerms = (fn: () => void) => {
    if (!acceptTerms) {
      setToast(t("consent.required"));
      setTimeout(() => setToast(null), 2800);
      return;
    }
    fn();
  };

  if (legal) {
    return <LegalScreen page={legal} onClose={() => setLegal(null)} />;
  }

  return (
    <View style={styles.root}>
      <ImageBackground source={bg} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={["rgba(11,20,54,0.92)", "rgba(11,20,54,0.75)", "rgba(11,20,54,0.35)", "rgba(11,20,54,0)"]}
        style={styles.topFade}
      />
      <LinearGradient
        colors={["rgba(11,20,54,0)", "rgba(11,20,54,0.6)", WELCOME_BG]}
        style={styles.bottomFade}
      />
      <View style={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.topRow}>
          <AuthLanguageToggle variant="dark" />
          {authOverlay ? (
            <GlassIconButton tone="light" onPress={closeAuth}>
              <X size={20} color="#10162B" strokeWidth={2.2} />
            </GlassIconButton>
          ) : (
            <View />
          )}
        </View>
        <ImageBackground source={badge} style={styles.badge} resizeMode="contain" />
        <Text style={styles.title}>
          KIDI<Text style={{ color: GOLD_WELCOME }}>+</Text>
        </Text>
        <Text style={styles.tagline}>
          {t("auth.welcome.tagline")}
          {"\n"}
          <Text style={{ color: GOLD_WELCOME, fontWeight: "700" }}>{t("auth.welcome.taglineAccent")}</Text>
        </Text>
        <View style={{ flex: 1, minHeight: 8 }} />
        <Press onPress={() => setAcceptTerms((v) => !v)} style={styles.consent} haptic="none">
          <Glass tone="dark" intensity={28} radius={5} elevated={false}>
            <View style={[styles.checkbox, acceptTerms && styles.checkboxOn]}>
              {acceptTerms ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
          </Glass>
          <Text style={styles.consentText}>
            {t("consent.checkbox").split("<t>")[0]}
            <Text style={styles.link} onPress={() => setLegal("terms")}>
              {t("common.and") === "et" ? "Conditions d'utilisation" : "Terms of Use"}
            </Text>
            {" "}
            {t("common.and")}{" "}
            <Text style={styles.link} onPress={() => setLegal("privacy")}>
              {t("common.and") === "et" ? "Politique de confidentialité" : "Privacy Policy"}
            </Text>
          </Text>
        </Press>
        <GoldButton
          label={t("auth.welcome.signUp")}
          disabled={!acceptTerms}
          onPress={() => requireTerms(() => setView("signup"))}
        />
        <View style={{ height: 8 }} />
        <OutlineButton label={t("auth.welcome.signIn")} onPress={() => requireTerms(() => setView("signin"))} />
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.or}>{t("auth.welcome.or")}</Text>
          <View style={styles.orLine} />
        </View>
        <OutlineButton label={t("auth.welcome.continueAsGuest")} onPress={() => requireTerms(enterGuestMode)} />
      </View>
      {toast ? (
        <View style={[styles.toast, { bottom: insets.bottom + 16 }]}>
          <Glass tone="dark" intensity={48} radius={16} padded>
            <Text style={styles.toastText}>{toast}</Text>
          </Glass>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WELCOME_BG },
  topFade: { position: "absolute", left: 0, right: 0, top: 0, height: "32%" },
  bottomFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "22%" },
  content: { flex: 1, alignItems: "center", paddingHorizontal: 24 },
  topRow: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: {
    width: 92,
    height: 92,
    marginTop: 8,
  },
  title: {
    marginTop: 4,
    color: "#fff",
    fontSize: 48,
    fontWeight: "900",
    lineHeight: 52,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 20,
  },
  tagline: {
    marginTop: 8,
    color: "#fff",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 320,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  consent: {
    width: "100%",
    minHeight: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: GOLD_WELCOME },
  checkMark: { color: WELCOME_BG, fontSize: 11, fontWeight: "900", lineHeight: 12 },
  consentText: { flex: 1, color: "rgba(255,255,255,0.9)", fontSize: 12, lineHeight: 16 },
  link: { fontWeight: "800", textDecorationLine: "underline" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 10, width: "100%" },
  orLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.25)" },
  or: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700" },
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
  },
  toastText: { color: "#fff", fontSize: 13, fontWeight: "600", textAlign: "center" },
});
