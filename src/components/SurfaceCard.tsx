import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { useAppTheme } from "../context/theme";
import { Press } from "./Press";

/** Bordered native card (`rounded-2xl border`) used inside overlay menus. */
export function SurfaceCard({
  children,
  style,
  padded = true,
  onPress,
}: {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const inner = (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        { borderColor: colors.border, backgroundColor: colors.card },
        !onPress ? style : null,
      ]}
    >
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Press onPress={onPress} style={[styles.press, style]}>
        {inner}
      </Press>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  press: { alignItems: "stretch", minHeight: 0, minWidth: 0 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  padded: { padding: 12 },
});
