import { useCallback, useRef, useState } from "react";
import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native";
import { LiveViewerScreen } from "../screens/LiveViewerScreen";
import { ScheduledLivePoster } from "./ScheduledLivePoster";
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
  const itemH = compact ? undefined : screenH;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const first = viewableItems[0]?.index;
      if (first != null) setActiveIndex(first);
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;
  const current = list[activeIndex] ?? list[0];
  const data = compact && current ? [current] : list;

  return (
    <FlatList
      ref={flatRef}
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <View style={compact ? styles.compactItem : { width: "100%", height: itemH }}>
          {item.scheduled ? (
            <ScheduledLivePoster stream={item} active={compact || index === activeIndex} />
          ) : (
            <LiveViewerScreen stream={item} active={compact || index === activeIndex} />
          )}
        </View>
      )}
      pagingEnabled={!compact}
      scrollEnabled={!compact}
      showsVerticalScrollIndicator={false}
      initialScrollIndex={compact ? 0 : initialIndex}
      getItemLayout={
        compact
          ? undefined
          : (_, index) => ({
              length: screenH,
              offset: screenH * index,
              index,
            })
      }
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  compactItem: { flex: 1, width: "100%" },
});
