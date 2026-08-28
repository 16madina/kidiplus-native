import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Compass, Heart, Home, MessageCircle, MoreVertical, Plus, Share2, Store } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { Press } from "../components/Press";
import { Glass, GlassIcon, GlassIconButton } from "../components/Glass";
import { CreateVitrinePostSheet } from "../components/vitrine/CreateVitrinePostSheet";
import { VitrineCommentsSheet } from "../components/vitrine/VitrineCommentsSheet";
import {
  VitrineLiveSlide,
  VitrineSoonSlide,
} from "../components/vitrine/VitrineLiveSlides";
import { ReportSheet } from "../components/moderation/ReportSheet";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import { GOLD, LIVE_RED, initials } from "../theme";
import { useLivesFeed } from "../hooks/useLivesFeed";
import { useLayout } from "../lib/layout";
import {
  fetchVitrinePostById,
  fetchVitrinePosts,
  looksLikeVideo,
  toggleVitrineLike,
  type VitrineFeedPost,
} from "../lib/vitrine";
import { blockUserAndNotify, useBlockedIds } from "../lib/moderation";
import { isHttpUrl } from "../lib/storage";
import { unlockVitrineSound, useVitrineSound } from "../lib/vitrine-sound";
import { sampleLivesForCategory } from "../mock/home-categories";
import type { LiveStream } from "../mock/lives";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

