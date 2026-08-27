import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { GOLD } from "../theme";
import { Press } from "./Press";

export function GoldButton({
  label,
  onPress,
  disabled,
  icon,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Press onPress={onPress} disabled={disabled} style={[styles.press, disabled && { opacity: 0.55 }]}>
      <LinearGradient colors={["#F7CE5A", "#F5C34A", "#D9A73A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
        {icon}
        <Text style={styles.text}>{label}</Text>
      </LinearGradient>
    </Press>
  );
}

export function RedButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Press onPress={onPress} disabled={disabled} style={[styles.press, disabled && { opacity: 0.5 }]}>
      <LinearGradient colors={["#E24B4B", "#C62828"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.btn, styles.red]}>
        <Text style={styles.redText}>{label}</Text>
      </LinearGradient>
    </Press>
  );
}

export function OutlineButton({
  label,
  onPress,
  light,
}: {
  label: string;
  onPress?: () => void;
  light?: boolean;
}) {
  return (
    <Press
      onPress={onPress}
      style={[
        styles.outline,
        light
          ? { borderColor: "rgba(16,22,43,0.12)", backgroundColor: "rgba(255,255,255,0.8)" }
          : { borderColor: "rgba(255,255,255,0.35)" },
      ]}
    >
      <Text style={[styles.outlineText, { color: light ? "#10162B" : "#fff" }]}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  press: { width: "100%", minHeight: 50, alignItems: "stretch" },
  btn: {
    height: 50,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  red: { height: 48, borderRadius: 16 },
  text: { color: "#151022", fontSize: 16, fontWeight: "800" },
  redText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  outline: {
    width: "100%",
    height: 50,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: { fontSize: 16, fontWeight: "700" },
});
