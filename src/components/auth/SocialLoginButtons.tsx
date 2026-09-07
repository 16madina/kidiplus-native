import { useEffect, useState } from "react";
import { Alert, Linking, Platform, StyleSheet, Text, View } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import * as AppleAuthentication from "expo-apple-authentication";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { useAuth } from "../../context/auth";
import {
  isAppleAuthCancellation,
  isNativeAppleAuthAvailable,
  signInWithAppleNative,
} from "../../lib/apple-auth";
import { supabase } from "../../lib/supabase";

const REDIRECT_URI = "kidiplus://auth/callback";

async function openAuthUrl(url: string) {
  if (requireOptionalNativeModule("ExpoWebBrowser")) {
    try {
      const WebBrowser = require("expo-web-browser") as typeof import("expo-web-browser");
      await WebBrowser.openAuthSessionAsync(url, REDIRECT_URI);
      return;
    } catch { /* fall through */ }
  }
  await Linking.openURL(url);
}

async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: REDIRECT_URI,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error("URL OAuth manquante");
  await openAuthUrl(data.url);
}

export function SocialLoginButtons({
  disabled = false,
  mode = "signin",
}: {
  disabled?: boolean;
  mode?: "signin" | "signup";
}) {
  const { t } = useTranslation();
  const { closeAuth, refreshUser } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<"apple" | "google" | null>(null);

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
      await signInWithAppleNative();
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
      await signInWithGoogle();
    } catch {
      Alert.alert("KiDi+", t("auth.social.failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View
      pointerEvents={disabled || busy ? "none" : "auto"}
      style={[styles.container, (disabled || busy) && styles.disabled]}
    >
      {Platform.OS === "ios" && appleAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            mode === "signup"
              ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
              : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
          }
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={styles.appleBtn}
          onPress={() => void runApple()}
        />
      )}
      <Press onPress={() => void runGoogle()} style={styles.googleBtn}>
        <Text style={styles.googleIcon}>G</Text>
        <Text style={styles.googleText}>{t("auth.social.continueWith", { provider: "Google" })}</Text>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, marginVertical: 12 },
  disabled: { opacity: 0.45 },
  appleBtn: {
    width: "100%",
    height: 48,
  },
  googleBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  googleIcon: { fontSize: 18, fontWeight: "700", color: "#4285F4" },
  googleText: { color: "#333", fontSize: 15, fontWeight: "700" },
});
