import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, StyleSheet, useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";
import { LiveViewerScreen } from "../screens/LiveViewerScreen";
import { ScheduledLivePoster } from "./ScheduledLivePoster";
import { liveListItemHeight, liveListItemLayout } from "../lib/live-pip-presentation";
import type { LiveStream } from "../mock/lives";
import { useBlockedIds } from "../lib/moderation";
import { useNav } from "../context/navigation";

export function LiveListViewer({
  list,
  initialIndex,
  compact = false,
  onActiveIndexChange,
}: {
  list: LiveStream[];
  initialIndex: number;
  compact?: boolean;
  onActiveIndexChange?: (index: number) => void;
}) {
  const { height: screenH } = useWindowDimensions();
  const { t } = useTranslation();
  const { closeLive } = useNav();
  const blockedIds = useBlockedIds();
  const blockedAlertShown = useRef(false);
  const initialStream = list[initialIndex];
  const initialHostBlocked = !!initialStream?.sellerId && blockedIds.has(initialStream.sellerId);
  const visibleList = useMemo(
    () => list.filter((item) => !item.sellerId || !blockedIds.has(item.sellerId)),
    [list, blockedIds],
  );
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const flatRef = useRef<FlatList<LiveStream>>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (compact) return;
      const first = viewableItems[0]?.index;
      if (first != null) setActiveIndex(first);
    },
    [compact],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;

  useEffect(() => {
    if (!initialHostBlocked || blockedAlertShown.current) return;
    blockedAlertShown.current = true;
    closeLive();
    Alert.alert(t("block.blocked"), t("block.autoClosedLive"));
  }, [closeLive, initialHostBlocked, t]);

  useEffect(() => {
    onActiveIndexChange?.(activeIndex);
  }, [activeIndex, onActiveIndexChange]);

  useEffect(() => {
    if (compact) {
      flatRef.current?.scrollToOffset({ offset: 0, animated: false });
      return;
    }
    const idx = Math.min(activeIndex, Math.max(0, visibleList.length - 1));
    try {
      flatRef.current?.scrollToIndex({ index: idx, animated: false });
    } catch {
      /* layout not ready */
    }
  }, [compact, activeIndex, visibleList.length]);

  return (
    <FlatList
      ref={flatRef}
      data={initialHostBlocked ? [] : visibleList}
      extraData={`${compact}:${activeIndex}`}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => {
        const isCurrent = index === activeIndex;
        if (compact && !isCurrent) {
          return <View style={styles.hiddenItem} />;
        }
        return (
          <View
            style={{
              width: "100%",
              height: liveListItemHeight(compact, screenH),
              flexShrink: 0,
            }}
          >
            {item.scheduled ? (
              <ScheduledLivePoster stream={item} active={compact || isCurrent} />
            ) : (
              <LiveViewerScreen stream={item} active={compact || isCurrent} />
            )}
          </View>
        );
      }}
      pagingEnabled={!compact}
      scrollEnabled={!compact}
      showsVerticalScrollIndicator={false}
      initialScrollIndex={initialHostBlocked ? 0 : Math.min(initialIndex, Math.max(0, visibleList.length - 1))}
      getItemLayout={(_, index) => liveListItemLayout(compact, index, activeIndex, screenH)}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      removeClippedSubviews={false}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  hiddenItem: { height: 0, overflow: "hidden" },
});
