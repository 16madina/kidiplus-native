import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { Press } from "./Press";
import { Glass } from "./Glass";

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
        <LinearGradient
          colors={["rgba(255,255,255,0.55)", "rgba(255,255,255,0)"]}
          style={styles.btnShine}
          pointerEvents="none"
        />
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
        <LinearGradient
          colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]}
          style={styles.btnShine}
          pointerEvents="none"
        />
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
    <Press onPress={onPress} style={styles.press}>
      <Glass tone={light ? "light" : "dark"} intensity={34} radius={999}>
        <View style={styles.outlineInner}>
          <Text style={[styles.outlineText, { color: light ? "#10162B" : "#fff" }]}>{label}</Text>
        </View>
      </Glass>
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
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  btnShine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 22,
  },
  red: { height: 48, borderRadius: 16 },
  text: { color: "#151022", fontSize: 16, fontWeight: "800" },
  redText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  outlineInner: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: { fontSize: 16, fontWeight: "700" },
});
