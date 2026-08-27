import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";

export function Press({
  children,
  style,
  haptic = "light",
  ...props
}: PressableProps & {
  style?: StyleProp<ViewStyle>;
  haptic?: "light" | "none";
}) {
  return (
    <Pressable
      {...props}
      onPress={(e) => {
        if (haptic !== "none") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        }
        props.onPress?.(e);
      }}
      style={(state) => [
        {
          minHeight: 44,
          minWidth: 44,
          alignItems: "center",
          justifyContent: "center",
          ...(Platform.OS === "web" ? { cursor: "pointer" as const } : null),
        },
        typeof style === "function" ? style(state) : style,
        state.pressed ? { transform: [{ scale: 0.97 }], opacity: 0.92 } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}
