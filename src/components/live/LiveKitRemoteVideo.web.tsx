import { StyleSheet, Text, View } from "react-native";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

/** Stub web : pas de WebRTC LiveKit dans le navigateur. */
export function LiveKitRemoteVideo(_props: {
  roomName: string;
  identity: string;
  displayName: string;
  battleActive?: boolean;
  hostFighter?: { displayName: string; avatarUrl?: string | null } | null;
  guestFighter?: { displayName: string; avatarUrl?: string | null } | null;
  liveEnded?: boolean;
}) {
  return (
    <View style={[FILL, styles.center]}>
      <Text style={styles.txt}>Le flux live s’affiche dans l’app iPhone.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", backgroundColor: "#111" },
  txt: { color: "rgba(255,255,255,0.75)", textAlign: "center", paddingHorizontal: 24 },
});
