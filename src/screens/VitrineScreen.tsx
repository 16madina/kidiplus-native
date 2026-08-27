import { useState } from "react";
import { Dimensions, FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Compass, Heart, Home, MessageCircle, Plus, Share2, Store } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Press } from "../components/Press";
import { LiveCard } from "../components/LiveCard";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import { GOLD, LIVE_RED } from "../theme";
import { makeStreams } from "../mock/lives";
import { mockStories, mockVitrinePosts, type VitrinePost } from "../mock/vitrine";
import { sampleLivesForCategory } from "../mock/home-categories";

const { height, width } = Dimensions.get("window");

export function VitrineScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { setTab, openList } = useNav();
  const { guestMode, openAuth } = useAuth();
  const [cat, setCat] = useState<"forYou" | "live" | "soon">("forYou");
  const [posts] = useState(mockVitrinePosts);
  const lives = [...sampleLivesForCategory("Pour toi", 0)];
  const soon = makeStreams(0, 16).filter((s) => s.scheduled);

  return (
    <View style={styles.root}>
      <LinearGradient colors={["rgba(0,0,0,0.55)", "transparent"]} style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <Press onPress={() => setTab("home")} style={styles.icon}>
          <Home size={22} color="#fff" />
        </Press>
        <View style={styles.cats}>
          {([
            ["forYou", "vitrine.tabs.forYou"],
            ["live", "vitrine.tabs.live"],
            ["soon", "vitrine.tabs.soon"],
          ] as const).map(([k, label]) => (
            <Press key={k} onPress={() => setCat(k)} style={styles.catBtn}>
              <Text style={[styles.catLabel, cat === k && styles.catActive]}>{t(label)}</Text>
              {cat === k ? <View style={styles.underline} /> : null}
            </Press>
          ))}
        </View>
        <Press onPress={() => (guestMode ? openAuth() : undefined)} style={styles.icon}>
          <Plus size={24} color="#fff" />
        </Press>
      </LinearGradient>

      {cat === "forYou" ? (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={height}
          decelerationRate="fast"
          renderItem={({ item }) => <VitrinePostSlide post={item} onAuth={openAuth} guest={guestMode} />}
        />
      ) : null}

      {cat === "live" ? (
        <View style={{ flex: 1, paddingTop: insets.top + 56, paddingHorizontal: 8 }}>
          {lives.length === 0 ? (
            <Empty onExplore={() => setTab("search")} />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {lives.map((s, i) => (
                <View key={s.id} style={{ width: "48.5%" }}>
                  <LiveCard stream={s} onPress={() => openList(lives, i)} />
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {cat === "soon" ? (
        <View style={{ flex: 1, paddingTop: insets.top + 56, paddingHorizontal: 8 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {soon.map((s, i) => (
              <View key={s.id} style={{ width: "48.5%" }}>
                <LiveCard stream={s} onPress={() => openList(soon, i)} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function VitrinePostSlide({
  post,
  guest,
  onAuth,
}: {
  post: VitrinePost;
  guest: boolean;
  onAuth: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes);
  return (
    <View style={{ width, height, backgroundColor: "#000" }}>
      <Image source={post.image} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.65)"]} style={styles.bottomGrad} />
      <View style={[styles.side, { bottom: insets.bottom + 28 }]}>
        <Action
          icon={<Heart size={26} color={liked ? LIVE_RED : "#fff"} fill={liked ? LIVE_RED : "none"} />}
          label={String(likes)}
          onPress={() => {
            if (guest) return onAuth();
            setLiked((v) => !v);
            setLikes((n) => n + (liked ? -1 : 1));
          }}
        />
        <Action icon={<MessageCircle size={26} color="#fff" />} label={String(post.comments)} onPress={() => guest && onAuth()} />
        <Action icon={<Share2 size={26} color="#fff" />} label={t("vitrine.share")} />
        <Action icon={<Store size={26} color="#fff" />} label={t("vitrine.shop")} onPress={() => guest && onAuth()} />
      </View>
      <View style={[styles.meta, { bottom: insets.bottom + 28 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Image source={{ uri: post.avatar }} style={styles.av} />
          <Text style={styles.seller}>@{post.handle}</Text>
        </View>
        <Text style={styles.caption}>{post.caption}</Text>
      </View>
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress?: () => void }) {
  return (
    <Press onPress={onPress} style={styles.action}>
      {icon}
      <Text style={styles.actionLabel}>{label}</Text>
    </Press>
  );
}

function Empty({ onExplore }: { onExplore: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <Compass size={28} color={GOLD} />
      <Text style={{ color: "#fff" }}>{t("vitrine.emptyLive")}</Text>
      <Press onPress={onExplore} style={{ backgroundColor: GOLD, borderRadius: 999, height: 40, paddingHorizontal: 18 }}>
        <Text style={{ fontWeight: "800" }}>{t("vitrine.explore")}</Text>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  top: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  icon: { width: 44, height: 44 },
  cats: { flex: 1, flexDirection: "row", justifyContent: "center", gap: 12 },
  catBtn: { minHeight: 36, minWidth: 0, paddingHorizontal: 4 },
  catLabel: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 15 },
  catActive: { color: "#fff" },
  underline: { height: 2, backgroundColor: GOLD, marginTop: 4, borderRadius: 1 },
  bottomGrad: { position: "absolute", left: 0, right: 0, bottom: 0, height: 220 },
  side: { position: "absolute", right: 10, alignItems: "center", gap: 14 },
  action: { minHeight: 0, minWidth: 0, alignItems: "center" },
  actionLabel: { color: "#fff", fontSize: 11, fontWeight: "700", marginTop: 2 },
  meta: { position: "absolute", left: 16, right: 80 },
  av: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: GOLD },
  seller: { color: "#fff", fontWeight: "800", fontSize: 15 },
  caption: { color: "rgba(255,255,255,0.92)", marginTop: 8, fontSize: 14 },
});
