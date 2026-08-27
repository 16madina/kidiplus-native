import { StyleSheet, Text, View } from "react-native";
import { Press } from "../components/Press";
import { useNav } from "../context/navigation";
import type { CameraType } from "expo-camera";

/** LiveKit WebRTC n’est pas chargé sur le web — le live réel est iOS/Android. */
export function BroadcastLiveScreen({ title }: {
  liveId: string;
  roomName: string;
  title: string;
  identity: string;
  displayName: string;
  facing: CameraType;
}) {
  const { closeOverlay } = useNav();
  return (
    <View style={styles.center}>
      <Text style={styles.err}>
        Le live caméra tourne sur l’app iPhone (build natif), pas dans le navigateur.
      </Text>
      <Text style={styles.sub}>{title}</Text>
      <Press onPress={closeOverlay} style={styles.btn}>
        <Text style={styles.btnTxt}>Fermer</Text>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#05060a",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  err: { color: "#fff", textAlign: "center", fontWeight: "700", lineHeight: 22 },
  sub: { color: "rgba(255,255,255,0.7)", textAlign: "center" },
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
