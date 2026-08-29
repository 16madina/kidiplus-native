import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Press } from "../Press";
import {
  afficheFontFamily,
  type AfficheLayout,
  type AfficheLayer,
} from "../../lib/vitrine-affiche";
import { isHttpUrl } from "../../lib/storage";

export function AfficheCanvas({
  layout,
  width,
  height,
  selectedId,
  onSelect,
}: {
  layout: AfficheLayout;
  width: number;
  height: number;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  return (
    <View style={[styles.canvas, { width, height, backgroundColor: layout.backgroundColor }]}>
      {layout.backgroundUri && isHttpUrl(layout.backgroundUri) ? (
        <Image source={{ uri: layout.backgroundUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
      {layout.layers.map((layer) => (
        <LayerView
          key={layer.id}
          layer={layer}
          width={width}
          height={height}
          selected={selectedId === layer.id}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}

function LayerView({
  layer,
  width,
  height,
  selected,
  onSelect,
}: {
  layer: AfficheLayer;
  width: number;
  height: number;
  selected: boolean;
  onSelect?: (id: string | null) => void;
}) {
  const left = layer.x * width - 70;
  const top = layer.y * height - 24;
  return (
    <Press
      haptic="none"
      onPress={() => onSelect?.(layer.id)}
      style={[
        styles.layer,
        { left, top, transform: [{ scale: layer.scale }] },
        selected && styles.selected,
      ]}
    >
      {layer.kind === "text" ? (
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
      ) : null}
    </Press>
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
  },
  selected: {
    borderWidth: 1,
    borderColor: "rgba(232,185,59,0.9)",
    borderStyle: "dashed",
  },
  photo: { width: 140, height: 140, borderRadius: 12 },
});
