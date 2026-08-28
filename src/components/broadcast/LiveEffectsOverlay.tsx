import { StyleSheet, View } from "react-native";

/**
 * Background blur / green screen are drawn by the native compositor (or the
 * web canvas). The poster is a separate RN overlay (`PosterGestureLayer`) so
 * drag/pinch never goes through a native UIImageView or a Reanimated worklet
 * that captures JS refs.
 */
export function LiveEffectsOverlay() {
  return <View pointerEvents="none" style={styles.none} />;
}

const styles = StyleSheet.create({
  none: { width: 0, height: 0 },
});
