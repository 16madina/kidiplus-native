import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native";
import { LiveViewerScreen } from "../screens/LiveViewerScreen";
import { ScheduledLivePoster } from "./ScheduledLivePoster";
import { liveListItemLayout } from "../lib/live-pip-presentation";
import type { LiveStream } from "../mock/lives";

export function LiveListViewer({
  list,
  initialIndex,
  compact = false,
}: {
  list: LiveStream[];
  initialIndex: number;
  compact?: boolean;
}) {
  const { height: screenH } = useWindowDimensions();
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
    if (compact) {
      flatRef.current?.scrollToOffset({ offset: 0, animated: false });
      return;
    }
    const idx = Math.min(activeIndex, Math.max(0, list.length - 1));
    try {
      flatRef.current?.scrollToIndex({ index: idx, animated: false });
    } catch {
      /* layout not ready */
    }
  }, [compact, activeIndex, list.length]);

  return (
    <FlatList
      ref={flatRef}
      data={list}
      extraData={`${compact}:${activeIndex}`}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => {
        const isCurrent = index === activeIndex;
        if (compact && !isCurrent) {
          return <View style={styles.hiddenItem} />;
        }
        return (
          <View
            style={
              compact
                ? styles.compactItem
                : { width: "100%", height: screenH }
            }
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
      initialScrollIndex={initialIndex}
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
  compactItem: { flex: 1, width: "100%" },
  hiddenItem: { height: 0, overflow: "hidden" },
});
