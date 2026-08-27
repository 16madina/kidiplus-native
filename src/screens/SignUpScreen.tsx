import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { AuthInput } from "../components/AuthInput";
import { RedButton } from "../components/Buttons";
import { CountrySelect } from "../components/CountrySelect";
import { Press } from "../components/Press";
import { useAuth } from "../context/auth";
import { useAppTheme } from "../context/theme";
import { GOLD } from "../theme";
import { countryLabel } from "../lib/countries";
import { validatePromoCode } from "../lib/referrals";
import { AuthScreenShell } from "./SignInScreen";
import { LegalScreen } from "./LegalScreen";

export function SignUpScreen() {
  const { t, i18n } = useTranslation();
  const { setView, signUp } = useAuth();
  const { colors } = useAppTheme();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoValid, setPromoValid] = useState<boolean | null>(null);
  const [legal, setLegal] = useState<null | "terms" | "privacy">(null);

  useEffect(() => {
    const c = promoCode.trim();
    if (!c) {
      setPromoValid(null);
      return;
    }
    const id = setTimeout(() => {
      void validatePromoCode(c).then(setPromoValid);
    }, 280);
    return () => clearTimeout(id);
  }, [promoCode]);

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
    setInfo(null);
    try {
      const result = await signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        country,
        phone: phone.trim(),
        promoCode: promoCode.trim() && promoValid ? promoCode.trim() : undefined,
      });
      if (result.needsEmailConfirmation) {
        setInfo(t("auth.signUp.checkEmailBody"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenShell title={t("auth.welcome.signUp")} onBack={() => setView("welcome")}>
      <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground }}>{t("auth.signUp.title")}</Text>
      <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 4 }}>{t("auth.signUp.subtitle")}</Text>
      <AuthInput label={t("auth.signUp.displayName")} value={displayName} onChangeText={setDisplayName} placeholder={t("auth.signUp.displayNamePlaceholder")} maxLength={40} />
      <AuthInput label={t("auth.signUp.email")} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder={t("auth.signIn.emailPlaceholder")} />
      <AuthInput label={t("auth.signUp.emailConfirm")} autoCapitalize="none" keyboardType="email-address" value={emailConfirm} onChangeText={setEmailConfirm} placeholder={t("auth.signIn.emailPlaceholder")} />
      <CountrySelect
        required
        label={t("auth.signUp.country")}
        value={country}
        placeholder={t("auth.signUp.countryPlaceholder")}
        includeOther
        onChange={(code) => setCountry(code ? countryLabel(code, i18n.language) : "🌍 Autre")}
      />
      <AuthInput label={t("auth.signUp.phone")} keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder={t("auth.signUp.phonePlaceholder")} />
      <View>
        <AuthInput label={t("auth.signUp.password")} secureTextEntry={!show} value={password} onChangeText={setPassword} placeholder="••••••••" />
        <Press onPress={() => setShow((s) => !s)} style={styles.eye}>
          {show ? <EyeOff size={18} color={colors.mutedForeground} /> : <Eye size={18} color={colors.mutedForeground} />}
        </Press>
        <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 4 }}>{t("auth.signUp.passwordHint")}</Text>
      </View>
      <AuthInput label={t("auth.signUp.promoCode")} autoCapitalize="characters" value={promoCode} onChangeText={setPromoCode} placeholder="KIDI-XXXX" />
      {promoCode.trim() && promoValid !== null ? (
        <Text style={{ fontSize: 12, fontWeight: "700", color: promoValid ? "#1B7A3A" : "#C0392B" }}>
          {promoValid ? `✓ ${promoCode.trim().toUpperCase()}` : t("referral.claim.errInvalid")}
        </Text>
      ) : null}
      {info ? (
        <View style={{ backgroundColor: "#E8F6EE", borderRadius: 12, padding: 10 }}>
          <Text style={{ color: "#1B7A3A", fontSize: 13, fontWeight: "600" }}>{info}</Text>
        </View>
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
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthScreenShell title={t("auth.forgot.title")} onBack={() => setView("signin")}>
      <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground }}>{t("auth.forgot.title")}</Text>
      <Text style={{ fontSize: 14, color: colors.mutedForeground }}>{t("auth.forgot.subtitle")}</Text>
      <AuthInput label={t("auth.forgot.email")} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder={t("auth.signIn.emailPlaceholder")} />
      {error ? (
        <View style={{ backgroundColor: "#FDE8E8", borderRadius: 12, padding: 10 }}>
          <Text style={{ color: "#9B1C1C", fontSize: 13, fontWeight: "600" }}>{error}</Text>
        </View>
      ) : null}
      {sent ? <Text style={{ color: "#1B7A3A", fontWeight: "700" }}>{t("auth.forgot.sent")}</Text> : null}
      <RedButton
        label={loading ? t("auth.forgot.submitting") : t("auth.forgot.submit")}
        disabled={loading}
        onPress={async () => {
          setError(null);
          setLoading(true);
          try {
            await sendReset(email);
            setSent(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : t("auth.errors.generic"));
          } finally {
            setLoading(false);
          }
        }}
      />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  eye: { position: "absolute", right: 8, top: 26, width: 40, height: 40 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8, minHeight: 0 },
  box: { width: 16, height: 16, marginTop: 2, borderRadius: 3, borderWidth: 1.5, borderColor: GOLD },
});
