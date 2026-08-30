import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
const PublishHub = lazy(() =>
  import("../components/vitrine/PublishHub").then((m) => ({ default: m.PublishHub })),
);
import { AffichePoster } from "../components/vitrine/AffichePoster";
import { VitrineCommentsSheet, shareVitrinePost } from "../components/vitrine/VitrineCommentsSheet";
import { StoriesRow } from "../components/vitrine/StoriesRow";
import { StoryViewer } from "../components/vitrine/StoryViewer";
import { VitrineLiveSlide } from "../components/vitrine/VitrineLiveSlides";
import { ScheduledLivePoster } from "../components/ScheduledLivePoster";
import { mergeUpcomingWithDemos } from "../mock/upcoming-demos";
import { ReportSheet } from "../components/moderation/ReportSheet";
import { useAuth } from "../context/auth";
import { useNav } from "../context/navigation";
import { GOLD, LIVE_RED, initials } from "../theme";
import { useLivesFeed } from "../hooks/useLivesFeed";
import { useLayout } from "../lib/layout";
import {
  deleteVitrinePost,
  fetchVitrinePostById,
  fetchVitrinePosts,
  looksLikeVideo,
  toggleVitrineLike,
  type VitrineFeedPost,
} from "../lib/vitrine";
import {
  fetchVitrineStories,
  filterBlockedStories,
  storiesHiddenByFeedIndex,
  type VitrineStory,
} from "../lib/vitrine-stories";
import { fetchVitrineAffiches, parseAfficheCaption, type VitrineAffiche } from "../lib/vitrine-affiche";
import type { PublishHubMode } from "../lib/publish-hub";
import { blockUserAndNotify, useBlockedIds } from "../lib/moderation";
import { encodeContentReportNote } from "../lib/admin-takedown-logic";
import { isHttpUrl } from "../lib/storage";
import { unlockVitrineSound, useVitrineSound } from "../lib/vitrine-sound";
import { sampleLivesForCategory } from "../mock/home-categories";
import type { LiveStream } from "../mock/lives";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

