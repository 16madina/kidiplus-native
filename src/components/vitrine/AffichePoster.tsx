import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { AfficheCanvas } from "./AfficheCanvas";
import type { VitrineAffiche } from "../../lib/vitrine-affiche";
import { GOLD, initials, NAVY } from "../../theme";
import { isHttpUrl } from "../../lib/storage";

export function AffichePoster({ affiche }: { affiche: VitrineAffiche }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ width, height, backgroundColor: "#05060a" }}>
      <AfficheCanvas layout={affiche.layout} width={width} height={height} />
      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "transparent", "rgba(0,0,0,0.7)"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[styles.top, { paddingTop: insets.top + 56 }]}>
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>AFFICHE</Text>
        </View>
        {isHttpUrl(affiche.avatarUrl) ? (
          <Image source={{ uri: affiche.avatarUrl }} style={styles.av} />
        ) : (
          <View style={[styles.av, styles.avFallback]}>
            <Text style={styles.ini}>{initials(affiche.sellerName)}</Text>
          </View>
        )}
        <Text style={styles.name}>{affiche.sellerName}</Text>
        {affiche.handle ? <Text style={styles.handle}>@{affiche.handle}</Text> : null}
        <Text style={styles.title}>{affiche.title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", left: 16, right: 16, gap: 8 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: GOLD,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeTxt: { color: NAVY, fontWeight: "900", fontSize: 11, letterSpacing: 0.6 },
  av: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: GOLD },
  avFallback: { backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  ini: { color: "#fff", fontWeight: "800" },
  name: { color: "#fff", fontWeight: "800", fontSize: 16 },
  handle: { color: "rgba(255,255,255,0.7)", fontWeight: "600" },
  title: { color: "#fff", fontWeight: "700", fontSize: 20, marginTop: 8 },
});
