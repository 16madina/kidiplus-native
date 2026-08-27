import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { CalendarClock, Clock, Eye } from "lucide-react-native";
import { Press } from "./Press";
import { Glass } from "./Glass";
import { formatMin, formatViewers, initials, LIVE_RED, NAVY } from "../theme";
import type { LiveStream } from "../mock/lives";

export function LiveCard({
  stream,
  onPress,
}: {
  stream: LiveStream;
  onPress?: (s: LiveStream) => void;
}) {
  const sellerInitials = initials(stream.seller);
  return (
    <Press onPress={() => onPress?.(stream)} style={styles.press} haptic="light">
      <View style={styles.card}>
        <Image source={{ uri: stream.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={["rgba(8,12,26,0)", "rgba(8,12,26,0.18)", "rgba(8,12,26,0.78)"]}
          style={styles.bottomFade}
        />
        <View style={styles.badges}>
          {stream.scheduled ? (
            <Glass tone="dark" intensity={28} radius={8}>
              <View style={styles.badgeInner}>
                <CalendarClock size={11} color="#fff" strokeWidth={2.6} />
                <Text style={styles.badgeText}>Programmé</Text>
              </View>
            </Glass>
          ) : stream.fictitious ? (
            <>
              <Glass tone="dark" intensity={28} radius={8}>
                <View style={styles.badgeInner}>
                  <Text style={styles.badgeText}>Démo</Text>
                </View>
              </Glass>
              <Glass tone="dark" intensity={28} radius={8}>
                <View style={styles.badgeInner}>
                  <Eye size={11} color="#fff" strokeWidth={2.4} />
                  <Text style={styles.badgeText}>{formatViewers(stream.viewers)}</Text>
                </View>
              </Glass>
            </>
          ) : (
            <>
              <View style={[styles.liveBadge, { backgroundColor: LIVE_RED }]}>
                <View style={styles.pulse} />
                <Text style={styles.badgeText}>Live</Text>
              </View>
              <Glass tone="dark" intensity={28} radius={8}>
                <View style={styles.badgeInner}>
                  <Eye size={11} color="#fff" strokeWidth={2.4} />
                  <Text style={styles.badgeText}>{formatViewers(stream.viewers)}</Text>
                </View>
              </Glass>
            </>
          )}
          {((stream.scheduled && stream.startsInMin) || stream.endsInMin) ? (
            <View style={{ marginLeft: "auto" }}>
              <Glass tone="dark" intensity={28} radius={8}>
                <View style={styles.badgeInner}>
                  <Clock size={11} color="#fff" strokeWidth={2.4} />
                  <Text style={styles.badgeText}>
                    {stream.scheduled ? formatMin(stream.startsInMin!) : formatMin(stream.endsInMin!)}
                  </Text>
                </View>
              </Glass>
            </View>
          ) : null}
        </View>
        <View style={styles.bottom}>
          <View style={styles.sellerRow}>
            {stream.avatar ? (
              <Image source={{ uri: stream.avatar }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.initials}>{sellerInitials}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.seller}>
                {stream.seller}
              </Text>
              <Text numberOfLines={2} style={styles.title}>
                {stream.title}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Press>
  );
}

export function LiveCardSkeleton() {
  return <View style={[styles.card, { backgroundColor: "#E8EAF1" }]} />;
}

const styles = StyleSheet.create({
  press: { flex: 1, minHeight: 0, minWidth: 0, alignItems: "stretch" },
  card: {
    aspectRatio: 3 / 4,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#E8EAF1",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.38)",
  },
  bottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
  },
  badges: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 2,
  },
  badgeInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  pulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    paddingTop: 40,
  },
  sellerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: NAVY,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  initials: { color: "#fff", fontSize: 10, fontWeight: "800" },
  seller: { color: "#fff", fontSize: 13, fontWeight: "700" },
  title: { color: "rgba(255,255,255,0.88)", fontSize: 12, marginTop: 1 },
});