type SoonFeedItem =
  | { kind: "live"; id: string; stream: LiveStream }
  | { kind: "affiche"; id: string; affiche: VitrineAffiche };

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
  const [hasMore, setHasMore] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeLiveId, setActiveLiveId] = useState<string | null>(null);
  const [activeSoonId, setActiveSoonId] = useState<string | null>(null);
  const [hubOpen, setHubOpen] = useState(false);
  const [hubMode, setHubMode] = useState<PublishHubMode>("video");
  const [affiches, setAffiches] = useState<VitrineAffiche[]>([]);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyList, setStoryList] = useState<VitrineStory[]>([]);
  const [storyIndex, setStoryIndex] = useState(0);
  const [stories, setStories] = useState<VitrineStory[]>([]);
  const [storiesOpen, setStoriesOpen] = useState(true);
  const listRef = useRef<FlatList<VitrineFeedPost>>(null);
  const liveListRef = useRef<FlatList<LiveStream>>(null);
  const soonListRef = useRef<FlatList<SoonFeedItem>>(null);
  const lives = useMemo(
    () => active.filter((s) => !s.sellerId || !blockedIds.has(s.sellerId)),
    [active, blockedIds],
  );
  // Réels + démos, triés du plus proche au plus lointain (comme la Home).
  const soon = useMemo(
    () => mergeUpcomingWithDemos(upcoming.filter((s) => !s.sellerId || !blockedIds.has(s.sellerId))),
    [upcoming, blockedIds],
  );
  const visiblePosts = useMemo(
    () =>
      posts.filter(
        (p) =>
          !parseAfficheCaption(p.caption) && (!p.userId || !blockedIds.has(p.userId)),
      ),
    [posts, blockedIds],
  );

  const soonItems = useMemo<SoonFeedItem[]>(() => {
    const posters = affiches
      .filter((a) => !a.userId || !blockedIds.has(a.userId))
      .map((affiche) => ({ kind: "affiche" as const, id: affiche.id, affiche }));
    const livesSoon = soon.map((stream) => ({ kind: "live" as const, id: stream.id, stream }));
    return [...posters, ...livesSoon];
  }, [affiches, soon, blockedIds]);
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
  const visibleStories = useMemo(
    () => filterBlockedStories(stories, blockedIds),
    [stories, blockedIds],
  );

  const loadStories = useCallback(async () => {
    const rows = await fetchVitrineStories();
    setStories(rows);
  }, []);

  const loadAffiches = useCallback(async () => {
    setAffiches(await fetchVitrineAffiches(40));
  }, []);

  const PAGE = 12;
  const loadingMore = useRef(false);

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true);
    const rows = await fetchVitrinePosts(PAGE, 0);
    setPosts(rows);
    setHasMore(rows.length >= PAGE);
    setActiveId((prev) => {
      if (prev && rows.some((p) => p.id === prev)) return prev;
      return rows[0]?.id ?? null;
    });
    setLoading(false);
    setRefreshing(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore.current || loading) return;
    loadingMore.current = true;
    const rows = await fetchVitrinePosts(PAGE, posts.length);
    setPosts((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...rows.filter((r) => !seen.has(r.id))];
    });
    setHasMore(rows.length >= PAGE);
    loadingMore.current = false;
  }, [hasMore, loading, posts.length]);

  useEffect(() => {
    void load();
    void loadStories();
    void loadAffiches();
  }, [load, loadStories, loadAffiches]);

  useEffect(() => {
    if (cat === "forYou") {
      const idx = visiblePosts.findIndex((p) => p.id === activeId);
      if (storiesHiddenByFeedIndex(idx)) setStoriesOpen(false);
    } else if (cat === "live") {
      const idx = liveCards.findIndex((s) => s.id === activeLiveId);
      if (storiesHiddenByFeedIndex(idx)) setStoriesOpen(false);
    } else {
      const idx = soonItems.findIndex((s) => s.id === activeSoonId);
      if (storiesHiddenByFeedIndex(idx)) setStoriesOpen(false);
    }
  }, [cat, activeId, activeLiveId, activeSoonId, visiblePosts, liveCards, soonItems]);

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
    const first = viewableItems.find((v) => v.isViewable)?.item as SoonFeedItem | undefined;
    if (first?.id) setActiveSoonId(first.id);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 45, minimumViewTime: 40 }).current;

  useEffect(() => {
    if (liveCards[0] && !activeLiveId) setActiveLiveId(liveCards[0].id);
  }, [liveCards, activeLiveId]);

  useEffect(() => {
    if (soonItems[0] && !activeSoonId) setActiveSoonId(soonItems[0].id);
  }, [soonItems, activeSoonId]);

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
              <Press
                key={k}
                onPress={() => {
                  setCat(k);
                  setStoriesOpen(true);
                }}
                style={styles.catBtn}
              >
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
            setHubMode(cat === "soon" ? "affiche" : "video");
            setHubOpen(true);
          }}
        >
          <Plus size={22} color="#fff" />
        </GlassIconButton>
      </LinearGradient>

      {cat === "soon" ? null : storiesOpen ? (
        <View style={{ position: "absolute", top: insets.top + 52, left: 0, right: 0, zIndex: 10 }}>
          <StoriesRow
            stories={visibleStories}
            onAdd={() => {
              if (guestMode) return openAuth();
              setHubMode("story");
              setHubOpen(true);
            }}
            onPress={(list, idx) => {
              setStoryList(list);
              setStoryIndex(idx);
              setStoryViewerOpen(true);
            }}
          />
        </View>
      ) : (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: insets.top + 56, left: 0, right: 0, zIndex: 10 }}
        >
          <Text style={{ color: "rgba(255,255,255,0.45)", textAlign: "center", fontSize: 10, fontWeight: "600" }}>
            {t("vitrine.pullStories")}
          </Text>
        </View>
      )}

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
            onEndReached={() => void loadMore()}
            onEndReachedThreshold={0.6}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor={GOLD}
                onRefresh={() => {
                  setStoriesOpen(true);
                  setRefreshing(true);
                  void load(true);
                  void loadStories();
                }}
              />
            }
            onScroll={(e) => {
              if (e.nativeEvent.contentOffset.y < -28) setStoriesOpen(true);
            }}
            scrollEventThrottle={16}
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
                onDeleted={() => {
                  setPosts((prev) => prev.filter((p) => p.id !== item.id));
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
        soonItems.length === 0 ? (
          <View style={{ flex: 1, paddingTop: insets.top + 56 }}>
            <Empty onExplore={() => setTab("search")} labelKey="vitrine.emptySoon" />
          </View>
        ) : (
          <FlatList
            ref={soonListRef}
            data={soonItems}
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
              <View style={{ width, height }}>
                {item.kind === "affiche" ? (
                  <AffichePoster
                    affiche={item.affiche}
                    onDeleted={() => setAffiches((prev) => prev.filter((a) => a.id !== item.affiche.id))}
                    onBlocked={() => {
                      if (!item.affiche.userId) return;
                      const blocked = item.affiche.userId;
                      setAffiches((prev) => prev.filter((a) => a.userId !== blocked));
                    }}
                  />
                ) : (
                  <ScheduledLivePoster stream={item.stream} showClose={false} active={item.id === activeSoonId} />
                )}
              </View>
            )}
          />
        )
      ) : null}

      {hubOpen ? (
        <Suspense fallback={null}>
          <PublishHub
            open={hubOpen}
            initialMode={hubMode}
            onClose={() => setHubOpen(false)}
            onPublished={(m) => {
              setStoriesOpen(true);
              if (m === "story") void loadStories();
              else if (m === "affiche") {
                setCat("soon");
                void loadAffiches();
              } else void load(true);
            }}
          />
        </Suspense>
      ) : null}
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
      <StoryViewer
        stories={storyList}
        initialIndex={storyIndex}
        visible={storyViewerOpen}
        onClose={() => setStoryViewerOpen(false)}
      />
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
  onDeleted,
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
  onDeleted?: () => void;
  sellerLive: { id: string } | null;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const { user } = useAuth();
  const mine = !!user && !!post.userId && post.userId === user.id;
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likes);
  const [comments, setComments] = useState(post.comments);
  const [reportOpen, setReportOpen] = useState(false);
  const busyLike = useRef(false);
  const isLive = !!sellerLive;

  const sharePost = () => shareVitrinePost(post.id, post.caption);

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
    if (mine) {
      Alert.alert(t("vitrine.manageTitle"), t("vitrine.deleteOwnHint"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("vitrine.delete"),
          style: "destructive",
          onPress: () => {
            Alert.alert(t("vitrine.deleteConfirm"), t("vitrine.deleteOwnHint"), [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("vitrine.deleteConfirm"),
                style: "destructive",
                onPress: () => {
                  void deleteVitrinePost(post.id).then((ok) => {
                    if (ok) onDeleted?.();
                    else Alert.alert("KiDi+", t("vitrine.deleteFail"));
                  });
                },
              },
            ]);
          },
        },
      ]);
      return;
    }
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
        <Action icon={<Share2 size={26} color="#fff" />} label={t("vitrine.share")} onPress={() => void sharePost()} />
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
        defaultNote={encodeContentReportNote("vitrine_post", post.id, `Vitrine post: ${post.id}`)}
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
      if (post.posterUrl) return <VitrineStill uri={post.posterUrl} />;
      return <View style={[FILL, { backgroundColor: "#111" }]} />;
    }
    return <VitrineVideo uri={first} poster={post.posterUrl} active={active} clip={post.clip} />;
  }
  return <VitrineStill uri={first} />;
}

