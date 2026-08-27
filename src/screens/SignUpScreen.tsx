import { useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { ChevronDown, Eye, EyeOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { AuthInput } from "../components/AuthInput";
import { RedButton } from "../components/Buttons";
import { Press } from "../components/Press";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { GOLD } from "../theme";
import { AuthScreenShell } from "./SignInScreen";
import { LegalScreen } from "./LegalScreen";

const COUNTRIES = [
  { code: "FR", name: "France", value: "🇫🇷 France" },
  { code: "BE", name: "Belgique", value: "🇧🇪 Belgique" },
  { code: "CH", name: "Suisse", value: "🇨🇭 Suisse" },
  { code: "CA", name: "Canada", value: "🇨🇦 Canada" },
  { code: "CI", name: "Côte d'Ivoire", value: "🇨🇮 Côte d'Ivoire" },
  { code: "SN", name: "Sénégal", value: "🇸🇳 Sénégal" },
  { code: "MA", name: "Maroc", value: "🇲🇦 Maroc" },
  { code: "DZ", name: "Algérie", value: "🇩🇿 Algérie" },
  { code: "TN", name: "Tunisie", value: "🇹🇳 Tunisie" },
  { code: "CM", name: "Cameroun", value: "🇨🇲 Cameroun" },
  { code: "CD", name: "RD Congo", value: "🇨🇩 RD Congo" },
  { code: "GA", name: "Gabon", value: "🇬🇦 Gabon" },
  { code: "ML", name: "Mali", value: "🇲🇱 Mali" },
  { code: "BF", name: "Burkina Faso", value: "🇧🇫 Burkina Faso" },
  { code: "", name: "Autre", value: "🌍 Autre" },
];

export function SignUpScreen() {
  const { t } = useTranslation();
  const { setView, signUp } = useAuth();
  const { colors } = useAppTheme();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [legal, setLegal] = useState<null | "terms" | "privacy">(null);

  if (legal) return <LegalScreen page={legal} onClose={() => setLegal(null)} />;

  const validate = () => {
    if (!displayName.trim() || displayName.trim().length < 2) return t("auth.validation.nameRequired");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return t("auth.validation.emailInvalid");
    if (email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase()) return t("auth.validation.emailMismatch");
    if (!country.trim()) return t("auth.validation.countryRequired");
    if (phone.replace(/\D/g, "").length < 8) return t("auth.validation.phoneRequired");
    if (password.length < 8) return t("auth.errors.passwordWeak");
    if (!acceptTerms || !confirmAge) return t("consent.required");
    return null;
  };

  const submit = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        country,
        phone: phone.trim(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  const selected = COUNTRIES.find((c) => c.value === country);

  return (
    <AuthScreenShell title={t("auth.welcome.signUp")} onBack={() => setView("welcome")}>
      <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground }}>{t("auth.signUp.title")}</Text>
      <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 4 }}>{t("auth.signUp.subtitle")}</Text>
      <AuthInput label={t("auth.signUp.displayName")} value={displayName} onChangeText={setDisplayName} placeholder={t("auth.signUp.displayNamePlaceholder")} maxLength={40} />
      <AuthInput label={t("auth.signUp.email")} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder={t("auth.signIn.emailPlaceholder")} />
      <AuthInput label={t("auth.signUp.emailConfirm")} autoCapitalize="none" keyboardType="email-address" value={emailConfirm} onChangeText={setEmailConfirm} placeholder={t("auth.signIn.emailPlaceholder")} />
      <View>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{t("auth.signUp.country")}</Text>
        <Press onPress={() => setCountryOpen(true)} style={[styles.select, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={{ color: selected ? colors.foreground : colors.mutedForeground, fontSize: 15 }}>
            {selected?.value ?? t("auth.signUp.countryPlaceholder")}
          </Text>
          <ChevronDown size={18} color={colors.mutedForeground} />
        </Press>
      </View>
      <AuthInput label={t("auth.signUp.phone")} keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder={t("auth.signUp.phonePlaceholder")} />
      <View>
        <AuthInput label={t("auth.signUp.password")} secureTextEntry={!show} value={password} onChangeText={setPassword} placeholder="••••••••" />
        <Press onPress={() => setShow((s) => !s)} style={styles.eye}>
          {show ? <EyeOff size={18} color={colors.mutedForeground} /> : <Eye size={18} color={colors.mutedForeground} />}
        </Press>
        <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 4 }}>{t("auth.signUp.passwordHint")}</Text>
      </View>
      <AuthInput label={t("auth.signUp.promoCode")} autoCapitalize="characters" value={promoCode} onChangeText={setPromoCode} placeholder="KIDIPLUS" />
      {promoCode.trim() ? (
        <Text style={{ fontSize: 12, fontWeight: "700", color: promoCode.trim().toUpperCase() === "KIDIPLUS" ? "#1B7A3A" : "#C0392B" }}>
          {promoCode.trim().toUpperCase() === "KIDIPLUS" ? "✓ KIDIPLUS" : "—"}
        </Text>
      ) : null}
      {error ? (
        <View style={{ backgroundColor: "#FDE8E8", borderRadius: 12, padding: 10 }}>
          <Text style={{ color: "#9B1C1C", fontSize: 13, fontWeight: "600" }}>{error}</Text>
        </View>
      ) : null}
      <Press onPress={() => setAcceptTerms((v) => !v)} style={styles.row} haptic="none">
        <View style={[styles.box, acceptTerms && { backgroundColor: GOLD }]} />
        <Text style={{ flex: 1, fontSize: 12.5, color: colors.foreground }}>{t("consent.checkbox").replace(/<[^>]+>/g, "")}</Text>
      </Press>
      <Press onPress={() => setConfirmAge((v) => !v)} style={styles.row} haptic="none">
        <View style={[styles.box, confirmAge && { backgroundColor: GOLD }]} />
        <Text style={{ flex: 1, fontSize: 12.5, color: colors.foreground }}>{t("consent.ageCheckbox")}</Text>
      </Press>
      <RedButton
        label={loading ? t("auth.signUp.submitting") : t("auth.signUp.submit")}
        disabled={loading || !acceptTerms || !confirmAge}
        onPress={() => void submit()}
      />
      <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 8 }}>
        <Text style={{ color: colors.mutedForeground }}>{t("auth.signUp.haveAccount")} </Text>
        <Press onPress={() => setView("signin")} style={{ minHeight: 0, minWidth: 0 }}>
          <Text style={{ fontWeight: "800", color: colors.foreground }}>{t("auth.signUp.signIn")}</Text>
        </Press>
      </View>
      <Modal visible={countryOpen} animationType="slide" onRequestClose={() => setCountryOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 60, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", marginBottom: 12, color: colors.foreground }}>{t("auth.signUp.country")}</Text>
          {COUNTRIES.map((c) => (
            <Press
              key={c.value}
              onPress={() => {
                setCountry(c.value);
                setCountryOpen(false);
              }}
              style={{ minHeight: 48, alignItems: "flex-start" }}
            >
              <Text style={{ fontSize: 16, color: colors.foreground }}>{c.value}</Text>
            </Press>
          ))}
        </View>
      </Modal>
    </AuthScreenShell>
  );
}

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { setView, sendReset } = useAuth();
  const { colors } = useAppTheme();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <AuthScreenShell title={t("auth.forgot.title")} onBack={() => setView("signin")}>
      <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground }}>{t("auth.forgot.title")}</Text>
      <Text style={{ fontSize: 14, color: colors.mutedForeground }}>{t("auth.forgot.subtitle")}</Text>
      <AuthInput label={t("auth.forgot.email")} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder={t("auth.signIn.emailPlaceholder")} />
      {sent ? <Text style={{ color: "#1B7A3A", fontWeight: "700" }}>{t("auth.forgot.sent")}</Text> : null}
      <RedButton
        label={loading ? t("auth.forgot.submitting") : t("auth.forgot.submit")}
        disabled={loading}
        onPress={async () => {
          setLoading(true);
          await sendReset(email);
          setSent(true);
          setLoading(false);
        }}
      />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6, fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  select: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eye: { position: "absolute", right: 8, top: 30, width: 40, height: 40 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8, minHeight: 0 },
  box: { width: 16, height: 16, marginTop: 2, borderRadius: 3, borderWidth: 1.5, borderColor: GOLD },
});
