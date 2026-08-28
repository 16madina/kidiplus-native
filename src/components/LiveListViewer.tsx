import { useCallback, useRef, useState } from "react";
import { Dimensions, FlatList, StyleSheet, View } from "react-native";
import { LiveViewerScreen } from "../screens/LiveViewerScreen";
import type { LiveStream } from "../mock/lives";

const { height: SCREEN_H } = Dimensions.get("window");

export function LiveListViewer({
  list,
  initialIndex,
}: {
  list: LiveStream[];
  initialIndex: number;
}) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const flatRef = useRef<FlatList<LiveStream>>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const first = viewableItems[0]?.index;
      if (first != null) setActiveIndex(first);
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;

  return (
    <FlatList
      ref={flatRef}
      data={list}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <View style={{ width: "100%", height: SCREEN_H }}>
          <LiveViewerScreen stream={item} active={index === activeIndex} />
        </View>
      )}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      initialScrollIndex={initialIndex}
      getItemLayout={(_, index) => ({
        length: SCREEN_H,
        offset: SCREEN_H * index,
        index,
      })}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
});