function VitrineStill({ uri }: { uri: string }) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setReady(false);
    setFailed(false);
    const id = setTimeout(() => setFailed(true), 8000);
    return () => clearTimeout(id);
  }, [uri]);

  if (failed && !ready) {
    return (
      <View style={[FILL, { backgroundColor: "#111", alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontWeight: "700" }}>{t("vitrine.mediaUnavailable")}</Text>
      </View>
    );
  }

  return (
    <View style={FILL}>
      {!ready ? (
        <View style={[FILL, { alignItems: "center", justifyContent: "center" }]}>
          <ActivityIndicator color={GOLD} />
        </View>
      ) : null}
      <Image
        source={{ uri }}
        style={FILL}
        contentFit="cover"
        onLoad={() => setReady(true)}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

function VitrineVideo({
  uri,
  poster,
  active,
  clip,
}: {
  uri: string;
  poster: string | null;
  active: boolean;
  clip: { startSec: number; endSec: number } | null;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = !clip;
    p.muted = true;
    p.timeUpdateEventInterval = clip ? 0.1 : 0;
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
      if (clip && (player.currentTime < clip.startSec || player.currentTime >= clip.endSec - 0.05)) {
        player.currentTime = clip.startSec;
      }
      void player.play();
    } catch {
      /* player already released */
    }
  }, [active, muted, userPaused, player, clip]);

  useEffect(() => {
    if (!clip) return;
    const time = player.addListener("timeUpdate", (e) => {
      if (e.currentTime >= clip.endSec - 0.05 || e.currentTime < clip.startSec - 0.2) {
        try {
          player.currentTime = clip.startSec;
        } catch {
          /* native */
        }
      }
    });
    const ended = player.addListener("playToEnd", () => {
      try {
        player.currentTime = clip.startSec;
        void player.play();
      } catch {
        /* native */
      }
    });
    return () => {
      time.remove();
      ended.remove();
    };
  }, [player, clip]);

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
