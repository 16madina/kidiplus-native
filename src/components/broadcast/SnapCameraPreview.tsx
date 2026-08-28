import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KidiCameraKitPreviewNative } from "../../../modules/kidi-camera-kit/src";
import {
  isCameraKitSupported,
  startBridgePreview,
  stopBridgePreview,
} from "../../lib/filters/camera-kit-bridge";
import { useFilter } from "../../lib/filters/filter-context";
import { GOLD } from "../../theme";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

/**
 * Full-bleed Snap Camera Kit preview (AR lenses).
 * Requires a native rebuild that links `kidi-camera-kit`.
 */
export function SnapCameraPreview({
  facing,
}: {
  facing: "user" | "environment" | "front" | "back";
}) {
  const { activeLens, cameraKitReady } = useFilter();
  const facingNorm =
    facing === "back" || facing === "environment" ? "environment" : "user";
  const NativePreview = KidiCameraKitPreviewNative;

  useEffect(() => {
    if (!cameraKitReady) return;
    let cancelled = false;
    void startBridgePreview(facingNorm).catch((e) => {
      if (!cancelled) console.warn("[snap-preview] start failed", e);
    });
    return () => {
      cancelled = true;
      void stopBridgePreview();
    };
  }, [cameraKitReady, facingNorm]);

  if (!isCameraKitSupported() || !cameraKitReady || !NativePreview) {
    return (
      <View style={[FILL, styles.fallback]}>
        <Text style={styles.title}>Filtres Snap AR</Text>
        <Text style={styles.body}>
          Rebuild natif requis :{"\n"}
          npm run rebuild:ios
        </Text>
      </View>
    );
  }

  return (
    <View style={FILL}>
      <NativePreview style={FILL} />
      {activeLens.lensId !== "none" ? (
        <View pointerEvents="none" style={styles.badge}>
          <Text style={styles.badgeTxt}>{activeLens.name}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: "#05060a",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 12,
  },
  title: { color: GOLD, fontWeight: "900", fontSize: 18 },
  body: {
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 22,
    fontSize: 13,
  },
  badge: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
