import { useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { GoogleGIcon } from "./GoogleGIcon";
import { useAuth } from "../../context/auth";
import {
  isAppleAuthCancellation,
  isNativeAppleAuthAvailable,
  signInWithAppleNative,
} from "../../lib/apple-auth";
import { isGoogleAuthCancellation, signInWithGoogle } from "../../lib/google-auth";
import { TERMS_VERSION } from "../../lib/legal-content";
import { supabase } from "../../lib/supabase";

async function recordConsent(
  userId: string,
  { terms, age }: { terms: boolean; age: boolean },
) {
  if (!terms && !age) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      ...(terms ? { terms_accepted_at: now, terms_version: TERMS_VERSION } : {}),
      ...(age ? { age_confirmed_at: now } : {}),
    })
    .eq("id", userId);
  if (error) throw error;
}

export function SocialLoginButtons({
  disabled = false,
  mode = "signin",
  layout = "stacked",
  recordTermsAcceptance = false,
  recordAgeConfirmation = false,
}: {
  disabled?: boolean;
  mode?: "signin" | "signup" | "continue";
  layout?: "stacked" | "row";
  recordTermsAcceptance?: boolean;
  recordAgeConfirmation?: boolean;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { closeAuth, refreshUser } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<"apple" | "google" | null>(null);
  const useRow = layout === "row" && width >= 390;

  useEffect(() => {
    let active = true;
    void isNativeAppleAuthAvailable().then((available) => {
      if (active) setAppleAvailable(available);
    });
    return () => {
      active = false;
    };
  }, []);

  const runApple = async () => {
    if (disabled || busy) return;
    setBusy("apple");
    try {
      const user = await signInWithAppleNative();
      await recordConsent(user.id, {
        terms: recordTermsAcceptance,
        age: recordAgeConfirmation,
      });
      await refreshUser();
      closeAuth();
    } catch (error) {
      if (!isAppleAuthCancellation(error)) {
        Alert.alert("KiDi+", t("auth.social.failed"));
      }
    } finally {
      setBusy(null);
    }
  };

  const runGoogle = async () => {
    if (disabled || busy) return;
    setBusy("google");
    try {
      const user = await signInWithGoogle();
      await recordConsent(user.id, {
        terms: recordTermsAcceptance,
        age: recordAgeConfirmation,
      });
      await refreshUser();
      closeAuth();
    } catch (error) {
      if (!isGoogleAuthCancellation(error)) {
        console.warn(
          "[auth/google] failed",
          error instanceof Error ? error.message : String(error),
        );
        Alert.alert("KiDi+", t("auth.social.failed"));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <View
      pointerEvents={disabled || busy ? "none" : "auto"}
      style={[
        styles.container,
        useRow && styles.containerRow,
        (disabled || busy) && styles.disabled,
      ]}
    >
      {Platform.OS === "ios" && appleAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            mode === "continue"
              ? AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
              : mode === "signup"
                ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
          }
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={useRow ? styles.appleBtnRow : styles.appleBtn}
          onPress={() => void runApple()}
        />
      )}
      <Press
        accessibilityLabel={
          mode === "continue"
            ? t("auth.social.continueWith", { provider: "Google" })
            : mode === "signup"
              ? t("auth.social.signUpGoogle")
              : t("auth.social.signInGoogle")
        }
        accessibilityRole="button"
        onPress={() => void runGoogle()}
        style={[styles.googleBtn, useRow && styles.googleBtnRow]}
      >
        <View style={styles.googleIconWrap}>
          <GoogleGIcon />
        </View>
        <Text
          adjustsFontSizeToFit={useRow}
          minimumFontScale={0.82}
          numberOfLines={1}
          style={[styles.googleText, useRow && styles.googleTextRow]}
        >
          {mode === "continue"
            ? t("auth.social.continueWith", { provider: "Google" })
            : mode === "signup"
              ? t("auth.social.signUpGoogle")
              : t("auth.social.signInGoogle")}
        </Text>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: 375, alignSelf: "center", gap: 10, marginVertical: 12 },
  containerRow: { flexDirection: "row", alignItems: "center" },
  disabled: { opacity: 0.45 },
  appleBtn: {
    width: "100%",
    height: 48,
  },
  appleBtnRow: { flex: 1, height: 48 },
  googleBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#747775",
    paddingHorizontal: 12,
  },
  googleBtnRow: { flex: 1 },
  googleIconWrap: { position: "absolute", left: 14 },
  googleText: { color: "#1F1F1F", fontSize: 15, fontWeight: "600" },
  googleTextRow: { fontSize: 13 },
});
