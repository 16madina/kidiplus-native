import { useCallback, useEffect } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Image } from "expo-image";
import {
  afficheFontFamily,
  type AfficheLayout,
  type AfficheLayer,
} from "../../lib/vitrine-affiche";
import { applyAffichePan, applyAffichePinch, clampAfficheLayer } from "../../lib/affiche-layer-gesture";
import { isHttpUrl } from "../../lib/storage";

export function AfficheCanvas({
  layout,
  width,
  height,
  selectedId,
  onSelect,
  onChangeLayer,
  onDragChange,
  onTapEmpty,
  editable = false,
}: {
  layout: AfficheLayout;
  width: number;
  height: number;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onChangeLayer?: (id: string, patch: { x: number; y: number; scale: number }) => void;
  onDragChange?: (dragging: boolean) => void;
  onTapEmpty?: (x: number, y: number) => void;
  editable?: boolean;
}) {
  return (
    <Pressable
      disabled={!editable || !onTapEmpty}
      onPress={(e) => {
        if (!onTapEmpty) return;
        const { locationX, locationY } = e.nativeEvent;
        onTapEmpty(locationX / width, locationY / height);
      }}
      style={[styles.canvas, { width, height, backgroundColor: layout.backgroundColor }]}
    >
      {layout.backgroundUri && isHttpUrl(layout.backgroundUri) ? (
        <Image source={{ uri: layout.backgroundUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
      {layout.layers.map((layer) => (
        <LayerView
          key={layer.id}
          layer={layer}
          canvasW={width}
          canvasH={height}
          selected={selectedId === layer.id}
          editable={editable}
          onSelect={onSelect}
          onChangeLayer={onChangeLayer}
          onDragChange={onDragChange}
        />
      ))}
    </Pressable>
  );
}

function LayerView({
  layer,
  canvasW,
  canvasH,
  selected,
  editable,
  onSelect,
  onChangeLayer,
  onDragChange,
}: {
  layer: AfficheLayer;
  canvasW: number;
  canvasH: number;
  selected: boolean;
  editable: boolean;
  onSelect?: (id: string | null) => void;
  onChangeLayer?: (id: string, patch: { x: number; y: number; scale: number }) => void;
  onDragChange?: (dragging: boolean) => void;
}) {
  const boxW = useSharedValue(canvasW);
  const boxH = useSharedValue(canvasH);
  const tx = useSharedValue(layer.x);
  const ty = useSharedValue(layer.y);
  const sc = useSharedValue(layer.scale);
  const startX = useSharedValue(layer.x);
  const startY = useSharedValue(layer.y);
  const startSc = useSharedValue(layer.scale);
  const layerW = useSharedValue(layer.kind === "image" ? 140 : 160);
  const layerH = useSharedValue(layer.kind === "image" ? 140 : 48);

  useEffect(() => {
    tx.value = layer.x;
    ty.value = layer.y;
    sc.value = layer.scale;
  }, [layer.x, layer.y, layer.scale, sc, tx, ty]);

  const commit = useCallback(
    (x: number, y: number, scale: number) => {
      onChangeLayer?.(layer.id, clampAfficheLayer({ x, y, scale }));
    },
    [layer.id, onChangeLayer],
  );

  const select = useCallback(() => {
    onSelect?.(layer.id);
  }, [layer.id, onSelect]);

  const setDragging = useCallback(
    (v: boolean) => {
      onDragChange?.(v);
    },
    [onDragChange],
  );

  const pan = Gesture.Pan()
    .enabled(editable)
    .minDistance(4)
    .maxPointers(1)
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
      startSc.value = sc.value;
      runOnJS(select)();
      runOnJS(setDragging)(true);
    })
    .onUpdate((e) => {
      const next = applyAffichePan({
        originX: startX.value,
        originY: startY.value,
        originScale: startSc.value,
        translationX: e.translationX,
        translationY: e.translationY,
        boxW: boxW.value,
        boxH: boxH.value,
      });
      tx.value = next.x;
      ty.value = next.y;
    })
    .onEnd(() => {
      runOnJS(commit)(tx.value, ty.value, sc.value);
      runOnJS(setDragging)(false);
    });

  const pinch = Gesture.Pinch()
    .enabled(editable)
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
      startSc.value = sc.value;
      runOnJS(select)();
      runOnJS(setDragging)(true);
    })
    .onUpdate((e) => {
      sc.value = applyAffichePinch(startSc.value, e.scale);
    })
    .onEnd(() => {
      runOnJS(commit)(tx.value, ty.value, sc.value);
      runOnJS(setDragging)(false);
    });

  const tap = Gesture.Tap()
    .enabled(editable)
    .onEnd(() => {
      runOnJS(select)();
    });

  const gesture = Gesture.Simultaneous(pan, pinch, tap);

  const layerStyle = useAnimatedStyle(() => ({
    left: tx.value * boxW.value - layerW.value / 2,
    top: ty.value * boxH.value - layerH.value / 2,
    transform: [{ scale: sc.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width >= 8 && height >= 8) {
      layerW.value = width;
      layerH.value = height;
    }
  };

  const inner =
    layer.kind === "text" ? (
      <Text
        style={{
          color: layer.color,
          fontSize: 28,
          fontWeight: "800",
          fontFamily: afficheFontFamily(layer.font),
          textAlign: "center",
        }}
      >
        {layer.text}
      </Text>
    ) : isHttpUrl(layer.uri) ? (
      <Image source={{ uri: layer.uri }} style={styles.photo} contentFit="cover" />
    ) : null;

  if (!editable) {
    return (
      <View
        pointerEvents="none"
        style={[
          styles.layer,
          {
            left: layer.x * canvasW - (layer.kind === "image" ? 70 : 80),
            top: layer.y * canvasH - (layer.kind === "image" ? 70 : 24),
            transform: [{ scale: layer.scale }],
          },
        ]}
      >
        {inner}
      </View>
    );
  }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        onLayout={onLayout}
        style={[styles.layer, layerStyle, selected && styles.selected]}
        collapsable={false}
      >
        {inner}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  canvas: { overflow: "hidden", borderRadius: 18 },
  layer: {
    position: "absolute",
    minWidth: 80,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  selected: {
    borderWidth: 1.5,
    borderColor: "rgba(232,185,59,0.95)",
    borderStyle: "dashed",
    borderRadius: 10,
  },
  photo: { width: 140, height: 140, borderRadius: 12 },
});
