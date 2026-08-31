import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  BookOpen,
  Gift,
  Radio,
  Truck,
} from "lucide-react-native";
import { OverlayHeader } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { SurfaceCard } from "../components/SurfaceCard";
import { useNav } from "../context/navigation";
import { useAppTheme } from "../context/theme";
import { AuctionGuideOverlay } from "../components/discover/AuctionGuideOverlay";
import { GOLD, NAVY } from "../theme";

const TUTORIALS = [
  {
    id: "sell-live",
    icon: Radio,
    title: "Comment vendre en live",
    subtitle: "Lance ton premier live et vends en direct à ta communauté.",
    overlay: { kind: "broadcast-setup" as const, mode: "now" as const },
  },
  {
    id: "bid",
    icon: BookOpen,
    title: "Comment enchérir",
    subtitle: "Participe aux enchères et remporte des articles uniques.",
    overlay: null,
  },
  {
    id: "referral",
    icon: Gift,
    title: "Programme de parrainage",
    subtitle: "Invite tes amis et gagne des récompenses.",
    overlay: { kind: "referral" as const },
  },
  {
    id: "delivery",
    icon: Truck,
    title: "Configurer la livraison",
    subtitle: "Paramètre tes zones et tarifs de livraison.",
    overlay: { kind: "delivery" as const },
  },
];

export function DiscoverScreen() {
  const { colors } = useAppTheme();
  const { openOverlay } = useNav();
  const [bidGuide, setBidGuide] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title="Découvrir" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.heading, { color: colors.foreground }]}>Tutoriels & guides</Text>
        {TUTORIALS.map((tut) => {
          const Icon = tut.icon;
          return (
            <Press
              key={tut.id}
              onPress={() => {
                if (tut.id === "bid") setBidGuide(true);
                else if (tut.overlay) openOverlay(tut.overlay as never);
              }}
              style={{ minHeight: 0 }}
            >
              <SurfaceCard>
                <View style={styles.card}>
                  <View style={styles.iconWrap}>
                    <Icon size={20} color={GOLD} />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{tut.title}</Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{tut.subtitle}</Text>
                  </View>
                </View>
              </SurfaceCard>
            </Press>
          );
        })}
      </ScrollView>
      <AuctionGuideOverlay open={bidGuide} onClose={() => setBidGuide(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 12, paddingBottom: 48 },
  heading: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  card: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(232,185,59,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  cardSub: { fontSize: 12, marginTop: 2 },
});
