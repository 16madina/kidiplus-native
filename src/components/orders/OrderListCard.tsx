import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { SurfaceCard } from "../SurfaceCard";
import { useAppTheme } from "../../context/theme";
import type { MockOrder } from "../../mock/account";
import { GOLD } from "../../theme";

const STATUS_COLOR: Record<MockOrder["status"], string> = {
  awaitingPayment: "#C0392B",
  paid: GOLD,
  shipped: "#2E6BFF",
  delivered: "#1B7A3A",
  failed: "#C0392B",
  cancelled: "#6B7289",
  refunded: "#8B5CF6",
};

export function OrderListCard({
  name,
  image,
  party,
  price,
  when,
  statusLabel,
  status,
  onPress,
  children,
}: {
  name: string;
  image: string;
  party: string;
  price: string;
  when: string;
  statusLabel: string;
  status: MockOrder["status"];
  onPress: () => void;
  children?: ReactNode;
}) {
  const { colors } = useAppTheme();
  const tone = STATUS_COLOR[status];

  return (
    <SurfaceCard padded={false} onPress={onPress} style={styles.wrap}>
      <View style={styles.row}>
        {image ? (
          <Image source={{ uri: image }} style={styles.img} contentFit="cover" />
        ) : (
          <View style={styles.img} />
        )}
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>
              {name || "—"}
            </Text>
            <View style={[styles.badge, { backgroundColor: `${tone}22` }]}>
              <Text style={[styles.badgeTxt, { color: tone }]}>{statusLabel}</Text>
            </View>
          </View>
          {party ? (
            <Text numberOfLines={1} style={[styles.party, { color: colors.mutedForeground }]}>
              {party}
            </Text>
          ) : null}
          <View style={styles.meta}>
            <Text style={styles.price}>{price}</Text>
            {when ? (
              <Text numberOfLines={1} style={[styles.when, { color: colors.mutedForeground }]}>
                {when}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch", width: "100%" },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
  },
  img: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#E8EAF1",
    flexShrink: 0,
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontWeight: "800",
    fontSize: 15,
    lineHeight: 19,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  badgeTxt: { fontWeight: "800", fontSize: 10 },
  party: { fontSize: 12 },
  meta: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 2,
    flexWrap: "wrap",
  },
  price: { color: GOLD, fontWeight: "800", fontSize: 14 },
  when: { fontSize: 11 },
  actions: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
});
