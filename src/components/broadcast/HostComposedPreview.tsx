import { StyleSheet, View } from "react-native";
import { KidiLiveEffectsPreviewNative } from "../../../modules/kidi-live-effects/src";
import { publishedGreenScreenOn } from "../../lib/filters/host-pipeline-logic";
import { useLiveEffects } from "../../lib/filters/live-effects-context";

const FILL = StyleSheet.absoluteFill;

/** Same composed frame the viewers receive, shown on the host. */
export function HostComposedPreview() {
  const { backgroundMode } = useLiveEffects();
  const Native = KidiLiveEffectsPreviewNative;
  if (!publishedGreenScreenOn(backgroundMode) || !Native) return null;
  return (
    <View pointerEvents="none" style={FILL}>
      <Native style={FILL} />
    </View>
  );
}