export function VitrineScreen() {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const { t } = useTranslation();
  const {
    tab,
    setTab,
    openList,
    openOverlay,
    pendingVitrinePostId,
    setPendingVitrinePostId,
  } = useNav();
  const { guestMode, openAuth } = useAuth();
  const { active, upcoming } = useLivesFeed();
  const blockedIds = useBlockedIds();
  const [cat, setCat] = useState<"forYou" | "live" | "soon">("forYou");
  const [posts, setPosts] = useState<VitrineFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeLiveId, setActiveLiveId] = useState<string | null>(null);
  const [activeSoonId, setActiveSoonId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const listRef = useRef<FlatList<VitrineFeedPost>>(null);
  const liveListRef = useRef<FlatList<LiveStream>>(null);
  const soonListRef = useRef<FlatList<LiveStream>>(null);
  const lives = useMemo(
    () => active.filter((s) => !s.sellerId || !blockedIds.has(s.sellerId)),
    [active, blockedIds],
  );
  const soon = useMemo(
    () => upcoming.filter((s) => !s.sellerId || !blockedIds.has(s.sellerId)),
    [upcoming, blockedIds],
  );
  const visiblePosts = useMemo(
    () => posts.filter((p) => !p.userId || !blockedIds.has(p.userId)),
    [posts, blockedIds],
  );
  const liveBySeller = useMemo(() => {
    const map = new Map<string, (typeof lives)[number]>();
    for (const s of lives) {
      if (s.sellerId) map.set(s.sellerId, s);
    }
    return map;
  }, [lives]);
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

  useEffect(() => {
    if (!pendingVitrinePostId || !tabVisible) return;
    let cancelled = false;
    void (async () => {
      setCat("forYou");
      let idx = posts.findIndex((p) => p.id === pendingVitrinePostId);
      if (idx < 0) {
        const targeted = await fetchVitrinePostById(pendingVitrinePostId);
        if (cancelled) return;
        if (targeted) {
          setPosts((prev) => {
            if (prev.some((p) => p.id === targeted.id)) return prev;
            return [targeted, ...prev];
          });
          idx = 0;
        }
      }
      if (idx >= 0) {
        setActiveId(pendingVitrinePostId);
        requestAnimationFrame(() => {
          try {
            listRef.current?.scrollToIndex({ index: Math.max(0, idx), animated: true });
          } catch {
            /* ignore */
          }
        });
      }
      setPendingVitrinePostId(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingVitrinePostId, tabVisible, posts, setPendingVitrinePostId]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable)?.item as VitrineFeedPost | undefined;
    if (first?.id) setActiveId(first.id);
  }).current;

  const onLiveViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable)?.item as LiveStream | undefined;
    if (first?.id) setActiveLiveId(first.id);
  }).current;

  const onSoonViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable)?.item as LiveStream | undefined;
    if (first?.id) setActiveSoonId(first.id);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 45, minimumViewTime: 40 }).current;

  useEffect(() => {
    if (liveCards[0] && !activeLiveId) setActiveLiveId(liveCards[0].id);
  }, [liveCards, activeLiveId]);

  useEffect(() => {
    if (soon[0] && !activeSoonId) setActiveSoonId(soon[0].id);
  }, [soon, activeSoonId]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={["rgba(0,0,0,0.55)", "transparent"]} style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <GlassIconButton size={layout.icon} tone="dark" onPress={() => setTab("home")}>
          <Home size={20} color="#fff" />
        </GlassIconButton>
        <Glass tone="dark" intensity={40} radius={999} elevated={false} style={{ flex: 1, marginHorizontal: layout.narrow ? 4 : 8 }}>
          <View style={[styles.cats, layout.narrow && { gap: 4, paddingHorizontal: 4 }]}>
            {([
              ["forYou", "vitrine.tabs.forYou"],
              ["live", "vitrine.tabs.live"],
              ["soon", "vitrine.tabs.soon"],
            ] as const).map(([k, label]) => (
              <Press key={k} onPress={() => setCat(k)} style={styles.catBtn}>
                <Text
                  style={[
                    styles.catLabel,
                    { fontSize: layout.narrow ? 12 : 15 },
                    cat === k && styles.catActive,
                  ]}
                  numberOfLines={1}
                >
                  {t(label)}
                </Text>
                {cat === k ? <View style={styles.underline} /> : null}
              </Press>
            ))}
          </View>
        </Glass>
        <GlassIconButton
          size={layout.icon}
          tone="gold"
          onPress={() => {
            if (guestMode) return openAuth();
            setCreateOpen(true);
          }}
        >
          <Plus size={22} color="#fff" />
        </GlassIconButton>
      </LinearGradient>

      {cat === "forYou" ? (
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={GOLD} />
          </View>
        ) : visiblePosts.length === 0 ? (
          <View style={{ flex: 1, paddingTop: insets.top + 56 }}>
            <Empty onExplore={() => setTab("search")} labelKey="vitrine.emptyForYou" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={visiblePosts}
            keyExtractor={(p) => p.id}
            style={{ flex: 1 }}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={height}
            decelerationRate="fast"
            extraData={activeId}
            windowSize={2}
            maxToRenderPerBatch={1}
            initialNumToRender={1}
            removeClippedSubviews
            getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
            onScrollBeginDrag={unlockVitrineSound}
            onMomentumScrollBegin={unlockVitrineSound}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                listRef.current?.scrollToIndex({ index: info.index, animated: true });
              }, 120);
            }}
            refreshControl={
              <RefreshControl refreshing={refreshing} tintColor={GOLD} onRefresh={() => {
                setRefreshing(true);
                void load(true);
              }} />
            }
            renderItem={({ item }) => {
              const sellerLive = item.userId ? liveBySeller.get(item.userId) : undefined;
              return (
              <VitrinePostSlide
                post={item}
                width={width}
                height={height}
                active={tabVisible && cat === "forYou" && item.id === activeId}
                onAuth={openAuth}
                guest={guestMode}
                sellerLive={sellerLive ?? null}
                onAvatar={() => {
                  if (guestMode) return openAuth();
                  if (sellerLive) {
                    const idx = lives.findIndex((s) => s.id === sellerLive.id);
                    if (idx >= 0) openList(lives, idx);
                    return;
                  }
                  if (!item.userId) return;
                  openOverlay({ kind: "shop", sellerId: item.userId, sellerName: item.sellerName });
                }}
                onShop={() => {
                  if (guestMode) return openAuth();
                  if (!item.userId) return;
                  openOverlay({ kind: "shop", sellerId: item.userId, sellerName: item.sellerName });
                }}
                onComments={() => {
                  if (guestMode) return openAuth();
                  setCommentsPostId(item.id);
                }}
                onLikeChange={(liked, likes) => {
                  setPosts((prev) =>
                    prev.map((p) => (p.id === item.id ? { ...p, likedByMe: liked, likes } : p)),
                  );
                }}
                onBlocked={() => {
                  if (!item.userId) return;
                  setPosts((prev) => prev.filter((p) => p.userId !== item.userId));
                }}
              />
              );
            }}
          />
        )
      ) : null}

      {cat === "live" ? (
        liveCards.length === 0 ? (
          <View style={{ flex: 1, paddingTop: insets.top + 56 }}>
            <Empty onExplore={() => setTab("search")} labelKey="vitrine.emptyLive" />
          </View>
        ) : (
          <FlatList
            ref={liveListRef}
            data={liveCards}
            keyExtractor={(s) => s.id}
            style={{ flex: 1 }}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={height}
            decelerationRate="fast"
            extraData={activeLiveId}
            windowSize={2}
            maxToRenderPerBatch={1}
            initialNumToRender={1}
            removeClippedSubviews
            getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
            onViewableItemsChanged={onLiveViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item, index }) => (
              <VitrineLiveSlide
                stream={item}
                width={width}
                height={height}
                onJoin={() => openList(liveCards, index)}
              />
            )}
          />
        )
      ) : null}

      {cat === "soon" ? (
        soon.length === 0 ? (
          <View style={{ flex: 1, paddingTop: insets.top + 56 }}>
            <Empty onExplore={() => setTab("search")} labelKey="vitrine.emptySoon" />
          </View>
        ) : (
          <FlatList
            ref={soonListRef}
            data={soon}
            keyExtractor={(s) => s.id}
            style={{ flex: 1 }}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={height}
            decelerationRate="fast"
            extraData={activeSoonId}
            windowSize={2}
            maxToRenderPerBatch={1}
            initialNumToRender={1}
            removeClippedSubviews
            getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
            onViewableItemsChanged={onSoonViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item }) => (
              <VitrineSoonSlide stream={item} width={width} height={height} />
            )}
          />
        )
      ) : null}

      <CreateVitrinePostSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load(true)}
      />
      {commentsPostId ? (
        <VitrineCommentsSheet
          postId={commentsPostId}
          open={!!commentsPostId}
          onClose={() => setCommentsPostId(null)}
          onCountChange={(n) => {
            setPosts((prev) =>
              prev.map((p) => (p.id === commentsPostId ? { ...p, comments: n } : p)),
            );
          }}
        />
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
  onAvatar,
  onComments,
  onLikeChange,
  onBlocked,
  sellerLive,
}: {
  post: VitrineFeedPost;
  width: number;
  height: number;
  active: boolean;
  guest: boolean;
  onAuth: () => void;
  onShop: () => void;
  onAvatar: () => void;
  onComments: () => void;
  onLikeChange: (liked: boolean, likes: number) => void;
  onBlocked?: () => void;
  sellerLive: { id: string } | null;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likes);
  const [comments, setComments] = useState(post.comments);
  const [reportOpen, setReportOpen] = useState(false);
  const busyLike = useRef(false);
  const isLive = !!sellerLive;

  useEffect(() => {
    setLiked(post.likedByMe);
    setLikes(post.likes);
    setComments(post.comments);
  }, [post.id, post.likedByMe, post.likes, post.comments]);

  const onLike = async () => {
    if (guest) return onAuth();
    if (busyLike.current) return;
    busyLike.current = true;
    const prevLiked = liked;
    const prevLikes = likes;
    const nextLiked = !prevLiked;
    const nextLikes = prevLikes + (prevLiked ? -1 : 1);
    setLiked(nextLiked);
    setLikes(nextLikes);
    onLikeChange(nextLiked, nextLikes);
    const res = await toggleVitrineLike(post.id, prevLiked);
    busyLike.current = false;
    if (!res.ok) {
      setLiked(prevLiked);
      setLikes(prevLikes);
      onLikeChange(prevLiked, prevLikes);
    }
  };

  const openModeration = () => {
    if (guest) return onAuth();
    if (!post.userId) return;
    Alert.alert(`@${post.handle}`, undefined, [
      {
        text: t("report.action"),
        onPress: () => setReportOpen(true),
      },
      {
        text: t("block.action"),
        style: "destructive",
        onPress: () => {
          Alert.alert(t("block.action"), t("block.confirm"), [
            { text: t("block.cancel"), style: "cancel" },
            {
              text: t("block.action"),
              style: "destructive",
              onPress: () => {
                void blockUserAndNotify(post.userId!, {
                  handle: post.handle,
                  displayName: post.sellerName,
                  avatarUrl: post.avatarUrl,
                }).then((r) => {
                  if (r.ok) onBlocked?.();
                  else Alert.alert("KiDi+", r.error ?? t("block.failed"));
                });
              },
            },
          ]);
        },
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  return (
    <View style={{ width, height, backgroundColor: "#000" }}>
      <VitrineMedia post={post} active={active} />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.65)"]} style={styles.bottomGrad} pointerEvents="none" />
      <View
        pointerEvents="box-none"
        style={[styles.side, { bottom: insets.bottom + 28, gap: layout.compact ? 8 : 12 }]}
      >
        <Press onPress={onAvatar} style={styles.avatarAction} hitSlop={6}>
          <View style={[styles.avatarRing, isLive ? styles.avatarRingLive : styles.avatarRingGold]}>
            {isHttpUrl(post.avatarUrl) ? (
              <Image source={{ uri: post.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatarImg, styles.avFallback]}>
                <Text style={styles.avInitials}>{initials(post.sellerName)}</Text>
              </View>
            )}
          </View>
          {isLive ? (
            <View style={styles.liveChip}>
              <Text style={styles.liveChipTxt}>LIVE</Text>
            </View>
          ) : null}
        </Press>
        <Action
          icon={<Heart size={26} color={liked ? LIVE_RED : "#fff"} fill={liked ? LIVE_RED : "none"} />}
          label={String(likes)}
          onPress={() => void onLike()}
        />
        <Action
          icon={<MessageCircle size={26} color="#fff" />}
          label={String(comments)}
          onPress={onComments}
        />
        <Action icon={<Share2 size={26} color="#fff" />} label={t("vitrine.share")} />
        <Action icon={<Store size={26} color="#fff" />} label={t("vitrine.shop")} onPress={onShop} />
        <Action
          icon={<MoreVertical size={26} color="#fff" />}
          label=" "
          onPress={openModeration}
        />
      </View>
      <View pointerEvents="box-none" style={[styles.meta, { bottom: insets.bottom + 28 }]}>
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
      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="user"
        targetId={post.userId || ""}
        defaultNote={`Vitrine post: ${post.id}`}
      />
    </View>
  );
}

function VitrineMedia({ post, active }: { post: VitrineFeedPost; active: boolean }) {
  const first = post.mediaUrls[0];
  if (!first) return <View style={[FILL, { backgroundColor: "#111" }]} />;
  const video = looksLikeVideo(first, post.mediaType);
  if (video) {
    if (!active) {
      if (post.posterUrl) return <Image source={{ uri: post.posterUrl }} style={FILL} contentFit="cover" />;
      return <View style={[FILL, { backgroundColor: "#111" }]} />;
    }
    return <VitrineVideo uri={first} poster={post.posterUrl} active={active} />;
  }
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
    p.audioMixingMode = "doNotMix";
  });
  const [muted] = useVitrineSound();
  const [userPaused, setUserPaused] = useState(false);

  // Reset pause when the slide becomes active again / changes.
  useEffect(() => {
    if (active) setUserPaused(false);
  }, [active, uri]);

  useEffect(() => {
    try {
      if (!active || userPaused) {
        player.muted = true;
        player.volume = 0;
        player.pause();
        return;
      }
      player.volume = muted ? 0 : 1;
      player.muted = muted;
      void player.play();
    } catch {
      /* player already released */
    }
  }, [active, muted, userPaused, player]);

  useEffect(() => {
    return () => {
      try {
        player.muted = true;
        player.volume = 0;
        player.pause();
      } catch {
        /* unmount */
      }
    };
  }, [player]);

  const onTapVideo = () => {
    // First tap also unlocks sound (TikTok-style user gesture).
    unlockVitrineSound();
    setUserPaused((p) => !p);
  };

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
      <Press
        onPress={onTapVideo}
        haptic="none"
        style={[FILL, { minHeight: 0, minWidth: 0 }]}
        accessibilityRole="button"
        accessibilityLabel={userPaused ? "Play" : "Pause"}
      />
      {userPaused ? (
        <View pointerEvents="none" style={styles.pauseBadge}>
          <Text style={styles.pauseTxt}>❚❚</Text>
        </View>
      ) : null}
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
  side: { position: "absolute", right: 10, alignItems: "center", gap: 12, zIndex: 12 },
  avatarAction: {
    minHeight: 0,
    minWidth: 0,
    alignItems: "center",
    marginBottom: 2,
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarRingGold: {
    borderWidth: 2,
    borderColor: GOLD,
    backgroundColor: GOLD,
  },
  avatarRingLive: {
    borderWidth: 2.5,
    borderColor: LIVE_RED,
    backgroundColor: LIVE_RED,
  },
  avatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#111",
  },
  liveChip: {
    marginTop: -8,
    backgroundColor: LIVE_RED,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: "#000",
  },
  liveChipTxt: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  action: { minHeight: 0, minWidth: 0, alignItems: "center" },
  actionLabel: { color: "#fff", fontSize: 11, fontWeight: "700", marginTop: 2 },
  meta: { position: "absolute", left: 16, right: 80, zIndex: 11 },
  pauseBadge: {
    ...FILL,
    alignItems: "center",
    justifyContent: "center",
  },
  pauseTxt: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 42,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  av: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: GOLD },
  avFallback: { backgroundColor: "rgba(232,185,59,0.28)", alignItems: "center", justifyContent: "center" },
  avInitials: { color: "#fff", fontSize: 11, fontWeight: "800" },
  seller: { color: "#fff", fontWeight: "800", fontSize: 15 },
  caption: { color: "rgba(255,255,255,0.92)", marginTop: 8, fontSize: 14 },
});
