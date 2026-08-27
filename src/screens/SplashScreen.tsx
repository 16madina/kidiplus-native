import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Splash from "expo-splash-screen";
import { NAVY } from "../theme";

void Splash.preventAutoHideAsync().catch(() => undefined);

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const finished = useRef(false);
  const [exiting, setExiting] = useState(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    void Splash.hideAsync().catch(() => undefined);
    setExiting(true);
    setTimeout(onDone, 260);
  };

  const player = useVideoPlayer(require("../../assets/splash.mp4"), (p) => {
    p.loop = false;
    p.muted = Platform.OS === "web";
    p.play();
  });

  useEffect(() => {
    void Splash.hideAsync().catch(() => undefined);
    const watchdog = setTimeout(finish, 8000);
    const hard = setTimeout(finish, 12000);
    const sub = player.addListener("playToEnd", finish);
    const status = player.addListener("statusChange", (e) => {
      if (e.status === "error") finish();
    });
    return () => {
      clearTimeout(watchdog);
      clearTimeout(hard);
      sub.remove();
      status.remove();
    };
  }, [player]);

  return (
    <View style={[styles.root, { opacity: exiting ? 0 : 1 }]} pointerEvents={exiting ? "none" : "auto"}>
      <View style={StyleSheet.absoluteFill} />
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    backgroundColor: NAVY,
    zIndex: 9999,
  },
});
