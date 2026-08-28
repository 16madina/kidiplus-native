import { Platform, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Press } from "../Press";
import { supabase, SUPABASE_URL } from "../../lib/supabase";

const REDIRECT_URI = "kidiplus://auth/callback";

async function signInWithProvider(provider: "apple" | "google") {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: REDIRECT_URI,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) return;
  await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);
}

export function SocialLoginButtons() {
  return (
    <View style={styles.container}>
      {Platform.OS === "ios" && (
        <Press onPress={() => void signInWithProvider("apple")} style={styles.appleBtn}>
          <Text style={styles.appleIcon}>{"\uF8FF"}</Text>
          <Text style={styles.appleText}>Continuer avec Apple</Text>
        </Press>
      )}
      <Press onPress={() => void signInWithProvider("google")} style={styles.googleBtn}>
        <Text style={styles.googleIcon}>G</Text>
        <Text style={styles.googleText}>Continuer avec Google</Text>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, marginVertical: 12 },
  appleBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#000",
    flexDirection: "row",
    gap: 8,
  },
  appleIcon: { fontSize: 18, color: "#fff" },
  appleText: { color: "#fff", fontSize: 15, fontWeight: "700" },
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
