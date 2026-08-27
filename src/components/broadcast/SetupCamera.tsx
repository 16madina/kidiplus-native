import { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import { useTranslation } from "react-i18next";
import { Press } from "../Press";
import { GOLD, NAVY } from "../../theme";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

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
  filterId,
}: {
  facing: CameraType;
  filterId: SetupFilterId;
}) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const tint = SETUP_FILTERS.find((f) => f.id === filterId)?.tint ?? "transparent";

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
        <Press onPress={() => void requestPermission()} style={styles.allow}>
          <Text style={styles.allowTxt}>{t("broadcast.setup.cameraAllow")}</Text>
        </Press>
      </View>
    );
  }

  return (
    <View style={FILL}>
      <CameraView
        style={FILL}
        facing={facing}
        mute
        mirror={Platform.OS !== "web" && facing === "front"}
      />
      {tint !== "transparent" ? (
        <View pointerEvents="none" style={[FILL, { backgroundColor: tint }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  denied: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 14 },
  deniedTxt: { color: "#fff", textAlign: "center", fontWeight: "700", fontSize: 15 },
  allow: { minHeight: 44, height: 44, borderRadius: 999, paddingHorizontal: 18, backgroundColor: GOLD },
  allowTxt: { color: NAVY, fontWeight: "800" },
});
