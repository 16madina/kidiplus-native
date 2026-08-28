import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Heart, Store, Users } from "lucide-react-native";
import { OverlayHeader } from "../components/OverlayHeader";
import { Press } from "../components/Press";
import { SurfaceCard } from "../components/SurfaceCard";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { ReferredBadge } from "../components/ReferredBadge";
import { useAppTheme } from "../context/theme";
import { useNav } from "../context/navigation";
import { supabase } from "../lib/supabase";
import { isHttpUrl } from "../lib/storage";
import { GOLD, NAVY, initials } from "../theme";

type SellerProfile = {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
  is_referred: boolean;
  followers_count: number;
};

export function SellerProfileScreen({ sellerId }: { sellerId: string }) {
  const { colors } = useAppTheme();
  const { openOverlay } = useNav();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_url, bio, is_verified, is_referred, followers_count")
        .eq("id", sellerId)
        .single();
      if (alive && data) {
        setProfile(data as any);
      }
      setLoading(false);
    };
    void load();
    return () => { alive = false; };
  }, [sellerId]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OverlayHeader title="Profil vendeur" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={GOLD} />
        </View>
      ) : profile ? (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarRing}>
              {isHttpUrl(profile.avatar_url) ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.fallback]}>
                  <Text style={styles.avatarInitials}>{initials(profile.display_name)}</Text>
                </View>
              )}
            </View>
            <View style={styles.nameRow}>
              <Text style={[styles.displayName, { color: colors.foreground }]}>{profile.display_name}</Text>
              {profile.is_verified && <VerifiedBadge />}
              <ReferredBadge referred={profile.is_referred} size={16} />
            </View>
            <Text style={[styles.handle, { color: colors.mutedForeground }]}>@{profile.handle}</Text>
            {profile.bio ? (
              <Text style={[styles.bio, { color: colors.foreground }]}>{profile.bio}</Text>
            ) : null}
          </View>

          <SurfaceCard>
            <View style={styles.statRow}>
              <Users size={16} color={colors.mutedForeground} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {profile.followers_count}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>abonnés</Text>
            </View>
          </SurfaceCard>

          <Press
            onPress={() => openOverlay({ kind: "shop", sellerId: profile.id, sellerName: profile.display_name })}
            style={styles.shopBtn}
          >
            <Store size={16} color={NAVY} />
            <Text style={styles.shopBtnText}>Voir la boutique</Text>
          </Press>
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <Text style={{ color: colors.mutedForeground }}>Profil introuvable</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, gap: 16, paddingBottom: 48 },
  avatarSection: { alignItems: "center", paddingVertical: 8 },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: GOLD,
    padding: 3,
  },
  avatar: { flex: 1, borderRadius: 42, backgroundColor: NAVY },
  fallback: { alignItems: "center", justifyContent: "center" },
  avatarInitials: { color: "#fff", fontSize: 26, fontWeight: "900" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  displayName: { fontSize: 20, fontWeight: "800" },
  handle: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  bio: { fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 18 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  statValue: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 13 },
  shopBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: GOLD,
    flexDirection: "row",
    gap: 8,
  },
  shopBtnText: { color: NAVY, fontSize: 15, fontWeight: "800" },
});
