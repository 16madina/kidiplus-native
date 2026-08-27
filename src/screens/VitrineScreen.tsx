import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Compass, Heart, Home, MessageCircle, Plus, Share2, Store, Volume2, VolumeX } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { Press } from "../components/Press";
import { Glass, GlassIcon, GlassIconButton } from "../components/Glass";
import { LiveCard } from "../components/LiveCard";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import { GOLD, LIVE_RED, initials } from "../theme";
import { useLivesFeed } from "../hooks/useLivesFeed";
import { fetchVitrinePosts, looksLikeVideo, type VitrineFeedPost } from "../lib/vitrine";
import { isHttpUrl } from "../lib/storage";
import { unlockVitrineSound, useVitrineSound } from "../lib/vitrine-sound";
import { sampleLivesForCategory } from "../mock/home-categories";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

export function VitrineScreen() {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { tab, setTab, openList, openOverlay } = useNav();
  const { guestMode, openAuth } = useAuth();
  const { active, upcoming } = useLivesFeed();
  const [cat, setCat] = useState<"forYou" | "live" | "soon">("forYou");
  const [posts, setPosts] = useState<VitrineFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const lives = active;
  const soon = upcoming;
  const liveCards = useMemo(() => {
    const samples = sampleLivesForCategory("Pour toi", lives.length);
    return [...lives, ...samples];
  }, [lives]);
  const tabVisible = tab === "vitrine";

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true);
    const rows = await fetchVitrinePosts();
    setPosts(rows);
    setActiveId((prev) => {
      if (prev && rows.some((p) => p.id === prev)) return prev;
      return rows[0]?.id ?? null;
    });
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0]?.item as VitrineFeedPost | undefined;
    if (first?.id) setActiveId(first.id);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70, minimumViewTime: 80 }).current;

  return (
    <View style={styles.root}>
      <LinearGradient colors={["rgba(0,0,0,0.55)", "transparent"]} style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <GlassIconButton tone="dark" onPress={() => setTab("home")}>
          <Home size={20} color="#fff" />
        </GlassIconButton>
        <Glass tone="dark" intensity={40} radius={999} elevated={false} style={{ flex: 1, marginHorizontal: 8 }}>
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
        </Glass>
        <GlassIconButton tone="gold" onPress={() => (guestMode ? openAuth() : undefined)}>
          <Plus size={22} color="#fff" />
        </GlassIconButton>
      </LinearGradient>

      {cat === "forYou" ? (
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={GOLD} />
          </View>
        ) : posts.length === 0 ? (
          <View style={{ flex: 1, paddingTop: insets.top + 56 }}>
            <Empty onExplore={() => setTab("search")} labelKey="vitrine.emptyForYou" />
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(p) => p.id}
            style={{ flex: 1 }}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={height}
            decelerationRate="fast"
            windowSize={3}
            maxToRenderPerBatch={2}
            initialNumToRender={1}
            getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
            onScrollBeginDrag={unlockVitrineSound}
            onMomentumScrollBegin={unlockVitrineSound}
            viewabilityConfig={viewabilityConfig}
            refreshControl={
              <RefreshControl refreshing={refreshing} tintColor={GOLD} onRefresh={() => {
                setRefreshing(true);
                void load(true);
              }} />
            }
            renderItem={({ item }) => (
              <VitrinePostSlide
                post={item}
                width={width}
                height={height}
                active={tabVisible && cat === "forYou" && item.id === activeId}
                onAuth={openAuth}
                guest={guestMode}
                onShop={() => {
                  if (guestMode) return openAuth();
                  if (!item.userId) return;
                  openOverlay({ kind: "shop", sellerId: item.userId, sellerName: item.sellerName });
                }}
              />
            )}
          />
        )
      ) : null}

      {cat === "live" ? (
        <View style={{ flex: 1, paddingTop: insets.top + 56, paddingHorizontal: 8 }}>
          {liveCards.length === 0 ? (
            <Empty onExplore={() => setTab("search")} />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {liveCards.map((s, i) => (
                <View key={s.id} style={{ width: "48.5%" }}>
                  <LiveCard stream={s} onPress={() => openList(liveCards, i)} />
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {cat === "soon" ? (
        <View style={{ flex: 1, paddingTop: insets.top + 56, paddingHorizontal: 8 }}>
          {soon.length === 0 ? (
            <Empty onExplore={() => setTab("search")} labelKey="vitrine.emptySoon" />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {soon.map((s, i) => (
                <View key={s.id} style={{ width: "48.5%" }}>
                  <LiveCard stream={s} onPress={() => openList(soon, i)} />
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

function VitrinePostSlide({
  post,
  width,
  height,
  active,
  guest,
  onAuth,
  onShop,
}: {
  post: VitrineFeedPost;
  width: number;
  height: number;
  active: boolean;
  guest: boolean;
  onAuth: () => void;
  onShop: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likes);
  const [muted, toggleMuted] = useVitrineSound();
  return (
    <View style={{ width, height, backgroundColor: "#000" }} onTouchStart={unlockVitrineSound}>
      <VitrineMedia post={post} active={active} />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.65)"]} style={styles.bottomGrad} />
      <View style={[styles.side, { bottom: insets.bottom + 28 }]}>
        <Action
          icon={muted ? <VolumeX size={26} color="#fff" /> : <Volume2 size={26} color="#fff" />}
          label={muted ? t("vitrine.muted") : t("vitrine.sound")}
          onPress={() => {
            if (muted) unlockVitrineSound();
            else toggleMuted();
          }}
        />
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
        <Action icon={<Store size={26} color="#fff" />} label={t("vitrine.shop")} onPress={onShop} />
      </View>
      <View style={[styles.meta, { bottom: insets.bottom + 28 }]}>
        <Glass tone="dark" intensity={38} radius={16} padded>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {isHttpUrl(post.avatarUrl) ? (
              <Image source={{ uri: post.avatarUrl }} style={styles.av} />
            ) : (
              <View style={[styles.av, styles.avFallback]}>
                <Text style={styles.avInitials}>{initials(post.sellerName)}</Text>
              </View>
            )}
            <Text style={styles.seller}>@{post.handle}</Text>
          </View>
          {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
        </Glass>
      </View>
    </View>
  );
}

function VitrineMedia({ post, active }: { post: VitrineFeedPost; active: boolean }) {
  const first = post.mediaUrls[0];
  if (!first) return <View style={[FILL, { backgroundColor: "#111" }]} />;
  const video = looksLikeVideo(first, post.mediaType);
  if (video) return <VitrineVideo uri={first} poster={post.posterUrl} active={active} />;
  return <Image source={{ uri: first }} style={FILL} contentFit="cover" />;
}

function VitrineVideo({
  uri,
  poster,
  active,
}: {
  uri: string;
  poster: string | null;
  active: boolean;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });
  const [muted] = useVitrineSound();

  useEffect(() => {
    player.muted = muted;
    if (active) player.play();
    else player.pause();
  }, [active, muted, player]);

  return (
    <View style={FILL}>
      {poster ? <Image source={{ uri: poster }} style={FILL} contentFit="cover" /> : null}
      <VideoView
        player={player}
        style={FILL}
        contentFit="cover"
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
      />
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: ReactNode; label: string; onPress?: () => void }) {
  return (
    <Press onPress={onPress} style={styles.action}>
      <GlassIcon tone="dark" size={48}>
        {icon}
      </GlassIcon>
      <Text style={styles.actionLabel}>{label}</Text>
    </Press>
  );
}

function Empty({ onExplore, labelKey = "vitrine.emptyLive" }: { onExplore: () => void; labelKey?: string }) {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <Compass size={28} color={GOLD} />
      <Text style={{ color: "#fff" }}>{t(labelKey)}</Text>
      <Press onPress={onExplore} style={{ backgroundColor: GOLD, borderRadius: 999, height: 40, paddingHorizontal: 18 }}>
        <Text style={{ fontWeight: "800" }}>{t("vitrine.explore")}</Text>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  top: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
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
  avFallback: { backgroundColor: "rgba(232,185,59,0.28)", alignItems: "center", justifyContent: "center" },
  avInitials: { color: "#fff", fontSize: 11, fontWeight: "800" },
  seller: { color: "#fff", fontWeight: "800", fontSize: 15 },
  caption: { color: "rgba(255,255,255,0.92)", marginTop: 8, fontSize: 14 },
});
