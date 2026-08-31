import { useEffect, useRef } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { GOLD, LIVE_RED, NAVY, initials } from "../../theme";
import { isHttpUrl } from "../../lib/storage";
import { firstUnreadIndex, storyCardBadge, storyCardTone, type HomeStoryCard } from "../../lib/home-stories";
import type { VitrineStory } from "../../lib/vitrine-stories";
import type { LiveStream } from "../../mock/lives";
import { useAppTheme } from "../../context/theme";

const CARD = 80;
const RADIUS = 16;

export function HomeStoriesRow({
  ownUserId,
  ownAvatarUrl,
  ownDisplayName,
  ownItems,
  ownUnread,
  cards,
  liveBySeller,
  onAdd,
  onOpenStories,
  onOpenLive,
}: {
  ownUserId: string | null;
  ownAvatarUrl: string | null;
  ownDisplayName: string;
  ownItems: VitrineStory[];
  ownUnread: boolean;
  cards: HomeStoryCard[];
  liveBySeller: Map<string, LiveStream>;
  onAdd: () => void;
  onOpenStories: (items: VitrineStory[], index: number) => void;
  onOpenLive: (stream: LiveStream) => void;
}) {
  const { t } = useTranslation();
  const { colors, dark } = useAppTheme();
  const readBorder = dark ? "rgba(255,255,255,0.38)" : "#9CA3AF";
  const ownLive = ownUserId ? liveBySeller.get(ownUserId) ?? null : null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <StorySquareCard
        previewUrl={ownAvatarUrl}
        avatarUrl={ownAvatarUrl}
        fallbackName={ownDisplayName}
        label={t("vitrine.yourStory")}
        unread={ownUnread || ownItems.length === 0}
        live={!!ownLive}
        liveStream={ownLive}
        showNewBadge={false}
        showPlus
        readBorder={readBorder}
        nameColor={colors.foreground}
        onPress={() => {
          if (ownItems.length > 0) {
            onOpenStories(ownItems, firstUnreadIndex(ownItems));
            return;
          }
          onAdd();
        }}
        onAdd={onAdd}
        onOpenLive={onOpenLive}
      />
      {cards.map((card) => {
        const liveStream = liveBySeller.get(card.userId) ?? null;
        const tone = storyCardTone(card.unread, !!liveStream);
        return (
          <StorySquareCard
            key={card.userId}
            previewUrl={card.previewUrl}
            avatarUrl={card.avatarUrl}
            fallbackName={card.displayName}
            label={card.displayName}
            unread={card.unread}
            live={tone === "live"}
            liveStream={liveStream}
            showNewBadge={storyCardBadge(tone) === "new"}
            showPlus={false}
            readBorder={readBorder}
            nameColor={colors.foreground}
            onPress={() => onOpenStories(card.items, firstUnreadIndex(card.items))}
            onOpenLive={onOpenLive}
          />
        );
      })}
    </ScrollView>
  );
}

function StorySquareCard({
  previewUrl,
  avatarUrl,
  fallbackName,
  label,
  unread,
  live,
  liveStream,
  showNewBadge,
  showPlus,
  readBorder,
  nameColor,
  onPress,
  onAdd,
  onOpenLive,
}: {
  previewUrl: string | null;
  avatarUrl: string | null;
  fallbackName: string;
  label: string;
  unread: boolean;
  live: boolean;
  liveStream: LiveStream | null;
  showNewBadge: boolean;
  showPlus: boolean;
  readBorder: string;
  nameColor: string;
  onPress: () => void;
  onAdd?: () => void;
  onOpenLive: (stream: LiveStream) => void;
}) {
  const { t } = useTranslation();
  const pulse = useRef(new Animated.Value(1)).current;
  const image = isHttpUrl(previewUrl) ? previewUrl : isHttpUrl(avatarUrl) ? avatarUrl : null;
  const tone = storyCardTone(unread, live);
  const borderColor = tone === "live" ? LIVE_RED : tone === "unread" ? GOLD : readBorder;

  useEffect(() => {
    if (!live) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 650, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(1);
    };
  }, [live, pulse]);

  return (
    <Press onPress={onPress} style={styles.item} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.frame}>
        <Animated.View
          pointerEvents="none"
          style={[styles.ring, { borderColor, opacity: live ? pulse : 1 }]}
        />
        {image ? (
          <Image source={{ uri: image }} style={styles.img} contentFit="cover" />
        ) : (
          <View style={[styles.img, styles.fallback]}>
            <Text style={styles.initials}>{initials(fallbackName || "?")}</Text>
          </View>
        )}
        {showPlus ? (
          <Press
            onPress={(e) => {
              e.stopPropagation();
              onAdd?.();
            }}
            haptic="light"
            style={styles.plusBtn}
            accessibilityRole="button"
            accessibilityLabel={t("vitrine.yourStory")}
          >
            <Plus size={12} color={NAVY} strokeWidth={3} />
          </Press>
        ) : null}
        {live && liveStream ? (
          <Press
            onPress={(e) => {
              e.stopPropagation();
              onOpenLive(liveStream);
            }}
            haptic="light"
            style={styles.liveBadge}
            accessibilityRole="button"
            accessibilityLabel={t("home.stories.live")}
          >
            <Text style={styles.liveBadgeText}>{t("home.stories.live")}</Text>
          </Press>
        ) : showNewBadge ? (
          <View style={styles.newBadge} pointerEvents="none">
            <Text style={styles.newBadgeText}>{t("home.stories.new")}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={[styles.name, { color: nameColor }]}>
        {label}
      </Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 12, paddingTop: 4, paddingBottom: 8 },
  item: {
    width: CARD,
    minHeight: 0,
    minWidth: 0,
    alignItems: "center",
  },
  frame: {
    width: CARD,
    height: CARD,
    borderRadius: RADIUS,
    padding: 2.5,
    overflow: "visible",
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: RADIUS,
    borderWidth: 2.5,
  },
  img: {
    flex: 1,
    borderRadius: RADIUS - 4,
    backgroundColor: NAVY,
    overflow: "hidden",
  },
  fallback: { alignItems: "center", justifyContent: "center" },
  initials: { color: "#fff", fontSize: 22, fontWeight: "800" },
  name: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
    maxWidth: CARD,
    textAlign: "center",
  },
  plusBtn: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 22,
    height: 22,
    minWidth: 22,
    minHeight: 22,
    borderRadius: 11,
    backgroundColor: GOLD,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  newBadge: {
    position: "absolute",
    top: 5,
    left: 5,
    backgroundColor: GOLD,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  newBadgeText: { color: NAVY, fontSize: 8, fontWeight: "800", letterSpacing: 0.3 },
  liveBadge: {
    position: "absolute",
    top: 5,
    left: 5,
    backgroundColor: LIVE_RED,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 0,
    minHeight: 0,
    zIndex: 3,
  },
  liveBadgeText: { color: "#fff", fontSize: 8, fontWeight: "800", letterSpacing: 0.4 },
});
