import { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { GOLD, NAVY } from "../../theme";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

/** @deprecated Prefer FilterProvider + FiltersCarousel; kept for tint overlay. */
export const SETUP_FILTERS = [
  { id: "naturel", label: "Naturel", tint: "transparent" },
  { id: "glow", label: "Glow", tint: "rgba(255,230,180,0.22)" },
  { id: "warm", label: "Warm", tint: "rgba(255,140,60,0.24)" },
  { id: "studio", label: "Studio", tint: "rgba(90,130,255,0.16)" },
  { id: "rose", label: "Rose", tint: "rgba(255,90,150,0.18)" },
  { id: "noir", label: "Noir", tint: "rgba(0,0,0,0.32)" },
] as const;

export type SetupFilterId = (typeof SETUP_FILTERS)[number]["id"];

export function SetupCamera({
  facing,
  tint = "transparent",
}: {
  facing: CameraType;
  /** Color overlay while Snap Camera Kit native module is not publishing. */
  tint?: string;
}) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission) {
    return <View style={[FILL, { backgroundColor: "#05060a" }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[FILL, styles.denied]}>
        <Text style={styles.deniedTxt}>{t("broadcast.setup.cameraDenied")}</Text>
        <Press onPress={() => void requestPermission()} style={styles.permBtn}>
          <Text style={styles.permTxt}>{t("common.allow")}</Text>
        </Press>
      </View>
    );
  }

  return (
    <View style={FILL}>
      <CameraView
        style={FILL}
        facing={facing}
        mirror={facing === "front" && Platform.OS === "ios"}
      />
      {tint && tint !== "transparent" ? (
        <View pointerEvents="none" style={[FILL, { backgroundColor: tint }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  denied: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  deniedTxt: { color: "rgba(255,255,255,0.8)", textAlign: "center", fontWeight: "600" },
  permBtn: {
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  permTxt: { color: NAVY, fontWeight: "800" },
});
