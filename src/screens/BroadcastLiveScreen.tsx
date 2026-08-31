import { lazy, Suspense } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Press } from "../components/Press";
import { useNav } from "../context/navigation";
import { isExpoGo } from "../lib/expo-go";
import { GOLD } from "../theme";
import type { CameraType } from "expo-camera";

const Host = lazy(async () => {
  const mod = await import("./BroadcastLiveHost");
  return { default: mod.BroadcastLiveHost };
});

/**
 * Expo Go cannot load LiveKit. Scanning the Metro QR opens Expo Go —
 * the real live is the KiDi+ development build (npx expo run:ios).
 */
export function BroadcastLiveScreen(props: {
  liveId: string;
  roomName: string;
  title: string;
  identity: string;
  displayName: string;
  facing: CameraType;
  rtmpMode?: boolean;
  rtmpCreds?: { url: string; streamKey: string; ingressId: string; participantIdentity: string };
}) {
  const { closeOverlay } = useNav();

  if (isExpoGo()) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Pas Expo Go</Text>
        <Text style={styles.err}>
          Le QR ouvre Expo Go. Le live caméra marche seulement dans l’app{" "}
          <Text style={styles.em}>KiDi+</Text> déjà installée sur l’iPhone (icône KiDi+, pas
          l’icône Expo Go).
        </Text>
        <Text style={styles.sub}>
          Ferme Expo Go. Ouvre l’icône KiDi+. Sur le Mac : npm run rebuild:ios puis npm start.
          Ne scanne pas le QR — ça rouvre Expo Go.
        </Text>
        <Press onPress={closeOverlay} style={styles.btn}>
          <Text style={styles.btnTxt}>Fermer</Text>
        </Press>
      </View>
    );
  }

  return (
    <Suspense
      fallback={
        <View style={styles.center}>
          <ActivityIndicator color={GOLD} />
        </View>
      }
    >
      <Host {...props} />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#05060a",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 28,
  },
  title: { color: GOLD, fontWeight: "900", fontSize: 22 },
  err: { color: "#fff", textAlign: "center", fontWeight: "700", lineHeight: 22 },
  em: { color: GOLD, fontWeight: "900" },
  sub: { color: "rgba(255,255,255,0.72)", textAlign: "center", lineHeight: 20 },
  btn: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnTxt: { color: "#fff", fontWeight: "800" },
});
