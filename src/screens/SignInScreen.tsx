import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Eye, EyeOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { AuthLanguageToggle } from "../components/AuthLanguageToggle";
import { AuthInput } from "../components/AuthInput";
import { RedButton } from "../components/Buttons";
import { Press } from "../components/Press";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { LegalScreen } from "./LegalScreen";

export function AuthScreenShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  return (
    <View style={[styles.shell, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        {onBack ? (
          <Press onPress={onBack} style={styles.back} haptic="light">
            <ChevronLeft size={24} color={colors.foreground} strokeWidth={2.2} />
            <Text style={[styles.backText, { color: colors.foreground }]}>{t("common.back")}</Text>
          </Press>
        ) : (
          <View style={{ width: 80 }} />
        )}
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <AuthLanguageToggle />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function SignInScreen() {
  const { t } = useTranslation();
  const { setView, signIn } = useAuth();
  const { colors } = useAppTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [legal, setLegal] = useState<null | "terms" | "privacy">(null);

  if (legal) return <LegalScreen page={legal} onClose={() => setLegal(null)} />;

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError(t("auth.validation.emailRequired"));
      return;
    }
    if (!acceptTerms) {
      setError(t("consent.required"));
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenShell title={t("auth.welcome.signIn")} onBack={() => setView("welcome")}>
      <Text style={[styles.h2, { color: colors.foreground }]}>{t("auth.signIn.title")}</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>{t("auth.signIn.subtitle")}</Text>
      <AuthInput
        label={t("auth.signIn.email")}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder={t("auth.signIn.emailPlaceholder")}
      />
      <View>
        <AuthInput
          label={t("auth.signIn.password")}
          secureTextEntry={!show}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
        />
        <Press onPress={() => setShow((s) => !s)} style={styles.eye}>
          {show ? <EyeOff size={18} color={colors.mutedForeground} /> : <Eye size={18} color={colors.mutedForeground} />}
        </Press>
      </View>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <Press onPress={() => setView("forgot")} style={styles.forgot}>
        <Text style={[styles.forgotText, { color: colors.mutedForeground }]}>{t("auth.signIn.forgot")}</Text>
      </Press>
      <Press onPress={() => setAcceptTerms((v) => !v)} style={styles.consent} haptic="none">
        <View style={[styles.box, acceptTerms && { backgroundColor: colors.foreground }]} />
        <Text style={[styles.consentText, { color: colors.foreground }]}>
          {t("consent.checkbox").replace(/<[^>]+>/g, "")}
        </Text>
      </Press>
      <RedButton
        label={loading ? t("auth.signIn.submitting") : t("auth.signIn.submit")}
        disabled={loading || !acceptTerms}
        onPress={() => void submit()}
      />
      <View style={styles.footer}>
        <Text style={{ color: colors.mutedForeground }}>{t("auth.signIn.noAccount")} </Text>
        <Press onPress={() => setView("signup")} style={{ minHeight: 0, minWidth: 0 }}>
          <Text style={[styles.footerLink, { color: colors.foreground }]}>{t("auth.signIn.createAccount")}</Text>
        </Press>
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  back: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingRight: 8 },
  backText: { fontSize: 15, fontWeight: "700" },
  title: { marginLeft: "auto", marginRight: 8, fontSize: 17, fontWeight: "600" },
  body: { paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  h2: { fontSize: 26, fontWeight: "800", marginTop: 8 },
  sub: { fontSize: 14, marginBottom: 4 },
  eye: { position: "absolute", right: 8, top: 30, width: 40, height: 40 },
  errorBox: { backgroundColor: "#FDE8E8", borderRadius: 12, padding: 10 },
  errorText: { color: "#9B1C1C", fontSize: 13, fontWeight: "600" },
  forgot: { alignSelf: "flex-end", minHeight: 0 },
  forgotText: { fontSize: 13, fontWeight: "700" },
  consent: { flexDirection: "row", alignItems: "flex-start", gap: 8, minHeight: 0 },
  box: { width: 16, height: 16, marginTop: 2, borderRadius: 3, borderWidth: 1.5, borderColor: "#10162B" },
  consentText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 8 },
  footerLink: { fontWeight: "800" },
});
