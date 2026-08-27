import { StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gavel, Heart, Send, X } from "lucide-react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Press } from "../components/Press";
import { useNav } from "../context/navigation";
import { GOLD, LIVE_RED, NAVY } from "../theme";
import { formatViewers } from "../theme";

export function LiveViewerScreen() {
  const insets = useSafeAreaInsets();
  const { overlay, closeOverlay } = useNav();
  if (overlay.kind !== "live") return null;
  const s = overlay.stream;
  return (
    <View style={styles.root}>
      <Image source={{ uri: s.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={["rgba(0,0,0,0.45)", "transparent", "rgba(0,0,0,0.75)"]} style={StyleSheet.absoluteFill} />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View style={styles.seller}>
          <Image source={{ uri: s.avatar }} style={styles.av} />
          <View>
            <Text style={styles.name}>{s.seller}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={styles.live}>
                <View style={styles.dot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Text style={styles.viewers}>{formatViewers(s.viewers)}</Text>
            </View>
          </View>
        </View>
        <Press onPress={closeOverlay} style={styles.close}>
          <X size={20} color="#fff" />
        </Press>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.product}>
          <Text style={styles.productEyebrow}>Enchère en cours</Text>
          <Text style={styles.productTitle}>{s.title}</Text>
          <Text style={styles.price}>24 €</Text>
        </View>
        <View style={styles.chatRow}>
          <TextInput placeholder="Écris un message…" placeholderTextColor="rgba(255,255,255,0.6)" style={styles.input} />
          <Press style={styles.iconBtn}>
            <Heart size={18} color="#fff" />
          </Press>
          <Press style={styles.iconBtn}>
            <Send size={18} color="#fff" />
          </Press>
        </View>
        <Press style={styles.bid}>
          <Gavel size={18} color={NAVY} />
          <Text style={styles.bidText}>Enchérir · 26 €</Text>
        </Press>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, backgroundColor: "#000", zIndex: 80 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  seller: { flexDirection: "row", alignItems: "center", gap: 8 },
  av: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: GOLD },
  name: { color: "#fff", fontWeight: "800" },
  live: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: LIVE_RED, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  liveText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  viewers: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700" },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)" },
  bottom: { position: "absolute", left: 12, right: 12, bottom: 0, gap: 10 },
  product: { backgroundColor: "rgba(16,22,43,0.72)", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "rgba(232,185,59,0.35)" },
  productEyebrow: { color: GOLD, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  productTitle: { color: "#fff", fontWeight: "700", marginTop: 4 },
  price: { color: GOLD, fontSize: 20, fontWeight: "900", marginTop: 4 },
  chatRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, height: 44, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.45)", color: "#fff", paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.45)" },
  bid: { height: 48, borderRadius: 999, backgroundColor: GOLD, flexDirection: "row", gap: 8 },
  bidText: { color: NAVY, fontWeight: "900", fontSize: 16 },
});
