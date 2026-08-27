import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView, type BlurTint } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { GOLD } from "../theme";
import { Press } from "./Press";

export type GlassTone = "light" | "dark" | "gold";

const TINT: Record<GlassTone, BlurTint> = {
  light: "light",
  dark: "dark",
  gold: "dark",
};

const FILL: Record<GlassTone, string> = {
  light: "rgba(255,255,255,0.16)",
  dark: "rgba(8,12,26,0.28)",
  gold: "rgba(232,185,59,0.16)",
};

const BORDER: Record<GlassTone, string> = {
  light: "rgba(255,255,255,0.72)",
  dark: "rgba(255,255,255,0.34)",
  gold: "rgba(255,226,140,0.78)",
};

const SHINE: Record<GlassTone, readonly [string, string]> = {
  light: ["rgba(255,255,255,0.7)", "rgba(255,255,255,0)"],
  dark: ["rgba(255,255,255,0.38)", "rgba(255,255,255,0)"],
  gold: ["rgba(255,246,210,0.7)", "rgba(232,185,59,0)"],
};

export function Glass({
  children,
  style,
  contentStyle,
  tone = "light",
  intensity = 55,
  radius = 20,
  padded,
  elevated = true,
  borderless,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  tone?: GlassTone;
  intensity?: number;
  radius?: number;
  padded?: boolean;
  elevated?: boolean;
  borderless?: boolean;
}) {
  return (
    <View style={[elevated ? platformShadow(tone) : null, style]}>
      <View
        style={[
          {
            borderRadius: radius,
            overflow: "hidden",
            borderWidth: borderless ? 0 : StyleSheet.hairlineWidth + 0.7,
            borderColor: BORDER[tone],
          },
          styles.clip,
        ]}
      >
        <BlurView
          intensity={intensity}
          tint={TINT[tone]}
          experimentalBlurMethod="dimezisBlurView"
          pointerEvents="none"
          style={styles.fill}
        />
        <View pointerEvents="none" style={[styles.fill, { backgroundColor: FILL[tone] }]} />
        <LinearGradient
          colors={[SHINE[tone][0], SHINE[tone][1]]}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 0.92, y: 0.85 }}
          style={styles.shine}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["rgba(255,255,255,0)", tone === "gold" ? "rgba(255,226,140,0.22)" : "rgba(255,255,255,0.16)"]}
          style={styles.glint}
          pointerEvents="none"
        />
        {borderless ? null : (
          <View
            pointerEvents="none"
            style={[
              styles.innerStroke,
              { borderRadius: Math.max(0, radius - 1), borderColor: "rgba(255,255,255,0.42)" },
            ]}
          />
        )}
        <View style={[styles.content, padded && styles.pad, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}

export function GlassIcon({
  children,
  tone = "dark",
  size = 44,
  intensity = 48,
  style,
}: {
  children: ReactNode;
  tone?: GlassTone;
  size?: number;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Glass
      tone={tone}
      intensity={intensity}
      radius={size / 2}
      style={[{ width: size, height: size }, style]}
      contentStyle={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      {children}
    </Glass>
  );
}

export function GlassIconButton({
  children,
  onPress,
  tone = "dark",
  size = 44,
}: {
  children: ReactNode;
  onPress?: () => void;
  tone?: GlassTone;
  size?: number;
}) {
  return (
    <Press onPress={onPress} style={{ width: size, height: size, minWidth: size, minHeight: size }}>
      <GlassIcon tone={tone} size={size}>
        {children}
      </GlassIcon>
    </Press>
  );
}

function platformShadow(tone: GlassTone): ViewStyle {
  if (Platform.OS === "android") {
    return { elevation: tone === "gold" ? 10 : 7 };
  }
  return {
    shadowColor: tone === "gold" ? GOLD : tone === "light" ? "#8FA0C8" : "#040814",
    shadowOpacity: tone === "light" ? 0.2 : 0.42,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  };
}

const styles = StyleSheet.create({
  clip: { flexGrow: 0 },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  content: { position: "relative", zIndex: 1 },
  shine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "52%",
  },
  glint: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "28%",
  },
  innerStroke: {
    position: "absolute",
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pad: { padding: 12 },
});
