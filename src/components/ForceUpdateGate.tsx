import { useEffect, useState, type ReactNode } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Press } from "./Press";
import { NAVY } from "../theme";

const APP_VERSION: string =
  Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? "1.0.0";

const APP_STORE_URL = Platform.select({
  ios: "https://apps.apple.com/app/kidiplus/id6745498169",
  android: "https://play.google.com/store/apps/details?id=com.kidiplus.app",
  default: "https://kidiplus.com",
});

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

export function ForceUpdateGate({ children }: { children: ReactNode }) {
  const [forceUpdate, setForceUpdate] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("https://kidiplus.com/api/public/app-version", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const json = (await res.json()) as { minVersion?: string; latestVersion?: string };
        if (cancelled) return;
        if (json.minVersion && compareVersions(APP_VERSION, json.minVersion) < 0) {
          setForceUpdate(true);
        }
      } catch {
        // Network error — don't block the app
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (forceUpdate) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.emoji}>🔄</Text>
        <Text style={styles.title}>Mise à jour requise</Text>
        <Text style={styles.body}>
          Une nouvelle version de KiDi+ est disponible. Mets à jour l'application pour continuer.
        </Text>
        <Press onPress={() => void Linking.openURL(APP_STORE_URL)} style={styles.btn}>
          <Text style={styles.btnText}>Mettre à jour</Text>
        </Press>
        <Text style={styles.version}>Version actuelle : {APP_VERSION}</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "800", color: "#fff", textAlign: "center", marginBottom: 12 },
  body: { fontSize: 14, color: "#999", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  btn: {
    backgroundColor: "#2ECC71",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  version: { color: "#666", fontSize: 12, marginTop: 16 },
});
