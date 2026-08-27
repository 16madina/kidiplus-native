import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { CalendarClock, Clock, Eye } from "lucide-react-native";
import { Press } from "./Press";
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
        <View style={styles.badges}>
          {stream.scheduled ? (
            <View style={[styles.badge, { backgroundColor: "#3D5A99" }]}>
              <CalendarClock size={11} color="#fff" strokeWidth={2.6} />
              <Text style={styles.badgeText}>Programmé</Text>
            </View>
          ) : stream.fictitious ? (
            <>
              <View style={[styles.badge, { backgroundColor: "#4A5878" }]}>
                <Text style={styles.badgeText}>Démo</Text>
              </View>
              <View style={styles.viewers}>
                <Eye size={11} color="#fff" strokeWidth={2.4} />
                <Text style={styles.badgeText}>{formatViewers(stream.viewers)}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.badge, { backgroundColor: LIVE_RED }]}>
                <View style={styles.pulse} />
                <Text style={styles.badgeText}>Live</Text>
              </View>
              <View style={styles.viewers}>
                <Eye size={11} color="#fff" strokeWidth={2.4} />
                <Text style={styles.badgeText}>{formatViewers(stream.viewers)}</Text>
              </View>
            </>
          )}
          {((stream.scheduled && stream.startsInMin) || stream.endsInMin) ? (
            <View style={[styles.viewers, { marginLeft: "auto" }]}>
              <Clock size={11} color="#fff" strokeWidth={2.4} />
              <Text style={styles.badgeText}>
                {stream.scheduled ? formatMin(stream.startsInMin!) : formatMin(stream.endsInMin!)}
              </Text>
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
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#E8EAF1",
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
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  viewers: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "rgba(0,0,0,0.45)",
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
    backgroundColor: "transparent",
  },
  sellerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: NAVY },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  initials: { color: "#fff", fontSize: 10, fontWeight: "800" },
  seller: { color: "#fff", fontSize: 13, fontWeight: "700" },
  title: { color: "rgba(255,255,255,0.88)", fontSize: 12, marginTop: 1 },
});
